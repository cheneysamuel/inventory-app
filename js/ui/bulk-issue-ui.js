/**
 * Bulk Issue Modal and PDF Generation
 * Extracted from receiveBulk view to improve maintainability
 * 
 * This module handles:
 * - Bulk issue modal UI and signature capture
 * - PDF receipt generation for bulk issues
 */

const BulkIssueUI = (() => {
    
    // ==================== MODAL ====================
    
    /**
     * Show bulk issue modal with signature capability
     * @param {Array} items - Items to issue
     * @param {Object} action - Action definition
     * @param {Object} assignments - Crew and area assignments
     */
    const showBulkIssueModal = (items, action, assignments) => {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        let signaturePad = null;
        
        // Build items table
        const itemsTableHtml = buildItemsTable(items, state);
        
        // Build signature section if action allows PDF
        const signatureSection = action.allow_pdf ? buildSignatureSection(() => signaturePad) : null;
        
        // Build summary section
        const summarySection = buildSummarySection(items, totalQuantity, crew, area);
        
        // Build modal content
        const modalContent = [itemsTableHtml, summarySection, signatureSection].filter(Boolean);
        
        // Modal actions
        const actions = [
            {
                label: 'Complete Issue',
                type: 'primary',
                handler: async () => {
                    console.log('📋 Starting bulk issue...');
                    await window.executeBulkIssueAction(items, { crew, area });
                    
                    // Auto-generate PDF if signature is present
                    console.log('📄 Checking PDF generation:', { 
                        allow_pdf: action.allow_pdf, 
                        hasSignaturePad: !!signaturePad, 
                        isEmpty: signaturePad ? signaturePad.isEmpty() : 'N/A' 
                    });
                    
                    if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                        console.log('📄 Generating PDF...');
                        await generateBulkIssuePDF(items, { crew, area }, signaturePad);
                    } else {
                        console.log('📄 PDF generation skipped');
                    }
                    
                    // Refresh transactions list
                    await refreshTransactionsList();
                    
                    Modals.close();
                    window.cancelBulkIssueProcess();
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => {
                    Modals.close();
                    window.cancelBulkIssueProcess();
                }
            }
        ];
        
        // Show modal
        const modal = Modals.create({
            title: 'Issue Bulk Inventory',
            content: modalContent,
            actions: actions,
            size: 'large',
            actionModal: true
        });
        
        Modals.show(modal);
        
        // Initialize signature pad if present - query for canvas after modal is shown
        if (action.allow_pdf) {
            setTimeout(() => {
                const signatureCanvas = document.getElementById('signature-canvas');
                if (signatureCanvas) {
                    initializeSignaturePad(signatureCanvas, (pad) => { signaturePad = pad; });
                }
            }, 200);
        }
    };
    
    /**
     * Build items table for modal
     * @param {Array} items - Items to issue
     * @param {Object} state - Application state
     * @returns {HTMLElement}
     */
    const buildItemsTable = (items, state) => {
        return createElement('table', { className: 'inventory-table', style: { marginBottom: '1rem' } }, [
            createElement('thead', {}, [
                createElement('tr', {}, [
                    createElement('th', {}, ['Item Type']),
                    createElement('th', {}, ['Quantity']),
                    createElement('th', {}, ['Status'])
                ])
            ]),
            createElement('tbody', {},
                items.map(item => {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    const status = state.statuses.find(s => s.id === item.status_id);
                    
                    return createElement('tr', {}, [
                        createElement('td', {}, [itemType?.name || 'Unknown']),
                        createElement('td', {}, [String(item.quantity || 1)]),
                        createElement('td', {}, [status?.name || 'Unknown'])
                    ]);
                })
            )
        ]);
    };
    
    /**
     * Build signature section for modal
     * @param {Function} getPad - Callback to get signature pad reference
     * @returns {HTMLElement}
     */
    const buildSignatureSection = (getPad) => {
        let signatureCanvas;
        
        return div({ style: { marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Signature (Optional):']),
            createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                'Sign below to include signature on receipt'
            ]),
            createElement('div', { style: { border: '2px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff' } }, [
                signatureCanvas = createElement('canvas', {
                    id: 'signature-canvas',
                    width: 500,
                    height: 150,
                    style: { display: 'block', width: '100%', touchAction: 'none' }
                })
            ]),
            div({ style: { marginTop: '0.5rem', display: 'flex', gap: '0.5rem' } }, [
                button('Clear Signature', {
                    className: 'btn btn-secondary',
                    style: { fontSize: '0.875rem' },
                    onclick: () => { 
                        const pad = getPad();
                        if (pad) pad.clear(); 
                    }
                })
            ])
        ]);
    };
    
    /**
     * Build summary section for modal
     * @param {Array} items - Items array
     * @param {number} totalQuantity - Total quantity
     * @param {Object} crew - Crew assignment
     * @param {Object} area - Area assignment
     * @returns {HTMLElement}
     */
    const buildSummarySection = (items, totalQuantity, crew, area) => {
        return div({ style: { marginTop: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Issue Summary:']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                div({}, [createElement('strong', {}, ['Total Items:']), ` ${items.length}`]),
                div({}, [createElement('strong', {}, ['Total Quantity:']), ` ${totalQuantity}`]),
                div({}, [createElement('strong', {}, ['Crew:']), ` ${crew.name}`]),
                div({}, [createElement('strong', {}, ['Area:']), ` ${area.name}`])
            ])
        ]);
    };
    
    /**
     * Initialize signature pad with proper canvas sizing
     * @param {HTMLCanvasElement} canvas - Canvas element
     * @param {Function} callback - Callback with signature pad instance
     */
    const initializeSignaturePad = (canvas, callback) => {
        function resizeCanvas() {
            const ratio = Math.max(window.devicePixelRatio || 1, 1);
            const rect = canvas.getBoundingClientRect();
            
            canvas.width = rect.width * ratio;
            canvas.height = rect.height * ratio;
            canvas.getContext('2d').scale(ratio, ratio);
        }
        
        resizeCanvas();
        
        const pad = new SignaturePad(canvas, {
            backgroundColor: 'rgb(255, 255, 255)',
            penColor: 'rgb(0, 0, 0)'
        });
        
        callback(pad);
    };
    
    // ==================== PDF GENERATION ====================
    
    /**
     * Generate bulk issue PDF receipt
     * @param {Array} items - Items issued
     * @param {Object} assignments - Crew and area assignments
     * @param {Object} signaturePad - Signature pad instance
     */
    const generateBulkIssuePDF = async (items, assignments, signaturePad) => {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        try {
            const receiptNumber = await getNextReceiptNumber();
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([612, 792]); // Letter size
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            let yPosition = 750;
            
            // Draw header
            yPosition = drawHeader(page, boldFont, receiptNumber, yPosition, rgb);
            
            // Draw metadata
            yPosition = drawMetadata(page, font, crew, area, yPosition);
            
            // Draw items table
            yPosition = drawItemsTable(page, font, boldFont, items, state, yPosition, rgb);
            
            // Draw totals
            yPosition = drawTotals(page, font, boldFont, items, yPosition, rgb);
            
            // Draw signature
            if (signaturePad && !signaturePad.isEmpty()) {
                await drawSignature(page, pdfDoc, signaturePad, yPosition, StandardFonts);
            }
            
            // Save and download PDF
            await savePDF(pdfDoc);
            
            Components.showToast('PDF generated successfully', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            Components.showToast('Error generating PDF', 'error');
        }
    };
    
    /**
     * Get and increment receipt number
     * @returns {Promise<number>} Receipt number
     */
    const getNextReceiptNumber = async () => {
        const configResult = await Queries.getConfig('lastReceiptNumber');
        let receiptNumber = 1;
        if (configResult.isOk) {
            receiptNumber = parseInt(configResult.value) + 1;
        }
        await Queries.setConfig('lastReceiptNumber', receiptNumber);
        return receiptNumber;
    };
    
    /**
     * Draw PDF header
     * @param {Object} page - PDF page
     * @param {Object} font - Bold font
     * @param {number} receiptNumber - Receipt number
     * @param {number} yPosition - Current Y position
     * @param {Function} rgb - RGB color function from PDFLib
     * @returns {number} Updated Y position
     */
    const drawHeader = (page, font, receiptNumber, yPosition, rgb) => {
        page.drawText('BULK INVENTORY ISSUE RECEIPT', {
            x: 50,
            y: yPosition,
            size: 18,
            font: font,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 25;
        page.drawText(`Receipt #: ${String(receiptNumber).padStart(6, '0')}`, {
            x: 50,
            y: yPosition,
            size: 12,
            font: font,
            color: rgb(0, 0, 0)
        });
        
        return yPosition;
    };
    
    /**
     * Draw PDF metadata (date, crew, area)
     * @param {Object} page - PDF page
     * @param {Object} font - Regular font
     * @param {Object} crew - Crew assignment
     * @param {Object} area - Area assignment
     * @param {number} yPosition - Current Y position
     * @returns {number} Updated Y position
     */
    const drawMetadata = (page, font, crew, area, yPosition) => {
        yPosition -= 30;
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: getUserTimezone(),
            timeZoneName: 'short'
        });
        page.drawText(`Date: ${formattedDate}`, { x: 50, y: yPosition, size: 10, font: font });
        
        yPosition -= 20;
        page.drawText(`Crew: ${crew?.name || 'N/A'}`, { x: 50, y: yPosition, size: 10, font: font });
        
        yPosition -= 20;
        page.drawText(`Area: ${area?.name || 'N/A'}`, { x: 50, y: yPosition, size: 10, font: font });
        
        return yPosition - 40;
    };
    
    /**
     * Draw items table in PDF
     * @param {Object} page - PDF page
     * @param {Object} font - Regular font
     * @param {Object} boldFont - Bold font
     * @param {Array} items - Items issued
     * @param {Object} state - Application state
     * @param {number} yPosition - Current Y position
     * @param {Function} rgb - RGB color function from PDFLib
     * @returns {number} Updated Y position
     */
    const drawItemsTable = (page, font, boldFont, items, state, yPosition, rgb) => {
        page.drawText('Items Issued:', { x: 50, y: yPosition, size: 12, font: boldFont });
        yPosition -= 25;
        
        // Table headers
        page.drawText('Item Type', { x: 50, y: yPosition, size: 9, font: boldFont });
        page.drawText('Quantity', { x: 450, y: yPosition, size: 9, font: boldFont });
        
        yPosition -= 5;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 15;
        
        // Items
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const itemTypeName = itemType?.name || 'Unknown';
            
            const wrappedLines = wrapText(itemTypeName, 380, font);
            const startY = yPosition;
            
            for (let i = 0; i < wrappedLines.length; i++) {
                page.drawText(wrappedLines[i], { x: 50, y: yPosition - (i * 12), size: 9, font: font });
            }
            
            page.drawText(String(item.quantity || 1), { x: 450, y: startY, size: 9, font: font });
            
            yPosition -= Math.max(15, wrappedLines.length * 12 + 3);
            
            if (yPosition < 150) break; // Leave space for signature
        }
        
        return yPosition;
    };
    
    /**
     * Wrap text to fit within max width
     * @param {string} text - Text to wrap
     * @param {number} maxWidth - Max width in pixels
     * @param {Object} font - Font object
     * @returns {Array<string>} Wrapped lines
     */
    const wrapText = (text, maxWidth, font) => {
        const words = text.split(' ');
        const lines = [];
        let currentLine = '';
        
        for (const word of words) {
            const testLine = currentLine ? currentLine + ' ' + word : word;
            const testWidth = font.widthOfTextAtSize(testLine, 9);
            
            if (testWidth > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = word;
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) lines.push(currentLine);
        return lines;
    };
    
    /**
     * Draw totals section in PDF
     * @param {Object} page - PDF page
     * @param {Object} font - Regular font
     * @param {Object} boldFont - Bold font
     * @param {Array} items - Items issued
     * @param {number} yPosition - Current Y position
     * @param {Function} rgb - RGB color function from PDFLib
     * @returns {number} Updated Y position
     */
    const drawTotals = (page, font, boldFont, items, yPosition, rgb) => {
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        yPosition -= 10;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 20;
        page.drawText(`Total Items: ${items.length}`, { x: 50, y: yPosition, size: 10, font: boldFont });
        page.drawText(`Total Quantity: ${totalQuantity}`, { x: 300, y: yPosition, size: 10, font: boldFont });
        
        return yPosition;
    };
    
    /**
     * Draw signature in PDF
     * @param {Object} page - PDF page
     * @param {Object} pdfDoc - PDF document
     * @param {Object} signaturePad - Signature pad instance
     * @param {number} yPosition - Current Y position
     * @param {Object} StandardFonts - StandardFonts from PDFLib
     */
    const drawSignature = async (page, pdfDoc, signaturePad, yPosition, StandardFonts) => {
        yPosition -= 60;
        page.drawText('Received By:', { x: 50, y: yPosition + 50, size: 10, font: await pdfDoc.embedFont(StandardFonts.HelveticaBold) });
        
        const signatureDataUrl = signaturePad.toDataURL();
        const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
        const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
        
        page.drawImage(signatureImage, {
            x: 50,
            y: yPosition - 30,
            width: 200,
            height: 60
        });
    };
    
    /**
     * Save and download PDF
     * @param {Object} pdfDoc - PDF document
     */
    const savePDF = async (pdfDoc) => {
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `Bulk_Issue_Receipt_${getLocalTimestamp().split('T')[0]}.pdf`;
        a.click();
    };
    
    // ==================== PUBLIC API ====================
    
    return {
        showBulkIssueModal,
        generateBulkIssuePDF
    };
})();

// Make available globally
window.showBulkIssueModal = BulkIssueUI.showBulkIssueModal;
window.generateBulkIssuePDF = BulkIssueUI.generateBulkIssuePDF;

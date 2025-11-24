/**
 * Import Inventory Service
 * Handles importing inventory quantity adjustments from Excel templates
 */

const ImportInventoryService = (() => {
    'use strict';

    /**
     * Load Excel file from user selection
     * @returns {Promise<Object>} ExcelJS workbook object
     */
    const loadExcelFile = async () => {
        return new Promise((resolve, reject) => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.xlsx,.xls';
            
            input.onchange = async (e) => {
                try {
                    const file = e.target.files[0];
                    if (!file) {
                        reject(new Error('No file selected'));
                        return;
                    }
                    
                    const ExcelJS = window.ExcelJS;
                    const workbook = new ExcelJS.Workbook();
                    const arrayBuffer = await file.arrayBuffer();
                    await workbook.xlsx.load(arrayBuffer);
                    
                    resolve(workbook);
                } catch (error) {
                    reject(error);
                }
            };
            
            input.click();
        });
    };

    /**
     * Verify that the Excel file is a valid Inventory Update template
     * @param {Object} workbook - ExcelJS workbook
     * @returns {Object} { isValid: boolean, error: string }
     */
    const verifyExcelFileIsValid = (workbook) => {
        // Check if required sheets exist
        const serializedSheet = workbook.getWorksheet('SERIALIZED_INVENTORY');
        const bulkSheet = workbook.getWorksheet('BULK_INVENTORY');
        
        if (!serializedSheet && !bulkSheet) {
            return { 
                isValid: false, 
                error: 'Template is invalid: Neither SERIALIZED_INVENTORY nor BULK_INVENTORY sheet found' 
            };
        }

        // Expected column names for SERIALIZED_INVENTORY
        const expectedSerializedColumns = [
            'ID',
            'Item Type',
            'Category',
            'Manufacturer SN',
            'Tilson SN',
            'Quantity',
            'Status',
            'Location',
            'Location Type',
            'Crew',
            'Area'
        ];

        // Expected column names for BULK_INVENTORY
        const expectedBulkColumns = [
            'ID',
            'Item Type',
            'Category',
            'Part Number',
            'Quantity',
            'Unit of Measure',
            'Status',
            'Location',
            'Location Type',
            'Crew',
            'Area'
        ];

        // Verify SERIALIZED_INVENTORY columns if sheet exists
        if (serializedSheet) {
            const headerRow = serializedSheet.getRow(1);
            const actualColumns = [];
            headerRow.eachCell((cell, colNumber) => {
                actualColumns.push(cell.value);
            });

            for (let i = 0; i < expectedSerializedColumns.length; i++) {
                if (actualColumns[i] !== expectedSerializedColumns[i]) {
                    return {
                        isValid: false,
                        error: `SERIALIZED_INVENTORY sheet invalid: Column ${i + 1} should be "${expectedSerializedColumns[i]}" but found "${actualColumns[i]}"`
                    };
                }
            }
        }

        // Verify BULK_INVENTORY columns if sheet exists
        if (bulkSheet) {
            const headerRow = bulkSheet.getRow(1);
            const actualColumns = [];
            headerRow.eachCell((cell, colNumber) => {
                actualColumns.push(cell.value);
            });

            for (let i = 0; i < expectedBulkColumns.length; i++) {
                if (actualColumns[i] !== expectedBulkColumns[i]) {
                    return {
                        isValid: false,
                        error: `BULK_INVENTORY sheet invalid: Column ${i + 1} should be "${expectedBulkColumns[i]}" but found "${actualColumns[i]}"`
                    };
                }
            }
        }

        return { isValid: true, error: null };
    };

    /**
     * Get quantity changes from the workbook
     * @param {Object} workbook - ExcelJS workbook
     * @param {Object} state - Application state with current inventory
     * @returns {Array} Array of change objects
     */
    const getQuantityChanges = (workbook, state) => {
        const changes = [];

        // Process SERIALIZED_INVENTORY sheet
        const serializedSheet = workbook.getWorksheet('SERIALIZED_INVENTORY');
        if (serializedSheet) {
            let rowNumber = 2; // Skip header
            while (true) {
                const row = serializedSheet.getRow(rowNumber);
                const id = row.getCell(1).value; // ID column
                const newQuantity = row.getCell(6).value; // Quantity column

                // Stop if we reach an empty ID
                if (!id) break;

                // Find current inventory record
                const currentInventory = state.inventory.find(inv => inv.id === id);
                
                if (currentInventory) {
                    const currentQty = currentInventory.quantity || 0;
                    const newQty = parseInt(newQuantity) || 0;

                    // Only include if quantity changed
                    if (currentQty !== newQty) {
                        changes.push({
                            id: id,
                            type: 'serialized',
                            itemType: row.getCell(2).value,
                            category: row.getCell(3).value,
                            manufacturerSn: row.getCell(4).value,
                            tilsonSn: row.getCell(5).value,
                            currentQuantity: currentQty,
                            newQuantity: newQty,
                            difference: newQty - currentQty,
                            status: row.getCell(7).value,
                            location: row.getCell(8).value,
                            locationType: row.getCell(9).value,
                            crew: row.getCell(10).value,
                            area: row.getCell(11).value
                        });
                    }
                }

                rowNumber++;
            }
        }

        // Process BULK_INVENTORY sheet
        const bulkSheet = workbook.getWorksheet('BULK_INVENTORY');
        if (bulkSheet) {
            let rowNumber = 2; // Skip header
            while (true) {
                const row = bulkSheet.getRow(rowNumber);
                const id = row.getCell(1).value; // ID column
                const newQuantity = row.getCell(5).value; // Quantity column

                // Stop if we reach an empty ID
                if (!id) break;

                // Find current inventory record
                const currentInventory = state.inventory.find(inv => inv.id === id);
                
                if (currentInventory) {
                    const currentQty = currentInventory.quantity || 0;
                    const newQty = parseFloat(newQuantity) || 0;

                    // Only include if quantity changed
                    if (currentQty !== newQty) {
                        changes.push({
                            id: id,
                            type: 'bulk',
                            itemType: row.getCell(2).value,
                            category: row.getCell(3).value,
                            partNumber: row.getCell(4).value,
                            currentQuantity: currentQty,
                            newQuantity: newQty,
                            difference: newQty - currentQty,
                            uom: row.getCell(6).value,
                            status: row.getCell(7).value,
                            location: row.getCell(8).value,
                            locationType: row.getCell(9).value,
                            crew: row.getCell(10).value,
                            area: row.getCell(11).value
                        });
                    }
                }

                rowNumber++;
            }
        }

        return changes;
    };

    /**
     * Generate HTML table showing quantity changes
     * @param {Array} changes - Array of change objects
     * @returns {HTMLElement} Table element
     */
    const generateChangesTable = (changes) => {
        if (changes.length === 0) {
            return p('No quantity changes detected', { 
                style: { textAlign: 'center', padding: '2rem', color: '#6b7280' } 
            });
        }

        const table = createElement('table', { 
            className: 'import-preview-table',
            style: { 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: '0.9rem'
            }
        });

        // Table header
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        
        const headers = [
            'Select',
            'Type',
            'Item Type',
            'Identifier',
            'Current Qty',
            'New Qty',
            'Difference',
            'Status',
            'Location'
        ];

        headers.forEach(header => {
            const th = createElement('th', {
                style: {
                    backgroundColor: '#1e3a8a',
                    color: 'white',
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontWeight: '600',
                    borderBottom: '2px solid #1e40af'
                }
            }, [header]);
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Table body
        const tbody = createElement('tbody');

        changes.forEach((change, index) => {
            const row = createElement('tr', {
                style: {
                    backgroundColor: index % 2 === 0 ? '#f9fafb' : 'white',
                    borderBottom: '1px solid #e5e7eb'
                }
            });

            // Checkbox cell
            const checkboxCell = createElement('td', {
                style: { padding: '0.75rem', textAlign: 'center' }
            });
            const checkbox = createElement('input', {
                type: 'checkbox',
                checked: true,
                dataset: { index: index }
            });
            checkboxCell.appendChild(checkbox);
            row.appendChild(checkboxCell);

            // Type cell
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem' }
            }, [change.type === 'serialized' ? '📦 Serialized' : '📊 Bulk']));

            // Item Type cell
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem' }
            }, [change.itemType || '']));

            // Identifier cell (SN for serialized, Part Number for bulk)
            const identifier = change.type === 'serialized' 
                ? (change.tilsonSn || change.manufacturerSn || '-')
                : (change.partNumber || '-');
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem', fontFamily: 'monospace' }
            }, [identifier]));

            // Current Quantity
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem', textAlign: 'right' }
            }, [change.currentQuantity.toString()]));

            // New Quantity
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem', textAlign: 'right', fontWeight: '600' }
            }, [change.newQuantity.toString()]));

            // Difference (colored)
            const diff = change.difference;
            const diffColor = diff > 0 ? '#059669' : '#dc2626';
            const diffText = diff > 0 ? `+${diff}` : diff.toString();
            row.appendChild(createElement('td', {
                style: { 
                    padding: '0.75rem', 
                    textAlign: 'right',
                    fontWeight: '600',
                    color: diffColor
                }
            }, [diffText]));

            // Status
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem' }
            }, [change.status || '']));

            // Location
            row.appendChild(createElement('td', {
                style: { padding: '0.75rem' }
            }, [change.location || '']));

            tbody.appendChild(row);
        });

        table.appendChild(tbody);
        return table;
    };

    /**
     * Apply quantity changes to inventory
     * @param {Array} changes - Array of selected change objects
     * @param {Function} progressCallback - Optional callback for progress updates (current, total, message, id, success)
     * @returns {Promise<Object>} { success: number, failed: number, errors: Array }
     */
    const applyQuantityChanges = async (changes, progressCallback = null) => {
        let success = 0;
        let failed = 0;
        const errors = [];

        for (let i = 0; i < changes.length; i++) {
            const change = changes[i];
            
            if (progressCallback) {
                progressCallback(i + 1, changes.length, `Updating ${change.itemType} (ID: ${change.id})...`, change.id);
            }
            
            try {
                // Get current inventory record first to capture before state
                const state = Store.getState();
                const currentInventory = state.inventory.find(inv => inv.id === change.id);
                
                if (!currentInventory) {
                    failed++;
                    errors.push({
                        id: change.id,
                        itemType: change.itemType,
                        error: 'Inventory record not found'
                    });
                    continue;
                }

                // Update inventory quantity directly (bypass consolidation logic)
                const result = await Database.update('inventory', change.id, {
                    quantity: change.newQuantity,
                    updated_at: getLocalTimestamp()
                });

                if (result.isOk) {
                    // Create transaction record for the quantity change
                    await Queries.createTransaction({
                        inventory_id: change.id,
                        transaction_type: 'Adjustment',
                        action: 'Import Quantity Adjustment',
                        item_type_name: change.itemType,
                        quantity: change.difference,
                        status_name: change.status,
                        to_location_name: change.location,
                        before_state: JSON.stringify({
                            quantity: change.currentQuantity,
                            status: change.status,
                            location: change.location
                        }),
                        after_state: JSON.stringify({
                            quantity: change.newQuantity,
                            status: change.status,
                            location: change.location
                        }),
                        notes: `Quantity ${change.difference > 0 ? 'increased' : 'decreased'} from ${change.currentQuantity} to ${change.newQuantity} via Excel import${change.type === 'serialized' ? ` (SN: ${change.tilsonSn || change.manufacturerSn || 'N/A'})` : ` (PN: ${change.partNumber || 'N/A'})`}`
                    });

                    success++;
                    
                    if (progressCallback) {
                        progressCallback(i + 1, changes.length, `✓ Updated ${change.itemType} (ID: ${change.id})`, change.id, true);
                    }
                } else {
                    failed++;
                    errors.push({
                        id: change.id,
                        itemType: change.itemType,
                        error: result.error
                    });
                    
                    if (progressCallback) {
                        progressCallback(i + 1, changes.length, `✗ Failed: ${change.itemType} (ID: ${change.id})`, change.id, false);
                    }
                }
            } catch (error) {
                failed++;
                errors.push({
                    id: change.id,
                    itemType: change.itemType,
                    error: error.message
                });
                
                if (progressCallback) {
                    progressCallback(i + 1, changes.length, `✗ Error: ${change.itemType} (ID: ${change.id})`, change.id, false);
                }
            }
        }

        return { success, failed, errors };
    };

    // Public API
    return {
        loadExcelFile,
        verifyExcelFileIsValid,
        getQuantityChanges,
        generateChangesTable,
        applyQuantityChanges
    };
})();

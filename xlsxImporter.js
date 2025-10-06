// ============================================================================
// XLSX IMPORT FUNCTIONALITY FOR ITEM_TYPES
// ============================================================================

/**
 * ITEM_TYPES field definitions for column mapping
 */
const ITEM_TYPES_FIELDS = {
    'name': { 
        label: 'Item Name', 
        required: true, 
        type: 'text',
        description: 'Required: The name/title of the item type'
    },
    'manufacturer': { 
        label: 'Manufacturer', 
        required: false, 
        type: 'text',
        description: 'Optional: The manufacturer of the item'
    },
    'part_number': { 
        label: 'Part Number', 
        required: false, 
        type: 'text',
        description: 'Optional: The manufacturer part number'
    },
    'description': { 
        label: 'Description', 
        required: false, 
        type: 'text',
        description: 'Optional: Detailed description of the item'
    },
    'units_per_package': { 
        label: 'Units per Package', 
        required: true, 
        type: 'number',
        description: 'Required: Number of units in a package (integer)'
    },
    'low_units_quantity': { 
        label: 'Low Units Quantity', 
        required: false, 
        type: 'number',
        description: 'Optional: Threshold for low inventory alerts'
    },
    'inventory_type_id': { 
        label: 'Inventory Type', 
        required: true, 
        type: 'lookup',
        table: 'INVENTORY_TYPES',
        description: 'Required: Type of inventory (Bulk/Serialized)'
    },
    'unit_of_measure_id': { 
        label: 'Unit of Measure', 
        required: true, 
        type: 'lookup',
        table: 'UNITS_OF_MEASURE',
        description: 'Required: Unit of measurement'
    },
    'provider_id': { 
        label: 'Provider', 
        required: true, 
        type: 'lookup',
        table: 'INVENTORY_PROVIDERS',
        description: 'Required: Inventory provider/supplier'
    },
    'category_id': { 
        label: 'Category', 
        required: false, 
        type: 'lookup',
        table: 'CATEGORIES',
        description: 'Optional: Item category'
    }
};

/**
 * Show the XLSX import modal for ITEM_TYPES
 */
window.showXlsxImportModal = function() {
    const modal = ModalUtils.createModal('xlsxImportModal', {
        title: 'Import Item Types from Excel',
        className: 'modal-base xlsx-import-modal',
        body: generateXlsxImportContent(),
        buttons: [
            { id: 'cancelXlsxImportBtn', text: 'Cancel', className: 'btn-secondary' },
            { id: 'executeXlsxImportBtn', text: 'Import Data', className: 'btn-primary', disabled: true }
        ]
    });

    // Setup event listeners
    ModalUtils.setupModalEvents(modal, {
        closeHandlers: ['cancelXlsxImportBtn'],
        executeHandler: { 
            id: 'executeXlsxImportBtn', 
            handler: executeXlsxImport 
        }
    });

    // Setup file upload handler
    setupFileUploadHandler();
};

/**
 * Generate the content for the XLSX import modal
 */
function generateXlsxImportContent() {
    return `
        <div class="modal-form-section">
            <!-- Step 1: File Upload -->
            <div class="import-step" id="step1">
                <h4>Step 1: Select Excel File</h4>
                <div class="modal-form-group">
                    <label for="xlsxFileInput">Choose .xlsx file:</label>
                    <input type="file" id="xlsxFileInput" accept=".xlsx,.xls" required>
                    <div class="file-info">
                        <em>Select an Excel file containing item types data</em>
                    </div>
                </div>
            </div>

            <!-- Step 2: Sheet Selection -->
            <div class="import-step" id="step2" style="display: none;">
                <h4>Step 2: Select Worksheet</h4>
                <div class="modal-form-group">
                    <label for="sheetSelect">Choose worksheet:</label>
                    <select id="sheetSelect" required>
                        <option value="">Select worksheet...</option>
                    </select>
                </div>
            </div>

            <!-- Step 3: Column Mapping -->
            <div class="import-step" id="step3" style="display: none;">
                <h4>Step 3: Map Columns</h4>
                <div class="column-mapping-container">
                    <div class="mapping-instructions">
                        <p>Map Excel columns to ITEM_TYPES fields. Required fields must be mapped. <strong>Market is now required.</strong></p>
                    </div>
                    <div id="columnMappingTable"></div>
                </div>
            </div>

            <!-- Step 4: Data Preview -->
            <div class="import-step" id="step4" style="display: none;">
                <h4>Step 4: Preview Data</h4>
                <div class="preview-container">
                    <div class="preview-info">
                        <span id="previewRowCount">0 rows ready for import</span>
                    </div>
                    <div id="dataPreviewTable"></div>
                </div>
            </div>

            <!-- Import Progress -->
            <div class="import-step" id="importProgress" style="display: none;">
                <h4>Import Progress</h4>
                <div class="progress-container">
                    <div class="progress-bar">
                        <div id="progressFill" style="width: 0%;"></div>
                    </div>
                    <div id="progressText">Preparing import...</div>
                    <div id="importResults"></div>
                </div>
            </div>
        </div>
    `;
}

/**
 * Setup file upload handler
 */
function setupFileUploadHandler() {
    const fileInput = document.getElementById('xlsxFileInput');
    const executeBtn = document.getElementById('executeXlsxImportBtn');
    
    fileInput.addEventListener('change', async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        try {
            // Show loading state
            document.getElementById('step2').style.display = 'none';
            document.getElementById('step3').style.display = 'none';
            document.getElementById('step4').style.display = 'none';
            executeBtn.disabled = true;

            // Read the Excel file
            const workbook = await readExcelFile(file);
            
            // Populate sheet selection
            populateSheetOptions(workbook);
            
            // Show step 2
            document.getElementById('step2').style.display = 'block';
            
            // Setup sheet selection handler
            setupSheetSelectionHandler(workbook);
            
        } catch (error) {
            console.error('Error reading Excel file:', error);
            alert('Error reading Excel file: ' + error.message);
        }
    });
}

/**
 * Read Excel file and return workbook
 */
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                resolve(workbook);
            } catch (error) {
                reject(error);
            }
        };
        
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

/**
 * Populate sheet selection dropdown
 */
function populateSheetOptions(workbook) {
    const sheetSelect = document.getElementById('sheetSelect');
    sheetSelect.innerHTML = '<option value="">Select worksheet...</option>';
    
    workbook.SheetNames.forEach(sheetName => {
        const option = document.createElement('option');
        option.value = sheetName;
        option.textContent = sheetName;
        sheetSelect.appendChild(option);
    });
}

/**
 * Setup sheet selection handler
 */
function setupSheetSelectionHandler(workbook) {
    const sheetSelect = document.getElementById('sheetSelect');
    
    sheetSelect.addEventListener('change', async (event) => {
        const sheetName = event.target.value;
        if (!sheetName) return;

        try {
            // Parse the selected sheet
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            
            if (jsonData.length === 0) {
                alert('Selected worksheet is empty');
                return;
            }

            // Store the data for later use
            window.xlsxImportData = {
                workbook,
                sheetName,
                rawData: jsonData,
                headers: jsonData[0] || []
            };

            // Generate column mapping interface
            generateColumnMappingInterface(jsonData[0] || []);
            
            // Show step 3
            document.getElementById('step3').style.display = 'block';
            
        } catch (error) {
            console.error('Error processing worksheet:', error);
            alert('Error processing worksheet: ' + error.message);
        }
    });
}

/**
 * Generate column mapping interface
 */
function generateColumnMappingInterface(excelHeaders) {
    const container = document.getElementById('columnMappingTable');
    
    let html = `
        <table class="mapping-table">
            <thead>
                <tr>
                    <th>ITEM_TYPES Field</th>
                    <th>Required</th>
                    <th>Excel Column</th>
                    <th>Description</th>
                </tr>
            </thead>
            <tbody>
    `;

    // Generate mapping rows for each ITEM_TYPES field
    Object.entries(ITEM_TYPES_FIELDS).forEach(([fieldName, fieldInfo]) => {
        html += `
            <tr class="${fieldInfo.required ? 'required-field' : ''}">
                <td><strong>${fieldInfo.label}</strong></td>
                <td>${fieldInfo.required ? '<span class="required-indicator">*</span>' : ''}</td>
                <td>
                    <select class="column-mapping-select" data-field="${fieldName}">
                        <option value="">-- Select Column --</option>
                        ${excelHeaders.map((header, index) => 
                            `<option value="${index}">${header || `Column ${index + 1}`}</option>`
                        ).join('')}
                    </select>
                </td>
                <td class="field-description">${fieldInfo.description}</td>
            </tr>
        `;
    });

    html += `
            </tbody>
        </table>
        <div class="mapping-actions">
            <button type="button" id="autoMapBtn" class="btn-secondary">Auto-Map Columns</button>
            <button type="button" id="previewMappingBtn" class="btn-primary" disabled>Preview Data</button>
        </div>
    `;

    container.innerHTML = html;

    // Setup mapping event handlers
    setupMappingEventHandlers();
}

/**
 * Setup event handlers for column mapping
 */
function setupMappingEventHandlers() {
    const mappingSelects = document.querySelectorAll('.column-mapping-select');
    const previewBtn = document.getElementById('previewMappingBtn');
    const autoMapBtn = document.getElementById('autoMapBtn');

    // Auto-map button
    autoMapBtn.addEventListener('click', autoMapColumns);

    // Preview button
    previewBtn.addEventListener('click', generateDataPreview);

    // Validate mapping when selections change
    mappingSelects.forEach(select => {
        select.addEventListener('change', validateColumnMapping);
    });

    // Initial validation
    validateColumnMapping();
}

/**
 * Auto-map columns based on header names
 */
function autoMapColumns() {
    const headers = window.xlsxImportData.headers;
    const mappingSelects = document.querySelectorAll('.column-mapping-select');

    // Create mapping based on common patterns - updated to match our template exactly
    const autoMappings = {
        'name': ['name', 'item name', 'item_name', 'item name*', 'title', 'product name'],
        'manufacturer': ['manufacturer', 'mfg', 'mfgr', 'maker', 'brand'],
        'part_number': ['part number', 'part_number', 'part', 'model', 'pn'],
        'description': ['description', 'desc', 'details', 'notes'],
        'units_per_package': ['units per package', 'units_per_package', 'units per package*', 'package size', 'qty', 'quantity'],
        'low_units_quantity': ['low units quantity', 'low_units_quantity', 'low quantity', 'min quantity', 'threshold'],
        'inventory_type_id': ['inventory type', 'inventory_type', 'inventory type*', 'type', 'inv type'],
        'unit_of_measure_id': ['unit of measure', 'unit_of_measure', 'unit of measure*', 'uom', 'unit'],
        'provider_id': ['provider', 'provider*', 'supplier', 'vendor'],
        'category_id': ['category', 'cat', 'type category']
    };

    mappingSelects.forEach(select => {
        const fieldName = select.dataset.field;
        const patterns = autoMappings[fieldName];
        
        if (patterns) {
            const headerIndex = headers.findIndex(header => {
                const normalizedHeader = (header || '').toString().toLowerCase().trim();
                return patterns.some(pattern => normalizedHeader === pattern || normalizedHeader.includes(pattern));
            });

            if (headerIndex !== -1) {
                select.value = headerIndex;
            }
        }
    });

    // Validate after auto-mapping
    validateColumnMapping();
}

/**
 * Validate column mapping
 */
function validateColumnMapping() {
    const mappingSelects = document.querySelectorAll('.column-mapping-select');
    const previewBtn = document.getElementById('previewMappingBtn');
    const executeBtn = document.getElementById('executeXlsxImportBtn');
    
    let isValid = true;
    const mappings = {};
    const usedColumns = new Set();

    mappingSelects.forEach(select => {
        const fieldName = select.dataset.field;
        const fieldInfo = ITEM_TYPES_FIELDS[fieldName];
        const columnIndex = select.value;

        if (columnIndex !== '') {
            // Check for duplicate column usage
            if (usedColumns.has(columnIndex)) {
                isValid = false;
                select.style.borderColor = 'red';
                return;
            }
            usedColumns.add(columnIndex);
            mappings[fieldName] = parseInt(columnIndex);
            select.style.borderColor = '';
        } else if (fieldInfo.required) {
            // Required field not mapped
            isValid = false;
            select.style.borderColor = 'red';
        } else {
            select.style.borderColor = '';
        }
    });

    // Store mappings
    if (window.xlsxImportData) {
        window.xlsxImportData.columnMappings = mappings;
    }

    previewBtn.disabled = !isValid;
    executeBtn.disabled = true; // Will be enabled after preview
}

/**
 * Generate data preview
 */
async function generateDataPreview() {
    try {
        const { rawData, columnMappings } = window.xlsxImportData;
        const dataRows = rawData.slice(1); // Skip header row
        
        // Process and validate data
        const processedData = await processImportData(dataRows, columnMappings);
        
        // Display preview
        displayDataPreview(processedData);
        
        // Show step 4
        document.getElementById('step4').style.display = 'block';
        
        // Enable import button if data is valid
        const executeBtn = document.getElementById('executeXlsxImportBtn');
        executeBtn.disabled = processedData.validRows.length === 0;
        
    } catch (error) {
        console.error('Error generating preview:', error);
        alert('Error generating preview: ' + error.message);
    }
}

/**
 * Process import data and validate
 */
async function processImportData(dataRows, columnMappings) {
    const validRows = [];
    const errorRows = [];
    
    // Get lookup data for foreign key validation
    const lookupData = await getImportLookupData();
    
    dataRows.forEach((row, index) => {
        const processedRow = { originalIndex: index + 2 }; // +2 for header and 0-based index
        const errors = [];
        
        // Process each mapped field
        Object.entries(columnMappings).forEach(([fieldName, columnIndex]) => {
            const fieldInfo = ITEM_TYPES_FIELDS[fieldName];
            const rawValue = row[columnIndex];
            
            try {
                const processedValue = processFieldValue(rawValue, fieldInfo, lookupData);
                processedRow[fieldName] = processedValue;
            } catch (error) {
                errors.push(`${fieldInfo.label}: ${error.message}`);
            }
        });
        
        // Validate required fields
        Object.entries(ITEM_TYPES_FIELDS).forEach(([fieldName, fieldInfo]) => {
            if (fieldInfo.required && !processedRow.hasOwnProperty(fieldName)) {
                errors.push(`${fieldInfo.label}: Required field not mapped`);
            }
        });
        
        if (errors.length === 0) {
            validRows.push(processedRow);
        } else {
            errorRows.push({ ...processedRow, errors });
        }
    });
    
    return { validRows, errorRows, lookupData };
}

/**
 * Get lookup data for foreign key validation during import
 */
function getImportLookupData() {
    const lookupData = {};
    const lookupTables = ['inventory_types', 'units_of_measure', 'inventory_providers', 'categories', 'markets'];
    for (const table of lookupTables) {
        const rows = getCachedTable(table);
        lookupData[table.toUpperCase()] = {};
        if (rows && rows.length > 0) {
            rows.forEach(({ id, name }) => {
                if (name) {
                    lookupData[table.toUpperCase()][name.toLowerCase()] = id;
                }
            });
        }
    }
    return lookupData;
}

/**
 * Process individual field value
 */
function processFieldValue(rawValue, fieldInfo, lookupData) {
    if (rawValue === undefined || rawValue === null || rawValue === '') {
        if (fieldInfo.required) {
            throw new Error('Required field is empty');
        }
        return null;
    }
    
    const stringValue = rawValue.toString().trim();
    
    switch (fieldInfo.type) {
        case 'text':
            return stringValue;
            
        case 'number':
            const numValue = parseFloat(stringValue);
            if (isNaN(numValue)) {
                throw new Error('Must be a valid number');
            }
            return Math.floor(numValue); // Convert to integer for units_per_package
            
        case 'lookup':
            const lookupTable = lookupData[fieldInfo.table];
            if (!lookupTable) {
                throw new Error(`Lookup table ${fieldInfo.table} not found`);
            }
            
            const lookupKey = stringValue.toLowerCase();
            const lookupId = lookupTable[lookupKey];
            
            if (!lookupId) {
                const availableValues = Object.keys(lookupTable).join(', ');
                throw new Error(`Value "${stringValue}" not found. Available: ${availableValues}`);
            }
            
            return lookupId;
            
        default:
            return stringValue;
    }
}

/**
 * Display data preview
 */
function displayDataPreview(processedData) {
    const previewContainer = document.getElementById('dataPreviewTable');
    const rowCountSpan = document.getElementById('previewRowCount');
    
    const { validRows, errorRows } = processedData;
    
    // Update row count
    rowCountSpan.textContent = `${validRows.length} valid rows, ${errorRows.length} rows with errors`;
    
    // Generate preview table
    let html = `
        <div class="preview-tabs">
            <button class="preview-tab active" data-tab="valid">Valid Data (${validRows.length})</button>
            <button class="preview-tab" data-tab="errors">Errors (${errorRows.length})</button>
        </div>
        <div class="preview-content">
    `;
    
    // Valid data preview
    html += generatePreviewTable('valid', validRows.slice(0, 10), false);
    
    // Error data preview
    html += generatePreviewTable('errors', errorRows.slice(0, 10), true);
    
    html += '</div>';
    
    previewContainer.innerHTML = html;
    
    // Setup tab switching
    setupPreviewTabs();
    
    // Store processed data
    window.xlsxImportData.processedData = processedData;
}

/**
 * Generate preview table HTML
 */
function generatePreviewTable(tabId, rows, showErrors) {
    const displayStyle = tabId === 'valid' ? 'block' : 'none';
    
    if (rows.length === 0) {
        return `
            <div class="preview-table-container" data-tab="${tabId}" style="display: ${displayStyle};">
                <p>No ${tabId === 'valid' ? 'valid' : 'error'} rows to display</p>
            </div>
        `;
    }
    
    let html = `
        <div class="preview-table-container" data-tab="${tabId}" style="display: ${displayStyle};">
            <table class="preview-table">
                <thead>
                    <tr>
                        <th>Row</th>
    `;
    
    // Add headers for mapped fields
    Object.entries(ITEM_TYPES_FIELDS).forEach(([fieldName, fieldInfo]) => {
        html += `<th>${fieldInfo.label}</th>`;
    });
    
    if (showErrors) {
        html += '<th>Errors</th>';
    }
    
    html += '</tr></thead><tbody>';
    
    // Add data rows
    rows.forEach(row => {
        html += `<tr>`;
        html += `<td>${row.originalIndex}</td>`;
        
        Object.keys(ITEM_TYPES_FIELDS).forEach(fieldName => {
            const value = row[fieldName];
            html += `<td>${value !== null && value !== undefined ? value : ''}</td>`;
        });
        
        if (showErrors) {
            html += `<td class="error-cell">${row.errors ? row.errors.join('<br>') : ''}</td>`;
        }
        
        html += '</tr>';
    });
    
    html += '</tbody></table>';
    
    if (rows.length >= 10) {
        html += '<p class="preview-note">Showing first 10 rows only</p>';
    }
    
    html += '</div>';
    
    return html;
}

/**
 * Setup preview tab functionality
 */
function setupPreviewTabs() {
    const tabs = document.querySelectorAll('.preview-tab');
    const containers = document.querySelectorAll('.preview-table-container');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update tab states
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Update container visibility
            containers.forEach(container => {
                container.style.display = container.dataset.tab === targetTab ? 'block' : 'none';
            });
        });
    });
}

/**
 * Execute the XLSX import
 */
async function executeXlsxImport() {
    try {
        const { processedData } = window.xlsxImportData;
        const { validRows } = processedData;
        
        if (validRows.length === 0) {
            alert('No valid rows to import');
            return;
        }
        
        // Show progress
        showImportProgress();
        
        // Import data
        const results = await importItemTypes(validRows);
        
        // Show results
        displayImportResults(results);
        
        // Refresh the table manager if visible
        if (window.refreshAllTables) {
            console.log('Calling refreshAllTables...');
            window.refreshAllTables();
        } else {
            console.warn('refreshAllTables function not available');
        }
        
        // Refresh dropdowns to include newly imported item types
        if (window.refreshDropdowns) {
            console.log('Calling refreshDropdowns after XLSX import...');
            window.refreshDropdowns();
        } else {
            console.warn('refreshDropdowns function not available');
        }
        
    } catch (error) {
        console.error('Import error:', error);
        alert('Import failed: ' + error.message);
    }
}

/**
 * Show import progress
 */
function showImportProgress() {
    // Hide other steps
    document.querySelectorAll('.import-step').forEach(step => {
        step.style.display = 'none';
    });
    
    // Show progress step
    document.getElementById('importProgress').style.display = 'block';
    
    // Disable buttons
    document.getElementById('executeXlsxImportBtn').disabled = true;
}

/**
 * Import item types data
 */
async function importItemTypes(validRows) {
    const results = { success: 0, failed: 0, errors: [] };
    const total = validRows.length;

    for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];

        try {
            // Update progress
            updateProgress((i / total) * 100, `Importing row ${i + 1} of ${total}...`);

            // Prepare the row for Supabase insert
            // Only include fields that are present in the row and defined in ITEM_TYPES_FIELDS
            const fields = Object.keys(ITEM_TYPES_FIELDS).filter(field => row.hasOwnProperty(field));
            const insertObj = {};
            fields.forEach(field => {
                insertObj[field] = row[field];
            });

            // Add market_id if available (required for Supabase)
            if (row.market_id) {
                insertObj.market_id = row.market_id;
            } else if (window.selectedMarketId) {
                insertObj.market_id = window.selectedMarketId;
            }

            // Insert into Supabase
            const { error } = await supabase
                .from('ITEM_TYPES')
                .insert([insertObj]);

            if (error) {
                throw new Error(error.message);
            }

            results.success++;
        } catch (error) {
            console.error(`Error importing row ${row.originalIndex}:`, error);
            results.failed++;
            results.errors.push(`Row ${row.originalIndex}: ${error.message}`);
        }
    }

    // Final progress update
    updateProgress(100, 'Import completed!');

    return results;
}

/**
 * Update progress display
 */
function updateProgress(percentage, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressFill.style.width = `${percentage}%`;
    progressText.textContent = text;
}

/**
 * Display import results
 */
function displayImportResults(results) {
    const resultsContainer = document.getElementById('importResults');
    
    let html = `
        <div class="import-summary">
            <h5>Import Complete</h5>
            <div class="result-stats">
                <span class="success-count">✓ ${results.success} records imported successfully</span>
                ${results.failed > 0 ? `<span class="error-count">✗ ${results.failed} records failed</span>` : ''}
            </div>
    `;
    
    if (results.errors.length > 0) {
        html += `
            <div class="error-details">
                <h6>Errors:</h6>
                <ul>
                    ${results.errors.map(error => `<li>${error}</li>`).join('')}
                </ul>
            </div>
        `;
    }
    
    html += `
            <div class="result-actions">
                <button type="button" id="closeImportModalBtn" class="btn-primary">Close</button>
            </div>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    // Setup close button
    document.getElementById('closeImportModalBtn').addEventListener('click', () => {
        ModalUtils.closeModal('xlsxImportModal');
    });
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Close XLSX import modal
 */
window.closeXlsxImportModal = function() {
    ModalUtils.closeModal('xlsxImportModal');
    
    // Clean up stored data
    if (window.xlsxImportData) {
        delete window.xlsxImportData;
    }
};

/**
 * Generate and download Excel template for ITEM_TYPES
 */
/**
 * Generate template with proper data validation using ExcelJS
 */
window.generateExcelTemplateWithValidation = async function() {
    try {
        // Create a new workbook using ExcelJS
        const workbook = new ExcelJS.Workbook();
        
        // Create main worksheet
        const worksheet = workbook.addWorksheet('ITEM_TYPES_Import');
        
        // Define headers (add Market)
        const headers = [
            'Item Name*',
            'Manufacturer',
            'Part Number', 
            'Description',
            'Units per Package*',
            'Low Units Quantity',
            'Inventory Type*',
            'Unit of Measure*',
            'Provider*',
            'Category',
            'Market*'
        ];
        
        // Add headers
        worksheet.addRow(headers);
        
        // Style the header row
        const headerRow = worksheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Set column widths
        worksheet.columns = [
            { width: 25 }, // Item Name
            { width: 20 }, // Manufacturer
            { width: 15 }, // Part Number
            { width: 35 }, // Description
            { width: 18 }, // Units per Package
            { width: 18 }, // Low Units Quantity
            { width: 18 }, // Inventory Type
            { width: 20 }, // Unit of Measure
            { width: 20 }, // Provider
            { width: 18 }, // Category
            { width: 20 }  // Market
        ];
        
        // Get validation data
        const inventoryTypes = getValidationValues('inventory_types');
        const unitsOfMeasure = getValidationValues('units_of_measure');
        const providers = getValidationValues('inventory_providers');
        const categories = getValidationValues('categories');
        const markets = getValidationValues('markets');

        // Add sample data
        const sampleRows = [
            ['5/8" Bolt', 'ACME, INC.', 'BOLT-12', 'Bolt, 5/8, 304 stainless, 12in', '1', '2', 'Bulk', 'Each', 'ITG', 'Hardware', 'EACAMS'],
            ['5/8" Bolt', 'ACME, INC.', 'BOLT-14', 'Bolt, 5/8, 304 stainless, 14in', '1', '2', 'Bulk', 'Each', 'ITG', 'Hardware', 'EACAMS']
        ];
        
        sampleRows.forEach(row => {
            worksheet.addRow(row);
        });
        
        // Add data validation for Inventory Type column (G)
        if (inventoryTypes.length > 0) {
            worksheet.getColumn('G').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${inventoryTypes.join(',')}"`],
                        showErrorMessage: true,
                        errorStyle: 'error',
                        errorTitle: 'Invalid Inventory Type',
                        error: 'Please select a valid inventory type from the dropdown list.'
                    };
                }
            });
        }
        
        // Add data validation for Unit of Measure column (H)
        if (unitsOfMeasure.length > 0) {
            worksheet.getColumn('H').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${unitsOfMeasure.join(',')}"`],
                        showErrorMessage: true,
                        errorStyle: 'error',
                        errorTitle: 'Invalid Unit of Measure',
                        error: 'Please select a valid unit of measure from the dropdown list.'
                    };
                }
            });
        }
        
        // Add data validation for Provider column (I)
        if (providers.length > 0) {
            worksheet.getColumn('I').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${providers.join(',')}"`],
                        showErrorMessage: true,
                        errorStyle: 'error',
                        errorTitle: 'Invalid Provider',
                        error: 'Please select a valid provider from the dropdown list.'
                    };
                }
            });
        }
        
        // Add data validation for Category column (J)
        if (categories.length > 0) {
            worksheet.getColumn('J').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: true,
                        formulae: [`"${categories.join(',')}"`],
                        showErrorMessage: true,
                        errorStyle: 'error',
                        errorTitle: 'Invalid Category',
                        error: 'Please select a valid category from the dropdown list.'
                    };
                }
            });
        }

        // Add data validation for Market column (K)
        if (markets.length > 0) {
            worksheet.getColumn('K').eachCell({ includeEmpty: true }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.dataValidation = {
                        type: 'list',
                        allowBlank: false,
                        formulae: [`"${markets.join(',')}"`],
                        showErrorMessage: true,
                        errorStyle: 'error',
                        errorTitle: 'Invalid Market',
                        error: 'Please select a valid market from the dropdown list.'
                    };
                }
            });
        }
        
        // Add validation to additional rows (up to row 1000)
        for (let row = worksheet.rowCount + 1; row <= 1000; row++) {
            if (inventoryTypes.length > 0) {
                worksheet.getCell(`G${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${inventoryTypes.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Inventory Type',
                    error: 'Please select a valid inventory type from the dropdown list.'
                };
            }
            
            if (unitsOfMeasure.length > 0) {
                worksheet.getCell(`H${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${unitsOfMeasure.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Unit of Measure',
                    error: 'Please select a valid unit of measure from the dropdown list.'
                };
            }
            
            if (providers.length > 0) {
                worksheet.getCell(`I${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${providers.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Provider',
                    error: 'Please select a valid provider from the dropdown list.'
                };
            }
            
            if (categories.length > 0) {
                worksheet.getCell(`J${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: [`"${categories.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Category',
                    error: 'Please select a valid category from the dropdown list.'
                };
            }

            if (markets.length > 0) {
                worksheet.getCell(`K${row}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${markets.join(',')}"`],
                    showErrorMessage: true,
                    errorStyle: 'error',
                    errorTitle: 'Invalid Market',
                    error: 'Please select a valid market from the dropdown list.'
                };
            }
        }
        
        // Create instructions worksheet
        const instructionsWs = workbook.addWorksheet('Instructions');
        
        // Create existing item types worksheet
        const existingItemTypesWs = workbook.addWorksheet('Existing Item Types');
        
        // Get existing item types from database
        const existingItemTypes = getExistingItemTypesForTemplate();
        
        // Create existing item types data
        const existingItemTypesHeaders = [
            'ID',
            'Item Name',
            'Manufacturer',
            'Part Number', 
            'Description',
            'Units per Package',
            'Low Units Quantity',
            'Inventory Type',
            'Unit of Measure',
            'Provider',
            'Category'
        ];
        
        const existingItemTypesData = [existingItemTypesHeaders, ...existingItemTypes];
        
        // Populate existing item types worksheet
        existingItemTypesData.forEach((row, index) => {
            existingItemTypesWs.addRow(row);
        });
        
        // Style the existing item types header
        const existingHeaderRow = existingItemTypesWs.getRow(1);
        existingHeaderRow.font = { bold: true };
        existingHeaderRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD0E7FF' } // Light blue background
        };
        
        // Set column widths for existing item types
        existingItemTypesWs.columns = [
            { width: 8 },  // ID
            { width: 25 }, // Item Name
            { width: 20 }, // Manufacturer
            { width: 15 }, // Part Number
            { width: 35 }, // Description
            { width: 18 }, // Units per Package
            { width: 18 }, // Low Units Quantity
            { width: 18 }, // Inventory Type
            { width: 20 }, // Unit of Measure
            { width: 20 }, // Provider
            { width: 18 }  // Category
        ];
        
        const instructionsData = [
            ['ITEM TYPES IMPORT TEMPLATE WITH DATA VALIDATION'],
            [''],
            ['Instructions:'],
            ['1. Fill in your item types data in the "ITEM_TYPES_Import" sheet'],
            ['2. Required fields are marked with * in the header'],
            ['3. Use the dropdown arrows in columns G, H, I, and J for validation'],
            ['4. Dropdown columns have data validation to prevent errors'],
            ['5. Check the "Existing Item Types" sheet to see what items already exist'],
            [''],
            ['Sheet Descriptions:'],
            ['- ITEM_TYPES_Import: Main sheet for adding new item types'],
            ['- Instructions: This sheet with detailed guidance'],
            ['- Existing Item Types: Reference sheet showing all current item types in your database'],
            [''],
            ['Required Fields:'],
            ['- Item Name: The name/title of the item type'],
            ['- Units per Package: Number of units in a package (must be a number)'],
            ['- Inventory Type: Select from dropdown (Bulk/Serialized)'],
            ['- Unit of Measure: Select from dropdown (existing units in your system)'],
            ['- Provider: Select from dropdown (existing providers in your system)'],
            [''],
            ['Optional Fields:'],
            ['- Manufacturer: The manufacturer of the item'],
            ['- Part Number: The manufacturer part number'],
            ['- Description: Detailed description of the item'],
            ['- Low Units Quantity: Threshold for low inventory alerts (must be a number)'],
            ['- Category: Select from dropdown (existing categories in your system)'],
            [''],
            ['Data Validation Features:'],
            ['- Columns G, H, I, J have dropdown validation'],
            ['- Invalid entries will show error messages'],
            ['- Dropdown lists are populated from your database'],
            ['- Check existing items to avoid duplicates'],
            [''],
            ['Available Values:'],
            [''],
            ['Inventory Types:'],
            ...inventoryTypes.map(v => [`  - ${v}`]),
            [''],
            ['Units of Measure:'],
            ...unitsOfMeasure.map(v => [`  - ${v}`]),
            [''],
            ['Providers:'],
            ...providers.map(v => [`  - ${v}`]),
            [''],
            ['Categories:'],
            ...categories.map(v => [`  - ${v}`])
        ];
        
        instructionsData.forEach((row, index) => {
            instructionsWs.addRow(row);
        });
        
        // Style instructions
        instructionsWs.getColumn(1).width = 60;
        const titleRow = instructionsWs.getRow(1);
        titleRow.font = { bold: true, size: 14 };
        
        // Generate and download file
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `ItemTypes_Import_Template_WithValidation_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        alert('Enhanced template with data validation downloaded successfully!\n\n' +
              'Features:\n' +
              '• Dropdown validation in columns G, H, I, J\n' +
              '• "Existing Item Types" sheet shows current database items\n' +
              '• Instructions sheet with detailed guidance\n' +
              '• Sample data to help you get started\n\n' +
              'Use "Manage Item Types" button in the sidebar for manual edits.');
        
    } catch (error) {
        console.error('Error generating enhanced template:', error);
        alert('Error generating enhanced template: ' + error.message);
    }
};

/**
 * Original template generation function using SheetJS (kept for compatibility)
 */
window.generateExcelTemplate = function() {
    try {
        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Prepare template data
        const headers = [
            'Item Name',
            'Manufacturer', 
            'Part Number',
            'Description',
            'Units per Package',
            'Low Units Quantity',
            'Inventory Type',
            'Unit of Measure',
            'Provider',
            'Category'
        ];
        
        // Add sample data rows
        const sampleData = [
            [
                'Sample Cable',
                'ACME Corp',
                'CAB-001',
                'High-quality ethernet cable',
                '100',
                '50',
                'Bulk',
                'Each',
                'Main Supplier',
                'Cables'
            ],
            [
                'Sample Router',
                'TechCorp',
                'RTR-500',
                'Enterprise grade router',
                '1',
                '5',
                'Serialized',
                'Each',
                'Main Supplier',
                'Network Equipment'
            ]
        ];
        
        // Combine headers with sample data
        const wsData = [headers, ...sampleData];
        
        // Create worksheet
        const ws = XLSX.utils.aoa_to_sheet(wsData);
        
        // Set column widths
        const colWidths = [
            {wch: 20}, // Item Name
            {wch: 15}, // Manufacturer
            {wch: 15}, // Part Number
            {wch: 30}, // Description
            {wch: 18}, // Units per Package
            {wch: 18}, // Low Units Quantity
            {wch: 15}, // Inventory Type
            {wch: 15}, // Unit of Measure
            {wch: 15}, // Provider
            {wch: 15}  // Category
        ];
        ws['!cols'] = colWidths;
        
        // Get available values for data validation
        const inventoryTypes = getValidationValues('INVENTORY_TYPES');
        const unitsOfMeasure = getValidationValues('UNITS_OF_MEASURE');
        const providers = getValidationValues('INVENTORY_PROVIDERS');
        const categories = getValidationValues('CATEGORIES');
        
        // Add data validation to worksheet
        if (!ws['!dataValidation']) ws['!dataValidation'] = [];
        
        // Add validation for Inventory Type column (G2:G1000)
        if (inventoryTypes.length > 0) {
            ws['!dataValidation'].push({
                sqref: 'G2:G1000',
                type: 'list',
                formula1: `InventoryTypes_Ref!$A$2:$A$${inventoryTypes.length + 1}`,
                showErrorMessage: true,
                errorTitle: 'Invalid Inventory Type',
                error: 'Please select a valid inventory type from the dropdown list.',
                showDropDown: true
            });
        }
        
        // Add validation for Unit of Measure column (H2:H1000)
        if (unitsOfMeasure.length > 0) {
            ws['!dataValidation'].push({
                sqref: 'H2:H1000',
                type: 'list',
                formula1: `Units_Ref!$A$2:$A$${unitsOfMeasure.length + 1}`,
                showErrorMessage: true,
                errorTitle: 'Invalid Unit of Measure',
                error: 'Please select a valid unit of measure from the dropdown list.',
                showDropDown: true
            });
        }
        
        // Add validation for Provider column (I2:I1000)
        if (providers.length > 0) {
            ws['!dataValidation'].push({
                sqref: 'I2:I1000',
                type: 'list',
                formula1: `Providers_Ref!$A$2:$A$${providers.length + 1}`,
                showErrorMessage: true,
                errorTitle: 'Invalid Provider',
                error: 'Please select a valid provider from the dropdown list.',
                showDropDown: true
            });
        }
        
        // Add validation for Category column (J2:J1000)
        if (categories.length > 0) {
            ws['!dataValidation'].push({
                sqref: 'J2:J1000',
                type: 'list',
                formula1: `Categories_Ref!$A$2:$A$${categories.length + 1}`,
                showErrorMessage: true,
                errorTitle: 'Invalid Category',
                error: 'Please select a valid category from the dropdown list.',
                showDropDown: true
            });
        }
        
        // Create data validation for dropdown columns
        // Note: SheetJS has limited data validation support, so we'll add reference sheets
        
        // Create reference sheets for validation data
        const inventoryTypesWs = XLSX.utils.aoa_to_sheet([['Inventory Types'], ...inventoryTypes.map(v => [v])]);
        const unitsWs = XLSX.utils.aoa_to_sheet([['Units of Measure'], ...unitsOfMeasure.map(v => [v])]);
        const providersWs = XLSX.utils.aoa_to_sheet([['Providers'], ...providers.map(v => [v])]);
        const categoriesWs = XLSX.utils.aoa_to_sheet([['Categories'], ...categories.map(v => [v])]);
        
        // Add reference sheets (these will be used for validation in Excel)
        XLSX.utils.book_append_sheet(wb, inventoryTypesWs, 'InventoryTypes_Ref');
        XLSX.utils.book_append_sheet(wb, unitsWs, 'Units_Ref');
        XLSX.utils.book_append_sheet(wb, providersWs, 'Providers_Ref');
        XLSX.utils.book_append_sheet(wb, categoriesWs, 'Categories_Ref');
        
        // Add the main worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Item Types');
        
        // Create instructions sheet
        const instructionsData = [
            ['ITEM TYPES IMPORT TEMPLATE'],
            [''],
            ['Instructions:'],
            ['1. Fill in your item types data in the "Item Types" sheet'],
            ['2. Required fields: Item Name, Units per Package, Inventory Type, Unit of Measure, Provider'],
            ['3. Optional fields: Manufacturer, Part Number, Description, Low Units Quantity, Category'],
            ['4. Use the dropdown arrows in Inventory Type, Unit of Measure, Provider, and Category columns'],
            ['5. Reference sheets contain valid values for dropdown columns'],
            [''],
            ['Data Validation:'],
            ['- Inventory Type: Select from dropdown (Bulk/Serialized)'],
            ['- Unit of Measure: Select from dropdown (existing units in your system)'],
            ['- Provider: Select from dropdown (existing providers in your system)'],
            ['- Category: Select from dropdown (existing categories in your system)'],
            [''],
            ['Field Descriptions:'],
            ['Item Name: The name/title of the item type (Required)'],
            ['Manufacturer: The manufacturer of the item (Optional)'],
            ['Part Number: The manufacturer part number (Optional)'],
            ['Description: Detailed description of the item (Optional)'],
            ['Units per Package: Number of units in a package - must be a number (Required)'],
            ['Low Units Quantity: Threshold for low inventory alerts - must be a number (Optional)'],
            ['Inventory Type: Select from dropdown - Bulk or Serialized (Required)'],
            ['Unit of Measure: Select from dropdown - must match existing units (Required)'],
            ['Provider: Select from dropdown - must match existing providers (Required)'],
            ['Category: Select from dropdown - must match existing categories (Optional)'],
            [''],
            ['Available Values:'],
            [''],
            ['Inventory Types:'],
            ...getAvailableValues('inventory_types'),
            [''],
            ['Units of Measure:'],
            ...getAvailableValues('units_of_measure'),
            [''],
            ['Providers:'],
            ...getAvailableValues('inventory_providers'),
            [''],
            ['Categories:'],
            ...getAvailableValues('categories')
        ];
        
        const instructionsWs = XLSX.utils.aoa_to_sheet(instructionsData);
        instructionsWs['!cols'] = [{wch: 50}];
        XLSX.utils.book_append_sheet(wb, instructionsWs, 'Instructions');
        
        // Generate file and download
        const fileName = `ItemTypes_Import_Template_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        alert('Template downloaded successfully! Check your Downloads folder.');
        
    } catch (error) {
        console.error('Error generating template:', error);
        alert('Error generating template: ' + error.message);
    }
};

/**
 * Get available values for lookup tables using Supabase
 * Returns an array of formatted strings for display in the template
 */
function getAvailableValues(tableName) {
    const rows = getCachedTable(tableName.toLowerCase());
    if (!rows || rows.length === 0) return [['  - (No values found)']];
    return rows.map(row => [`  - ${row.name}`]);
}

/**
 * Get existing item types for template reference using Supabase
 */
async function getExistingItemTypesForTemplate() {
    try {
        const { data, error } = await supabase
            .from('ITEM_TYPES')
            .select(`
                id,
                name,
                manufacturer,
                part_number,
                description,
                units_per_package,
                low_units_quantity,
                INVENTORY_TYPES(name),
                UNITS_OF_MEASURE(name),
                INVENTORY_PROVIDERS(name),
                CATEGORIES(name)
            `)
            .order('name', { ascending: true });

        if (error) {
            console.warn('Error loading existing item types for template:', error);
            return [];
        }

        if (data && data.length > 0) {
            return data.map(row => [
                row.id || '',
                row.name || '',
                row.manufacturer || '',
                row.part_number || '',
                row.description || '',
                row.units_per_package || '',
                row.low_units_quantity || '',
                row.INVENTORY_TYPES?.name || '',
                row.UNITS_OF_MEASURE?.name || '',
                row.INVENTORY_PROVIDERS?.name || '',
                row.CATEGORIES?.name || ''
            ]);
        }

        return [];
    } catch (error) {
        console.warn('Error loading existing item types for template:', error);
        return [];
    }
}

/**
 * Get validation values as plain array for Excel data validation using Supabase
 */
function getValidationValues(tableName) {
    // Use lowercase for cache
    const rows = getCachedTable(tableName.toLowerCase());
    return rows && rows.length > 0 ? rows.map(row => row.name) : [];
}

// ============================================================================
// EXPORT TEMPLATE FUNCTIONALITY
// ============================================================================

/**
 * Export template function for backward compatibility
 * This is the function that script.js calls when the export template button is clicked
 */
window.exportTemplate = function() {
    // Use the enhanced template function that includes data validation
    if (typeof window.generateExcelTemplateWithValidation === 'function') {
        window.generateExcelTemplateWithValidation();
    } else if (typeof window.generateExcelTemplate === 'function') {
        // Fallback to basic template if enhanced version not available
        window.generateExcelTemplate();
    } else {
        alert('Template export functionality not available');
    }
};

/**
 * Import from Excel function for backward compatibility
 * This is the function that script.js calls when the import Excel button is clicked
 */
window.importFromExcel = function() {
    // Use the XLSX import modal function
    if (typeof window.showXlsxImportModal === 'function') {
        window.showXlsxImportModal();
    } else {
        alert('Import Excel functionality not available');
    }
};

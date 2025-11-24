/**
 * Import Item Types Service
 * Handles importing item types from Excel templates
 */

const ImportItemTypesService = (() => {
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
     * Verify that the Excel file is a valid Item Types template
     * @param {Object} workbook - ExcelJS workbook
     * @returns {Object} { isValid: boolean, error: string }
     */
    const verifyExcelFileIsValid = (workbook) => {
        // Check if NEW_ITEM_TYPES sheet exists
        const newItemsSheet = workbook.getWorksheet('NEW_ITEM_TYPES');
        if (!newItemsSheet) {
            return { 
                isValid: false, 
                error: 'Template is invalid: NEW_ITEM_TYPES sheet not found' 
            };
        }

        // Expected column names
        const expectedColumns = [
            'Name',
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

        // Get actual column names from first row
        const headerRow = newItemsSheet.getRow(1);
        const actualColumns = [];
        headerRow.eachCell((cell, colNumber) => {
            actualColumns.push(cell.value);
        });

        // Verify columns match
        for (let i = 0; i < expectedColumns.length; i++) {
            if (actualColumns[i] !== expectedColumns[i]) {
                return {
                    isValid: false,
                    error: `Template is invalid: Column ${i + 1} should be "${expectedColumns[i]}" but found "${actualColumns[i]}"`
                };
            }
        }

        return { isValid: true, error: null };
    };

    /**
     * Get new item type row values from the sheet
     * @param {Object} workbook - ExcelJS workbook
     * @returns {Array} Array of item type objects
     */
    const getNewItemTypeRowValues = (workbook) => {
        const newItemsSheet = workbook.getWorksheet('NEW_ITEM_TYPES');
        const items = [];

        // Start from row 2 (skip header)
        let rowNumber = 2;
        while (true) {
            const row = newItemsSheet.getRow(rowNumber);
            
            // Check if row has any data (at least name should be present)
            const name = row.getCell(1).value;
            if (!name || name === '') {
                break; // No more data
            }

            items.push({
                name: row.getCell(1).value || '',
                manufacturer: row.getCell(2).value || '',
                partNumber: row.getCell(3).value || '',
                description: row.getCell(4).value || '',
                unitsPerPackage: row.getCell(5).value || '',
                lowUnitsQty: row.getCell(6).value || '',
                inventoryType: row.getCell(7).value || '',
                unitOfMeasure: row.getCell(8).value || '',
                provider: row.getCell(9).value || '',
                category: row.getCell(10).value || ''
            });

            rowNumber++;
        }

        return items;
    };

    /**
     * Verify lookup values are valid
     * @param {Object} item - Item type object
     * @param {Object} state - Application state with lookup data
     * @returns {Object} { isValid: boolean, errors: Array<string>, warnings: Array<string> }
     */
    function verifyLookupValuesAreValid(item, state) {
        const errors = [];
        const warnings = [];

        // Check required fields
        if (!item.name || item.name.trim() === '') {
            errors.push('Name is required');
        }

        // Check for duplicate item types (name + part number match)
        const existingItemTypes = state.itemTypes || [];
        const duplicates = existingItemTypes.filter(existing => {
            const nameMatch = existing.name.toLowerCase() === (item.name || '').toLowerCase();
            const partNumberMatch = existing.part_number === item.partNumber;
            
            // If both name and part number match, it's definitely a duplicate
            if (nameMatch && partNumberMatch) {
                return true;
            }
            
            // If name matches but part numbers differ (or one is empty), warn about potential duplicate
            if (nameMatch && (item.partNumber || existing.part_number)) {
                return true;
            }
            
            return false;
        });
        
        if (duplicates.length > 0) {
            duplicates.forEach(dup => {
                if (dup.name.toLowerCase() === (item.name || '').toLowerCase() && 
                    dup.part_number === item.partNumber) {
                    errors.push(`Duplicate: Item "${item.name}" with part number "${item.partNumber}" already exists (ID: ${dup.id})`);
                } else {
                    warnings.push(`Similar item: "${dup.name}" ${dup.part_number ? `(P/N: ${dup.part_number})` : '(no P/N)'} already exists (ID: ${dup.id})`);
                }
            });
        }

        // Manufacturer is optional and not validated - it's just a text field

        // Validate Units per Package (required)
        if (!item.unitsPerPackage || item.unitsPerPackage === '') {
            errors.push('Units per Package is required');
        } else {
            const unitsPerPkg = parseInt(item.unitsPerPackage);
            if (isNaN(unitsPerPkg) || unitsPerPkg < 1) {
                errors.push('Units per Package must be a number greater than 0');
            }
        }

        // Validate Category
        if (!item.category || item.category.trim() === '') {
            errors.push('Category is required');
        } else {
            const validCategory = state.categories.find(c => c.name === item.category);
            if (!validCategory) {
                errors.push(`Invalid category: "${item.category}"`);
            }
        }

        // Validate Unit of Measure
        if (!item.unitOfMeasure || item.unitOfMeasure.trim() === '') {
            errors.push('Unit of Measure is required');
        } else {
            const validUom = state.unitsOfMeasure?.find(u => u.name === item.unitOfMeasure);
            if (!validUom) {
                errors.push(`Invalid unit of measure: "${item.unitOfMeasure}"`);
            }
        }

        // Validate Provider
        if (!item.provider || item.provider.trim() === '') {
            errors.push('Provider is required');
        } else {
            const validProvider = state.providers?.find(p => p.name === item.provider);
            if (!validProvider) {
                errors.push(`Invalid provider: "${item.provider}"`);
            }
        }

        // Validate Inventory Type
        if (!item.inventoryType || item.inventoryType.trim() === '') {
            errors.push('Inventory Type is required');
        } else {
            const validInvType = state.inventoryTypes?.find(it => it.name === item.inventoryType);
            if (!validInvType) {
                errors.push(`Invalid inventory type: "${item.inventoryType}"`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    };

    /**
     * Generate HTML table for item types preview
     * @param {Array} items - Array of item type objects with validation results
     * @returns {HTMLElement} Table element
     */
    const generateItemTypesTable = (items) => {
        const table = createElement('table', { class: 'data-table import-preview-table' });
        
        // Header
        const thead = createElement('thead');
        const headerRow = createElement('tr');
        
        const headers = [
            'Include',
            'Name',
            'Manufacturer',
            'Part Number',
            'Description',
            'Units per Package',
            'Low Units Qty',
            'Inventory Type',
            'Unit of Measure',
            'Provider',
            'Category',
            'Status'
        ];
        
        headers.forEach(header => {
            const th = createElement('th', {}, [header]);
            headerRow.appendChild(th);
        });
        
        thead.appendChild(headerRow);
        table.appendChild(thead);
        
        // Body
        const tbody = createElement('tbody');
        
        items.forEach((item, index) => {
            const tr = createElement('tr', { 
                class: item.validation.isValid ? 'valid-row' : 'invalid-row' 
            });
            
            // Include checkbox
            const includeCell = createElement('td');
            const checkboxAttrs = {
                type: 'checkbox',
                'data-index': index
            };
            
            // Only add checked/disabled if true (HTML boolean attributes)
            if (item.validation.isValid) {
                checkboxAttrs.checked = true;
            }
            if (!item.validation.isValid) {
                checkboxAttrs.disabled = true;
            }
            
            const checkbox = createElement('input', checkboxAttrs);
            includeCell.appendChild(checkbox);
            tr.appendChild(includeCell);
            
            // Data cells
            tr.appendChild(createElement('td', {}, [item.name]));
            tr.appendChild(createElement('td', {}, [item.manufacturer]));
            tr.appendChild(createElement('td', {}, [item.partNumber]));
            tr.appendChild(createElement('td', {}, [item.description]));
            tr.appendChild(createElement('td', {}, [item.unitsPerPackage]));
            tr.appendChild(createElement('td', {}, [item.lowUnitsQty || '']));
            tr.appendChild(createElement('td', {}, [item.inventoryType]));
            tr.appendChild(createElement('td', {}, [item.unitOfMeasure]));
            tr.appendChild(createElement('td', {}, [item.provider]));
            tr.appendChild(createElement('td', {}, [item.category]));
            
            // Status cell
            const statusCell = createElement('td');
            if (item.validation.isValid) {
                const statusContainer = createElement('div');
                statusContainer.appendChild(createElement('span', { 
                    class: 'status-badge status-valid' 
                }, ['✓ Valid']));
                
                // Show warnings if any
                if (item.validation.warnings && item.validation.warnings.length > 0) {
                    const warningDiv = createElement('div', { 
                        class: 'status-warnings',
                        style: { marginTop: '0.25rem' }
                    });
                    const warningList = createElement('ul', { 
                        class: 'warning-list',
                        style: { 
                            margin: '0.25rem 0 0 0',
                            padding: '0 0 0 1.25rem',
                            fontSize: '0.85em',
                            color: '#d97706'
                        }
                    });
                    item.validation.warnings.forEach(warning => {
                        warningList.appendChild(createElement('li', {}, ['⚠ ' + warning]));
                    });
                    warningDiv.appendChild(warningList);
                    statusContainer.appendChild(warningDiv);
                }
                
                statusCell.appendChild(statusContainer);
            } else {
                const errorDiv = createElement('div', { class: 'status-errors' });
                errorDiv.appendChild(createElement('span', { 
                    class: 'status-badge status-invalid' 
                }, ['✗ Invalid']));
                const errorList = createElement('ul', { class: 'error-list' });
                item.validation.errors.forEach(error => {
                    errorList.appendChild(createElement('li', {}, [error]));
                });
                errorDiv.appendChild(errorList);
                statusCell.appendChild(errorDiv);
            }
            tr.appendChild(statusCell);
            
            tbody.appendChild(tr);
        });
        
        table.appendChild(tbody);
        
        return table;
    };

    /**
     * Generate new item types in the database
     * @param {Array} items - Array of item type objects to create
     * @param {Array} selectedMarkets - Array of market names to apply items to
     * @param {Function} progressCallback - Optional callback for progress updates (current, total, message, name, success)
     * @returns {Promise<Object>} Result object
     */
    const generateNewItemTypes = async (items, selectedMarkets, progressCallback = null) => {
        const state = Store.getState();
        const results = {
            success: 0,
            failed: 0,
            errors: []
        };

        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (progressCallback) {
                progressCallback(i + 1, items.length, `Creating ${item.name}...`, item.name);
            }
            
            try {
                // Get lookup IDs
                const category = state.categories.find(c => c.name === item.category);
                const uom = state.unitsOfMeasure?.find(u => u.name === item.unitOfMeasure);
                const provider = state.providers?.find(p => p.name === item.provider);
                const invType = state.inventoryTypes?.find(it => it.name === item.inventoryType);
                
                // Create the item type once
                const itemTypeData = {
                    name: item.name,
                    category_id: category.id,
                    unit_of_measure_id: uom.id,
                    provider_id: provider.id,
                    inventory_type_id: invType.id,
                    units_per_package: parseInt(item.unitsPerPackage)
                };
                
                // Only add optional fields if they have values
                if (item.manufacturer) itemTypeData.manufacturer = item.manufacturer;
                if (item.description) itemTypeData.description = item.description;
                if (item.partNumber) itemTypeData.part_number = item.partNumber;
                if (item.lowUnitsQty) itemTypeData.low_units_quantity = parseInt(item.lowUnitsQty);

                const result = await Queries.createItemType(itemTypeData);
                
                if (!result.isOk) {
                    results.failed++;
                    results.errors.push(`Failed to create "${item.name}": ${result.error}`);
                    continue;
                }
                
                // Extract the new item ID - handle both array and single object returns
                let newItemId = null;
                if (Array.isArray(result.value) && result.value.length > 0) {
                    newItemId = result.value[0].id;
                } else if (result.value && result.value.id) {
                    newItemId = result.value.id;
                }
                
                if (!newItemId) {
                    results.failed++;
                    results.errors.push(`Created "${item.name}" but could not retrieve item ID`);
                    continue;
                }
                
                // Associate with each selected market
                let marketSuccessCount = 0;
                for (const marketName of selectedMarkets) {
                    const market = state.markets.find(m => m.name === marketName);
                    if (!market) {
                        results.errors.push(`Market "${marketName}" not found for item "${item.name}"`);
                        continue;
                    }

                    const marketAssociation = await Database.insert('item_type_markets', {
                        item_type_id: newItemId,
                        market_id: market.id,
                        is_primary: marketSuccessCount === 0, // First market is primary
                        created_at: getLocalTimestamp()
                    });
                    
                    if (marketAssociation.isOk) {
                        marketSuccessCount++;
                    } else {
                        results.errors.push(`Failed to associate "${item.name}" with market "${marketName}": ${marketAssociation.error}`);
                    }
                }
                
                if (marketSuccessCount > 0) {
                    results.success++;
                    
                    if (progressCallback) {
                        progressCallback(i + 1, items.length, `✓ Created ${item.name} with ${marketSuccessCount} market(s)`, item.name, true);
                    }
                } else {
                    results.failed++;
                    results.errors.push(`Created "${item.name}" but failed to associate with any markets`);
                    
                    if (progressCallback) {
                        progressCallback(i + 1, items.length, `✗ Failed: ${item.name}`, item.name, false);
                    }
                }
                
            } catch (error) {
                results.failed++;
                results.errors.push(`Error creating "${item.name}": ${error.message}`);
                
                if (progressCallback) {
                    progressCallback(i + 1, items.length, `✗ Error: ${item.name}`, item.name, false);
                }
            }
        }

        return results;
    };

    return {
        loadExcelFile,
        verifyExcelFileIsValid,
        getNewItemTypeRowValues,
        verifyLookupValuesAreValid,
        generateItemTypesTable,
        generateNewItemTypes
    };
})();

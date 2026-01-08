/**
 * Import New Inventory Service
 * Handles importing new inventory items (not quantity adjustments) from Excel templates
 */

const ImportNewInventoryService = (() => {
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
     * Verify that the Excel file is a valid Inventory Import template
     * @param {Object} workbook - ExcelJS workbook
     * @returns {Object} { isValid: boolean, error: string }
     */
    const verifyExcelFileIsValid = (workbook) => {
        // Check if NEW_INVENTORY sheet exists
        const newInventorySheet = workbook.getWorksheet('NEW_INVENTORY');
        
        if (!newInventorySheet) {
            return { 
                isValid: false, 
                error: 'Template is invalid: NEW_INVENTORY sheet not found' 
            };
        }

        // Expected column names for NEW_INVENTORY (starting at row 9)
        const expectedColumns = [
            'Name',
            'Part Number',
            'Description',
            'Unit of Measure',
            'Category',
            'Quantity'
        ];

        // Verify NEW_INVENTORY columns (header is at row 9)
        const headerRow = newInventorySheet.getRow(9);
        const actualColumns = [];
        headerRow.eachCell((cell, colNumber) => {
            actualColumns.push(cell.value);
        });

        for (let i = 0; i < expectedColumns.length; i++) {
            if (actualColumns[i] !== expectedColumns[i]) {
                return {
                    isValid: false,
                    error: `NEW_INVENTORY sheet invalid: Column ${i + 1} should be "${expectedColumns[i]}" but found "${actualColumns[i]}"`
                };
            }
        }

        return { isValid: true, error: null };
    };

    /**
     * Get new inventory rows from the workbook
     * @param {Object} workbook - ExcelJS workbook
     * @returns {Array} Array of new inventory row objects
     */
    const getNewInventoryRows = (workbook) => {
        const rows = [];
        const newInventorySheet = workbook.getWorksheet('NEW_INVENTORY');
        
        if (!newInventorySheet) return rows;

        let rowNumber = 10; // Skip header at row 9, start data at row 10
        while (true) {
            const row = newInventorySheet.getRow(rowNumber);
            const name = row.getCell(1).value; // Name column

            // Stop if we reach an empty Name
            if (!name) break;

            // Include rows with any quantity value (including invalid ones like negative)
            const quantity = row.getCell(6).value;
            const hasQuantityEntry = quantity !== null && quantity !== undefined && quantity !== '';
            
            if (!hasQuantityEntry) {
                rowNumber++;
                continue;
            }

            rows.push({
                rowNumber: rowNumber,
                name: String(name).trim(),
                partNumber: row.getCell(2).value ? String(row.getCell(2).value).trim() : '',
                description: row.getCell(3).value ? String(row.getCell(3).value).trim() : '',
                unitOfMeasure: row.getCell(4).value ? String(row.getCell(4).value).trim() : '',
                category: row.getCell(5).value ? String(row.getCell(5).value).trim() : '',
                quantity: quantity
            });

            rowNumber++;
        }

        return rows;
    };

    /**
     * Validate new inventory rows against database records
     * @param {Array} rows - Array of new inventory row objects
     * @param {Object} state - Application state
     * @returns {Array} Array of validation results
     */
    const validateNewInventoryRows = (rows, state) => {
        const validationResults = [];
        const itemTypes = state.itemTypes || [];
        
        // Get the selected SLOC's market for item type filtering
        const selectedSloc = state.selectedSloc;
        const selectedMarketId = selectedSloc ? 
            (state.slocs?.find(s => s.id === selectedSloc.id)?.market_id || 
             state.markets?.find(m => m.id === selectedSloc.market_id)?.id) 
            : null;

        rows.forEach(row => {
            const errors = [];
            let isValid = true;
            let itemType = null;

            // Validate Name (required) - must match an item type in the selected market
            if (!row.name) {
                errors.push('Name is required');
                isValid = false;
            } else {
                // First find item type by name
                const matchingItemTypes = itemTypes.filter(it => 
                    it.name.toLowerCase() === row.name.toLowerCase()
                );
                
                if (matchingItemTypes.length === 0) {
                    errors.push(`Item Type "${row.name}" not found`);
                    isValid = false;
                } else if (selectedMarketId && state.itemTypeMarkets) {
                    // Check if any matching item type is in the selected market
                    const marketItemTypeIds = state.itemTypeMarkets
                        .filter(itm => itm.market_id === selectedMarketId)
                        .map(itm => itm.item_type_id);
                    
                    itemType = matchingItemTypes.find(it => marketItemTypeIds.includes(it.id));
                    
                    if (!itemType) {
                        const marketName = state.markets?.find(m => m.id === selectedMarketId)?.name || 'selected market';
                        errors.push(`Item Type "${row.name}" not found in ${marketName}`);
                        isValid = false;
                    }
                } else {
                    itemType = matchingItemTypes[0];
                }
                
                // Validate it's a bulk item type
                if (itemType) {
                    const inventoryType = state.inventoryTypes?.find(it => it.id === itemType.inventory_type_id);
                    if (inventoryType?.name?.toLowerCase() !== 'bulk') {
                        errors.push(`Item Type "${row.name}" is not a bulk item`);
                        isValid = false;
                    }
                }
            }

            // Validate Quantity (required)
            if (row.quantity === null || row.quantity === undefined || row.quantity === '') {
                errors.push('Quantity is required');
                isValid = false;
            } else {
                const qty = parseFloat(row.quantity);
                if (isNaN(qty) || qty <= 0) {
                    errors.push('Quantity must be a positive number');
                    isValid = false;
                }
            }

            validationResults.push({
                rowNumber: row.rowNumber,
                name: row.name,
                partNumber: row.partNumber,
                description: row.description,
                unitOfMeasure: row.unitOfMeasure,
                category: row.category,
                quantity: row.quantity,
                isValid: isValid,
                errors: errors,
                itemType: itemType
            });
        });

        return validationResults;
    };

    /**
     * Generate HTML table showing validation results
     * @param {Array} validationResults - Array of validation result objects
     * @returns {HTMLElement} Table element
     */
    const generateValidationTable = (validationResults) => {
        if (validationResults.length === 0) {
            return p('No inventory items found in template', { 
                style: { textAlign: 'center', padding: '2rem', color: '#6b7280' } 
            });
        }

        const validCount = validationResults.filter(r => r.isValid).length;
        const invalidCount = validationResults.length - validCount;

        const container = div({}, [
            // Summary
            div({ style: { marginBottom: '1rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' } }, [
                p(`Total Rows: ${validationResults.length} | Valid: ${validCount} | Invalid: ${invalidCount}`, {
                    style: { margin: 0, fontWeight: 'bold' }
                })
            ]),

            // Table
            createElement('table', { 
                className: 'import-preview-table',
                style: { 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    fontSize: '0.9rem'
                }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Row']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Status']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Name']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Part Number']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Description']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['UOM']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Category']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'center', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Quantity']),
                        createElement('th', { style: { padding: '0.75rem', textAlign: 'left', backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' } }, ['Validation'])
                    ])
                ]),
                createElement('tbody', {}, 
                    validationResults.map(result => {
                        const rowStyle = {
                            padding: '0.5rem 0.75rem',
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: result.isValid ? '#f0fdf4' : '#fef2f2'
                        };

                        return createElement('tr', {}, [
                            createElement('td', { style: rowStyle }, [String(result.rowNumber)]),
                            createElement('td', { style: { ...rowStyle, textAlign: 'center' } }, [
                                createElement('span', {
                                    style: {
                                        padding: '0.25rem 0.5rem',
                                        borderRadius: '0.25rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        backgroundColor: result.isValid ? '#22c55e' : '#ef4444',
                                        color: 'white'
                                    }
                                }, [result.isValid ? '✓ VALID' : '✗ INVALID'])
                            ]),
                            createElement('td', { style: rowStyle }, [result.name]),
                            createElement('td', { style: rowStyle }, [result.partNumber || '-']),
                            createElement('td', { style: rowStyle }, [result.description || '-']),
                            createElement('td', { style: rowStyle }, [result.unitOfMeasure || '-']),
                            createElement('td', { style: rowStyle }, [result.category || '-']),
                            createElement('td', { style: { ...rowStyle, textAlign: 'center' } }, [String(result.quantity || '')]),
                            createElement('td', { style: rowStyle }, [
                                result.isValid 
                                    ? createElement('span', { style: { color: '#16a34a', fontWeight: '500' } }, ['Ready to import'])
                                    : createElement('div', {}, result.errors.map(err => 
                                        createElement('div', { style: { color: '#dc2626', fontSize: '0.85rem' } }, [`• ${err}`])
                                    ))
                            ])
                        ]);
                    })
                )
            ])
        ]);

        return container;
    };

    /**
     * Apply new inventory items to database
     * @param {Array} validResults - Array of valid validation results
     * @param {Object} state - Application state
     * @param {Function} progressCallback - Optional callback for progress updates (current, total, message)
     * @returns {Promise<Object>} Results object with success/failure counts
     */
    const applyNewInventory = async (validResults, state, progressCallback = null) => {
        const results = {
            total: validResults.length,
            succeeded: 0,
            failed: 0,
            errors: []
        };

        const selectedSloc = state.selectedSloc;
        if (!selectedSloc) {
            results.errors.push('No SLOC selected');
            return results;
        }

        // Get default receiving location from preferences
        const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
        const defaultLocation = receivingLocationId ? 
            state.locations?.find(l => l.id === parseInt(receivingLocationId)) : 
            null;
        
        if (!defaultLocation) {
            results.errors.push('Default receiving location not set in preferences');
            return results;
        }
        
        // Get Available status
        const availableStatus = state.statuses?.find(s => s.name === 'Available');
        
        if (!availableStatus) {
            results.errors.push('Available status not found in system');
            return results;
        }

        for (let i = 0; i < validResults.length; i++) {
            const result = validResults[i];
            
            if (progressCallback) {
                progressCallback(i + 1, validResults.length, `Importing ${result.name} (Row ${result.rowNumber})...`, result.rowNumber);
            }
            
            try {
                // Prepare inventory data - bulk items go to Available status at default location
                const inventoryData = {
                    item_type_id: result.itemType.id,
                    location_id: defaultLocation.id,
                    status_id: availableStatus.id,
                    sloc_id: selectedSloc.id,
                    quantity: parseFloat(result.quantity),
                    created_at: getLocalTimestamp(),
                    updated_at: getLocalTimestamp()
                };

                // Insert into database
                const insertResult = await Database.insert('inventory', inventoryData);

                if (insertResult.isOk) {
                    results.succeeded++;
                    
                    // Create transaction record for the new inventory
                    const transactionData = {
                        inventory_id: insertResult.value.id,
                        transaction_type: 'Inventory Action',
                        action: 'Receive',
                        item_type_name: result.itemType.name,
                        inventory_type_name: state.inventoryTypes?.find(it => it.id === result.itemType.inventory_type_id)?.name,
                        manufacturer: result.itemType.manufacturer,
                        part_number: result.itemType.part_number,
                        category_name: state.categories?.find(c => c.id === result.itemType.category_id)?.name,
                        status_name: availableStatus.name,
                        quantity: inventoryData.quantity,
                        from_location_name: defaultLocation.name,
                        area_name: null,
                        assigned_crew_name: null,
                        sloc: state.slocs?.find(s => s.id === inventoryData.sloc_id)?.name,
                        market: state.markets?.find(m => m.id === state.slocs?.find(s => s.id === inventoryData.sloc_id)?.market_id)?.name,
                        client: state.clients?.find(c => c.id === state.markets?.find(m => m.id === state.slocs?.find(s => s.id === inventoryData.sloc_id)?.market_id)?.client_id)?.name,
                        mfgrsn: null,
                        tilsonsn: null,
                        user: state.user?.email || 'Unknown',
                        notes: `Imported from Excel template (Row ${result.rowNumber})`,
                        date_time: getLocalTimestamp()
                    };
                    
                    await Database.insert('transactions', transactionData);
                    
                    if (progressCallback) {
                        progressCallback(i + 1, validResults.length, `✓ Imported ${result.name} (Row ${result.rowNumber})`, result.rowNumber, true);
                    }
                } else {
                    results.failed++;
                    results.errors.push(`Row ${result.rowNumber}: ${insertResult.error || 'Failed to insert'}`);
                    
                    if (progressCallback) {
                        progressCallback(i + 1, validResults.length, `✗ Failed: ${result.name} (Row ${result.rowNumber})`, result.rowNumber, false);
                    }
                }
            } catch (error) {
                results.failed++;
                results.errors.push(`Row ${result.rowNumber}: ${error.message}`);
                
                if (progressCallback) {
                    progressCallback(i + 1, validResults.length, `✗ Error: ${result.name} (Row ${result.rowNumber})`, result.rowNumber, false);
                }
            }
        }

        return results;
    };

    return {
        loadExcelFile,
        verifyExcelFileIsValid,
        getNewInventoryRows,
        validateNewInventoryRows,
        generateValidationTable,
        applyNewInventory
    };
})();

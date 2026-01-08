/**
 * Import Preview Functions
 * Handles preview displays for data imports (inventory, new inventory, item types)
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // IMPORT PREVIEW
    // ========================================

    /**
     * Handle import item types button click
     */
    const handleImportItemTypes = async () => {
        try {
            // Load Excel file
            const workbook = await ImportItemTypesService.loadExcelFile();
            
            // Verify file is valid
            const validation = ImportItemTypesService.verifyExcelFileIsValid(workbook);
            if (!validation.isValid) {
                Components.showToast(validation.error, 'error');
                return;
            }
            
            // Get state for market lookups
            const state = Store.getState();
            
            // Get row values with market assignments
            const items = ImportItemTypesService.getNewItemTypeRowValues(workbook, state);
            
            if (items.length === 0) {
                Components.showToast('No item types found in template', 'warning');
                return;
            }
            
            // Validate each item
            const validatedItems = items.map(item => ({
                ...item,
                validation: ImportItemTypesService.verifyLookupValuesAreValid(item, state)
            }));
            
            // Show preview
            showImportPreview(validatedItems);
            
        } catch (error) {
            Components.showToast('Error loading file: ' + error.message, 'error');
        }
    };
    
    /**
     * Show import preview with validated items
     */
    const showImportPreview = (items) => {
        const state = Store.getState();
        const previewSection = byId('import-preview-section');
        
        if (!previewSection) return;
        
        const validCount = items.filter(i => i.validation.isValid).length;
        const invalidCount = items.length - validCount;
        
        previewSection.innerHTML = '';
        previewSection.style.display = 'block';
        
        const previewCard = div({ className: 'card', style: { marginTop: '2rem' } }, [
            div({ className: 'card-header' }, [
                createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Import Preview']),
                p(`Found ${items.length} item type(s): ${validCount} valid, ${invalidCount} invalid`, 
                  { style: { margin: '0.5rem 0', fontSize: '0.9rem', color: '#1f2937' } }),
                p('Markets are assigned individually per item type in the template', 
                  { style: { margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: '#4b5563' } })
            ]),
            div({ className: 'card-body' }, [
                // Preview table
                div({ style: { overflowX: 'auto' } }, [
                    ImportItemTypesService.generateItemTypesTable(items)
                ]),
                
                // Action buttons
                div({ style: { marginTop: '1.5rem', display: 'flex', gap: '1rem' } }, [
                    button('✓ Import Selected Items', {
                        className: 'btn btn-success',
                        onclick: () => executeImport(items)
                    }),
                    button('Cancel', {
                        className: 'btn btn-secondary',
                        onclick: () => {
                            previewSection.style.display = 'none';
                            previewSection.innerHTML = '';
                        }
                    })
                ])
            ])
        ]);
        
        previewSection.appendChild(previewCard);
    };
    
    /**
     * Execute the import of selected items
     */
    const executeImport = async (items) => {
        // Get checked items from table
        const checkboxes = document.querySelectorAll('.import-preview-table input[type="checkbox"]:checked:not(:disabled)');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        const selectedItems = selectedIndices.map(index => items[index]);
        
        if (selectedItems.length === 0) {
            Components.showToast('No valid items selected for import', 'warning');
            return;
        }
        
        // Calculate total market associations
        const totalAssociations = selectedItems.reduce((sum, item) => sum + (item.markets?.length || 0), 0);
        
        // Confirm import
        if (!confirm(`Import ${selectedItems.length} item type(s)?\n\nThis will create ${selectedItems.length} item type record(s) and ${totalAssociations} market association(s).`)) {
            return;
        }
        
        // Execute import
        Components.showToast('Importing item types...', 'info');
        
        const results = await ImportItemTypesService.generateNewItemTypes(selectedItems);
        
        if (results.success > 0) {
            Components.showToast(`Successfully imported ${results.success} item type(s)`, 'success');
            
            // Reload data
            await refreshCachedTable('item_types');
            await refreshCachedTable('item_type_markets');
            
            // Hide preview
            const previewSection = byId('import-preview-section');
            if (previewSection) {
                previewSection.style.display = 'none';
                previewSection.innerHTML = '';
            }
        }
        
        if (results.failed > 0) {
            console.error('Import errors:', results.errors);
            Components.showToast(`${results.failed} item(s) failed to import. Check console for details.`, 'error');
        }
    };
    
    /**
     * Handle inventory import
     */
    const handleImportInventory = async () => {
        try {
            // Load Excel file
            const workbook = await ImportInventoryService.loadExcelFile();
            
            // Verify file is valid
            const validation = ImportInventoryService.verifyExcelFileIsValid(workbook);
            if (!validation.isValid) {
                Components.showToast(validation.error, 'error');
                return;
            }
            
            // Get quantity changes
            const state = Store.getState();
            const changes = ImportInventoryService.getQuantityChanges(workbook, state);
            
            if (changes.length === 0) {
                Components.showToast('No quantity changes detected in template', 'info');
                return;
            }
            
            // Show preview
            showInventoryImportPreview(changes);
            
        } catch (error) {
            Components.showToast('Error loading file: ' + error.message, 'error');
        }
    };
    
    /**
     * Show inventory import preview with quantity changes
     */
    const showInventoryImportPreview = (changes) => {
        const previewSection = byId('import-preview-section');
        
        if (!previewSection) return;
        
        previewSection.innerHTML = '';
        previewSection.style.display = 'block';
        
        const totalIncrease = changes.filter(c => c.difference > 0).length;
        const totalDecrease = changes.filter(c => c.difference < 0).length;
        
        const previewCard = div({ className: 'card', style: { marginTop: '2rem' } }, [
            div({ className: 'card-header' }, [
                createElement('h4', {}, ['Inventory Quantity Adjustments Preview']),
                p(`Found ${changes.length} quantity change(s): ${totalIncrease} increase(s), ${totalDecrease} decrease(s)`, 
                  { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } })
            ]),
            div({ className: 'card-body' }, [
                // Warning message
                div({ 
                    style: { 
                        marginBottom: '1.5rem', 
                        padding: '1rem', 
                        backgroundColor: '#fef3c7', 
                        border: '1px solid #f59e0b',
                        borderRadius: '8px' 
                    } 
                }, [
                    createElement('strong', {}, ['⚠️ Important:']),
                    p('Review all changes carefully before applying. This will update inventory quantities in the database.', 
                      { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } })
                ]),
                
                // Changes table
                div({ style: { overflowX: 'auto' } }, [
                    ImportInventoryService.generateChangesTable(changes)
                ]),
                
                // Action buttons
                div({ style: { marginTop: '1.5rem', display: 'flex', gap: '1rem' } }, [
                    button('✓ Apply Selected Changes', {
                        className: 'btn btn-success',
                        onclick: () => executeInventoryImport(changes)
                    }),
                    button('Cancel', {
                        className: 'btn btn-secondary',
                        onclick: () => {
                            previewSection.style.display = 'none';
                            previewSection.innerHTML = '';
                        }
                    })
                ])
            ])
        ]);
        
        previewSection.appendChild(previewCard);
    };
    
    /**
     * Execute the inventory quantity changes
     */
    const executeInventoryImport = async (changes) => {
        // Get checked items from table
        const checkboxes = document.querySelectorAll('.import-preview-table input[type="checkbox"]:checked');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        const selectedChanges = selectedIndices.map(index => changes[index]);
        
        if (selectedChanges.length === 0) {
            Components.showToast('No changes selected for import', 'warning');
            return;
        }
        
        // Confirm import
        const increaseCount = selectedChanges.filter(c => c.difference > 0).length;
        const decreaseCount = selectedChanges.filter(c => c.difference < 0).length;
        
        if (!confirm(`Apply ${selectedChanges.length} quantity adjustment(s)?\n\n${increaseCount} increase(s)\n${decreaseCount} decrease(s)\n\nThis will update inventory quantities in the database.`)) {
            return;
        }
        
        // Execute import
        Components.showToast('Applying quantity adjustments...', 'info');
        
        const results = await ImportInventoryService.applyQuantityChanges(selectedChanges);
        
        if (results.success > 0) {
            Components.showToast(`Successfully updated ${results.success} inventory record(s)`, 'success');
            
            // Reload inventory data
            const state = Store.getState();
            if (state.selectedSloc) {
                const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
            } else {
                const inventoryResult = await Queries.getAllInventory();
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
            }
            
            // Hide preview
            const previewSection = byId('import-preview-section');
            if (previewSection) {
                previewSection.style.display = 'none';
                previewSection.innerHTML = '';
            }
        }
        
        if (results.failed > 0) {
            console.error('Import errors:', results.errors);
            Components.showToast(`${results.failed} record(s) failed to update. Check console for details.`, 'error');
        }
    };
    
    /**
     * Handle new inventory import
     */
    const handleImportNewInventory = async () => {
        try {
            // Load Excel file
            const workbook = await ImportNewInventoryService.loadExcelFile();
            
            // Verify file is valid
            const validation = ImportNewInventoryService.verifyExcelFileIsValid(workbook);
            if (!validation.isValid) {
                Components.showToast(validation.error, 'error');
                return;
            }
            
            // Get new inventory rows
            const rows = ImportNewInventoryService.getNewInventoryRows(workbook);
            
            if (rows.length === 0) {
                Components.showToast('No inventory items found in template', 'info');
                return;
            }
            
            // Validate rows
            const state = Store.getState();
            const validationResults = ImportNewInventoryService.validateNewInventoryRows(rows, state);
            
            // Show preview
            showNewInventoryImportPreview(validationResults);
            
        } catch (error) {
            Components.showToast('Error loading file: ' + error.message, 'error');
        }
    };
    
    /**
     * Show new inventory import preview with validation results
     */
    const showNewInventoryImportPreview = (validationResults) => {
        const previewSection = byId('import-preview-section');
        
        if (!previewSection) return;
        
        previewSection.innerHTML = '';
        previewSection.style.display = 'block';
        
        const validCount = validationResults.filter(r => r.isValid).length;
        const invalidCount = validationResults.length - validCount;
        
        const previewCard = div({ className: 'card', style: { marginTop: '2rem' } }, [
            div({ className: 'card-header' }, [
                createElement('h4', {}, ['New Inventory Import Preview']),
                p(`Found ${validationResults.length} row(s): ${validCount} valid, ${invalidCount} invalid`, 
                  { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } })
            ]),
            div({ className: 'card-body' }, [
                // Warning message
                div({ 
                    style: { 
                        marginBottom: '1.5rem', 
                        padding: '1rem', 
                        backgroundColor: validCount > 0 ? '#dcfce7' : '#fef2f2', 
                        border: `1px solid ${validCount > 0 ? '#16a34a' : '#ef4444'}`,
                        borderRadius: '8px' 
                    } 
                }, [
                    createElement('strong', {}, [validCount > 0 ? '✓ Ready to Import' : '✗ No Valid Items']),
                    p(validCount > 0 
                        ? `${validCount} valid item(s) will be imported to the selected SLOC. Invalid items will be skipped.`
                        : 'All items have validation errors. Please correct the template and try again.', 
                      { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } })
                ]),
                
                // Validation table
                div({ style: { overflowX: 'auto' } }, [
                    ImportNewInventoryService.generateValidationTable(validationResults)
                ]),
                
                // Action buttons
                div({ 
                    id: 'import-action-buttons',
                    style: { marginTop: '1.5rem', display: 'flex', gap: '1rem' } 
                }, [
                    createElement('button',
                        validCount === 0
                            ? {
                                id: 'complete-import-btn',
                                className: 'btn btn-success',
                                disabled: '',
                                onclick: () => executeNewInventoryImport(validationResults)
                            }
                            : {
                                id: 'complete-import-btn',
                                className: 'btn btn-success',
                                onclick: () => executeNewInventoryImport(validationResults)
                            }
                    , ['✓ Complete Import']),
                    createElement('button', {
                        id: 'cancel-import-btn',
                        className: 'btn btn-secondary',
                        onclick: () => {
                            previewSection.style.display = 'none';
                            previewSection.innerHTML = '';
                        }
                    }, ['Cancel'])
                ]),
                
                // Progress bar (hidden initially)
                div({ 
                    id: 'import-progress-container',
                    style: { marginTop: '1.5rem', display: 'none' } 
                }, [
                    createElement('strong', {}, ['Import Progress']),
                    div({ 
                        style: { 
                            width: '100%', 
                            height: '30px', 
                            backgroundColor: '#e5e7eb', 
                            borderRadius: '4px', 
                            overflow: 'hidden',
                            marginTop: '0.5rem'
                        } 
                    }, [
                        div({ 
                            id: 'import-progress-bar',
                            style: { 
                                width: '0%', 
                                height: '100%', 
                                backgroundColor: '#16a34a', 
                                transition: 'width 0.3s ease',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: 'white',
                                fontWeight: 'bold',
                                fontSize: '0.875rem'
                            } 
                        }, ['0%'])
                    ]),
                    p('', { 
                        id: 'import-progress-message',
                        style: { marginTop: '0.5rem', fontSize: '0.9rem', color: '#666' } 
                    })
                ])
            ])
        ]);
        
        previewSection.appendChild(previewCard);
    };
    
    /**
     * Execute the new inventory import
     */
    const executeNewInventoryImport = async (validationResults) => {
        // Filter only valid results
        const validResults = validationResults.filter(r => r.isValid);
        
        if (validResults.length === 0) {
            Components.showToast('No valid items to import', 'warning');
            return;
        }
        
        // Confirm import
        if (!confirm(`Import ${validResults.length} new inventory item(s)?\n\nThis will create new inventory records in the database.`)) {
            return;
        }
        
        // Show progress bar, hide buttons
        const progressContainer = byId('import-progress-container');
        const actionButtons = byId('import-action-buttons');
        if (progressContainer) progressContainer.style.display = 'block';
        if (actionButtons) actionButtons.style.display = 'none';
        
        // Progress callback
        const updateProgress = (current, total, message, rowNumber, success) => {
            const percent = Math.round((current / total) * 100);
            const progressBar = byId('import-progress-bar');
            const progressMessage = byId('import-progress-message');
            
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
                progressBar.textContent = `${percent}%`;
            }
            
            if (progressMessage) {
                progressMessage.textContent = message;
            }
            
            // Highlight completed row
            if (success !== undefined && rowNumber) {
                const rows = document.querySelectorAll('.import-preview-table tbody tr');
                rows.forEach(row => {
                    const rowNumCell = row.cells[0];
                    if (rowNumCell && rowNumCell.textContent === String(rowNumber)) {
                        row.style.backgroundColor = success ? '#dcfce7' : '#fecaca';
                    }
                });
            }
        };
        
        // Execute import
        const state = Store.getState();
        const results = await ImportNewInventoryService.applyNewInventory(validResults, state, updateProgress);
        
        if (results.succeeded > 0) {
            Components.showToast(`Successfully imported ${results.succeeded} inventory item(s)`, 'success');
            
            // Reload inventory data
            if (state.selectedSloc) {
                const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
            } else {
                const inventoryResult = await Queries.getAllInventory();
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
            }
            
            // Reload transactions
            const transactionsResult = await Queries.getAllTransactions();
            if (transactionsResult.isOk) {
                Store.setState({ transactions: transactionsResult.value });
            }
            
            // Hide preview after a delay
            setTimeout(() => {
                const previewSection = byId('import-preview-section');
                if (previewSection) {
                    previewSection.style.display = 'none';
                    previewSection.innerHTML = '';
                }
            }, 2000);
        }
        
        if (results.failed > 0) {
            console.error('Import errors:', results.errors);
            Components.showToast(`${results.failed} item(s) failed to import. Check console for details.`, 'error');
        }
    };
    

    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    window.showImportPreview = showImportPreview;
    window.showNewInventoryImportPreview = showNewInventoryImportPreview;
    window.handleImportItemTypes = handleImportItemTypes;
    window.handleImportInventory = handleImportInventory;
    window.handleImportNewInventory = handleImportNewInventory;

})();

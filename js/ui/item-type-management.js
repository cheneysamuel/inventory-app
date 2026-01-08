/**
 * Item Type Management Functions
 * Handles item type creation and configuration
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // ITEM TYPE MANAGEMENT
    // ========================================

function showAddItemTypeModal() {
    const state = Store.getState();
    const table = byId('item-types-table');
    
    if (!table) {
        Components.showToast('Table not found', 'error');
        return;
    }
    
    // Check if already adding
    const existingAddRow = document.querySelector('.item-type-add-row');
    if (existingAddRow) {
        Components.showToast('Already adding a new item type', 'warning');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    // Get lookup data
    const inventoryTypes = state.inventoryTypes || [];
    const categories = state.categories || [];
    const uoms = state.unitsOfMeasure || [];
    const providers = state.providers || [];
    const markets = state.markets || [];
    
    // Create new row with edit cells
    const editCells = [
        // Name (required)
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            placeholder: 'Item name',
            style: { width: '100%' }
        }),
        // Type (required)
        createElement('select', {
            className: 'inline-edit-select required-field',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select --']),
            ...inventoryTypes.map(it => 
                createElement('option', { value: it.id }, [it.name])
            )
        ]),
        // Manufacturer
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            placeholder: 'Manufacturer',
            style: { width: '100%' }
        }),
        // Part Number
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            placeholder: 'Part number',
            style: { width: '100%' }
        }),
        // Description
        createElement('textarea', {
            className: 'inline-edit-textarea',
            placeholder: 'Description',
            style: { width: '100%', minHeight: '60px', resize: 'vertical' }
        }),
        // Units per Package (required)
        createElement('input', {
            type: 'number',
            className: 'inline-edit-input required-field',
            value: 1,
            min: 1,
            style: { width: '100%', textAlign: 'center' }
        }),
        // UOM (required)
        createElement('select', {
            className: 'inline-edit-select required-field',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select --']),
            ...uoms.map(u => 
                createElement('option', { value: u.id }, [u.name])
            )
        ]),
        // Category
        createElement('select', {
            className: 'inline-edit-select',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select --']),
            ...categories.map(c => 
                createElement('option', { value: c.id }, [c.name])
            )
        ]),
        // Provider (required)
        createElement('select', {
            className: 'inline-edit-select required-field',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select --']),
            ...providers.map(p => 
                createElement('option', { value: p.id }, [p.name])
            )
        ]),
        // Low Quantity Alert
        createElement('input', {
            type: 'number',
            className: 'inline-edit-input',
            value: 0,
            min: 0,
            style: { width: '100%', textAlign: 'center' }
        }),
        // Markets (multi-select)
        createMarketsMultiSelect([], markets),
        // Use Count (not applicable for new)
        createElement('div', {
            style: {
                textAlign: 'center',
                color: '#999'
            }
        }, ['-'])
    ];
    
    // Create add row
    const addRow = createElement('tr', {
        className: 'item-type-row item-type-add-row editing',
        style: { cursor: 'default' }
    }, editCells.map(cell => createElement('td', {}, [cell])));
    
    // Create duplicate warning row (initially hidden)
    const duplicateWarningRow = createElement('tr', {
        id: 'duplicate-warning-row',
        className: 'duplicate-warning-row',
        style: { display: 'none' }
    }, [
        createElement('td', {
            colspan: '12',
            style: {
                backgroundColor: '#fff3cd',
                border: '2px solid #ffc107',
                padding: '1rem',
                color: '#856404'
            }
        }, [
            createElement('div', {
                id: 'duplicate-warning-content',
                style: {
                    fontSize: '0.9rem',
                    lineHeight: '1.6'
                }
            }, [])
        ])
    ]);
    
    // Add duplicate checking listeners
    const nameInput = editCells[0];
    const partNumberInput = editCells[3];
    
    function checkForDuplicates() {
        const name = nameInput.value.trim().toLowerCase();
        const partNumber = partNumberInput.value.trim().toLowerCase();
        const existingItems = state.itemTypes || [];
        
        const duplicates = {
            names: [],
            partNumbers: []
        };
        
        // Check for duplicate names
        if (name) {
            existingItems.forEach(item => {
                if (item.name.toLowerCase() === name) {
                    const itemMarkets = (state.itemTypeMarkets || [])
                        .filter(itm => itm.item_type_id === item.id);
                    const marketNames = itemMarkets
                        .map(itm => {
                            const market = state.markets.find(m => m.id === itm.market_id);
                            return market ? market.name : null;
                        })
                        .filter(n => n !== null);
                    
                    duplicates.names.push({
                        id: item.id,
                        name: item.name,
                        partNumber: item.part_number || 'None',
                        markets: marketNames.length > 0 ? marketNames.join(', ') : 'No markets'
                    });
                }
            });
        }
        
        // Check for duplicate part numbers
        if (partNumber) {
            existingItems.forEach(item => {
                if (item.part_number && item.part_number.toLowerCase() === partNumber) {
                    const itemMarkets = (state.itemTypeMarkets || [])
                        .filter(itm => itm.item_type_id === item.id);
                    const marketNames = itemMarkets
                        .map(itm => {
                            const market = state.markets.find(m => m.id === itm.market_id);
                            return market ? market.name : null;
                        })
                        .filter(n => n !== null);
                    
                    duplicates.partNumbers.push({
                        id: item.id,
                        name: item.name,
                        partNumber: item.part_number,
                        markets: marketNames.length > 0 ? marketNames.join(', ') : 'No markets'
                    });
                }
            });
        }
        
        // Update UI based on duplicates found
        const warningContent = byId('duplicate-warning-content');
        const createBtn = actionRow.querySelector('.btn-primary');
        
        if (duplicates.names.length > 0 || duplicates.partNumbers.length > 0) {
            // Build warning message
            let warningHTML = '<strong>⚠️ Potential Duplicate Detected:</strong><br><br>';
            
            if (duplicates.names.length > 0) {
                warningHTML += '<strong>Duplicate Name(s):</strong><ul style="margin: 0.5rem 0;">';
                duplicates.names.forEach(dup => {
                    warningHTML += `<li>"${dup.name}" (ID: ${dup.id}, P/N: ${dup.partNumber}) - Markets: ${dup.markets}</li>`;
                });
                warningHTML += '</ul>';
            }
            
            if (duplicates.partNumbers.length > 0) {
                warningHTML += '<strong>Duplicate Part Number(s):</strong><ul style="margin: 0.5rem 0;">';
                duplicates.partNumbers.forEach(dup => {
                    warningHTML += `<li>"${dup.name}" (ID: ${dup.id}, P/N: ${dup.partNumber}) - Markets: ${dup.markets}</li>`;
                });
                warningHTML += '</ul>';
            }
            
            warningHTML += '<br><em>Please verify this is not a duplicate before creating.</em>';
            
            warningContent.innerHTML = warningHTML;
            duplicateWarningRow.style.display = '';
            
            // Disable create button
            if (createBtn) {
                createBtn.disabled = true;
                createBtn.style.opacity = '0.5';
                createBtn.style.cursor = 'not-allowed';
            }
        } else {
            // No duplicates, hide warning and enable button
            duplicateWarningRow.style.display = 'none';
            if (createBtn) {
                createBtn.disabled = false;
                createBtn.style.opacity = '1';
                createBtn.style.cursor = 'pointer';
            }
        }
    }
    
    // Add input listeners
    nameInput.addEventListener('input', checkForDuplicates);
    partNumberInput.addEventListener('input', checkForDuplicates);
    
    // Create action buttons row
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '12', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' } }, [
            createElement('button', {
                className: 'btn btn-sm btn-secondary',
                style: { marginRight: '0.5rem' },
                onclick: () => {
                    // Cleanup event listeners from markets multi-select
                    const marketsContainer = editCells[10];
                    if (marketsContainer && marketsContainer._cleanup) {
                        marketsContainer._cleanup();
                    }
                    
                    // Remove event listeners
                    nameInput.removeEventListener('input', checkForDuplicates);
                    partNumberInput.removeEventListener('input', checkForDuplicates);
                    
                    // Remove all rows
                    addRow.remove();
                    duplicateWarningRow.remove();
                    actionRow.remove();
                    
                    // Re-enable add button
                    const addBtn = byId('add-item-type-btn');
                    if (addBtn) addBtn.disabled = false;
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveNewItemType(editCells, addRow, actionRow)
            }, ['Create Item Type'])
        ])
    ]);
    
    // Append rows to table
    tbody.appendChild(addRow);
    tbody.appendChild(duplicateWarningRow);
    tbody.appendChild(actionRow);
    
    // Disable add button while adding
    const addBtn = byId('add-item-type-btn');
    if (addBtn) addBtn.disabled = true;
    
    // Focus first input
    const firstInput = addRow.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
    
    // Scroll to bottom
    addRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Save new item type
async function saveNewItemType(editCells, addRow, actionRow) {
    try {
        const state = Store.getState();
        
        // Extract values from edit cells
        const newItem = {
            name: editCells[0].value.trim(),
            inventory_type_id: parseInt(editCells[1].value) || null,
            manufacturer: editCells[2].value.trim(),
            part_number: editCells[3].value.trim(),
            description: editCells[4].value.trim(),
            units_per_package: parseInt(editCells[5].value) || 1,
            unit_of_measure_id: parseInt(editCells[6].value) || null,
            category_id: parseInt(editCells[7].value) || null,
            provider_id: parseInt(editCells[8].value) || null,
            low_units_quantity: parseInt(editCells[9].value) || 0
        };
        
        // Get selected market IDs from multi-select (editCells[10])
        const marketsContainer = editCells[10];
        console.log('Markets container:', marketsContainer);
        console.log('Has _getSelectedIds:', typeof marketsContainer._getSelectedIds);
        const selectedMarketIds = marketsContainer._getSelectedIds ? marketsContainer._getSelectedIds() : [];
        console.log('Selected market IDs:', selectedMarketIds);
        
        // Validate required fields
        if (!newItem.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        if (!newItem.inventory_type_id) {
            Components.showToast('Inventory Type is required', 'error');
            editCells[1].focus();
            return;
        }
        if (!newItem.units_per_package || newItem.units_per_package < 1) {
            Components.showToast('Units per Package must be at least 1', 'error');
            editCells[5].focus();
            return;
        }
        if (!newItem.unit_of_measure_id) {
            Components.showToast('Unit of Measure is required', 'error');
            editCells[6].focus();
            return;
        }
        if (!newItem.provider_id) {
            Components.showToast('Provider is required', 'error');
            editCells[8].focus();
            return;
        }
        
        // Add timestamps
        newItem.created_at = getLocalTimestamp();
        newItem.updated_at = getLocalTimestamp();
        
        // Insert the new item
        const result = await Database.insert('item_types', newItem);
        
        if (!result.isOk) {
            Components.showToast('Error creating item type', 'error');
            return;
        }
        
        const newItemId = result.value[0]?.id;
        console.log('New item ID:', newItemId);
        
        if (!newItemId) {
            Components.showToast('Error retrieving new item ID', 'error');
            return;
        }
        
        // Add market associations
        for (const marketId of selectedMarketIds) {
            await Database.insert('item_type_markets', {
                item_type_id: newItemId,
                market_id: marketId,
                is_primary: false,
                created_at: getLocalTimestamp()
            });
        }
        
        // Cleanup event listeners
        if (marketsContainer._cleanup) {
            marketsContainer._cleanup();
        }
        
        // Refresh cached tables
        await refreshCachedTable('item_types');
        await refreshCachedTable('item_type_markets');
        
        Components.showToast('Item type created successfully', 'success');
        
        // Remove add row and action row
        addRow.remove();
        actionRow.remove();
        
        // Refresh the view
        Views.render('manage-items');
        
    } catch (error) {
        console.error('Error creating item type:', error);
        Components.showToast('Error creating item type', 'error');
    }
}

function showEditItemTypeModal(item) {
    console.log('Edit item type:', item);
}

// Create markets multi-select dropdown with checkboxes
function createMarketsMultiSelect(selectedMarketIds, allMarkets) {
    const container = createElement('div', { 
        className: 'markets-multiselect-container',
        style: { position: 'relative', width: '100%' }
    });
    
    // Create display button
    const displayButton = createElement('button', {
        type: 'button',
        className: 'markets-multiselect-button',
        style: {
            width: '100%',
            padding: '0.375rem',
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
            backgroundColor: 'white',
            textAlign: 'left',
            cursor: 'pointer',
            fontSize: '0.875rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        }
    });
    
    // Create dropdown panel
    const dropdown = createElement('div', {
        className: 'markets-multiselect-dropdown',
        style: {
            display: 'none',
            position: 'absolute',
            top: '100%',
            left: '0',
            right: '0',
            maxHeight: '250px',
            overflowY: 'auto',
            backgroundColor: 'white',
            border: '1px solid #d1d5db',
            borderRadius: '0.25rem',
            marginTop: '2px',
            zIndex: '1000',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
        }
    });
    
    // Track selected markets
    let selectedIds = [...selectedMarketIds];
    
    // Update display text
    const updateDisplay = () => {
        const selectedCount = selectedIds.length;
        const text = selectedCount === 0 
            ? 'Select markets...' 
            : selectedCount === 1 
                ? allMarkets.find(m => m.id === selectedIds[0])?.name || '1 market'
                : `${selectedCount} markets selected`;
        
        displayButton.innerHTML = '';
        displayButton.appendChild(createElement('span', {}, [text]));
        displayButton.appendChild(createElement('span', { style: { marginLeft: 'auto' } }, ['▼']));
    };
    
    // Create checkboxes for each market
    allMarkets.forEach(market => {
        const isChecked = selectedIds.includes(market.id);
        
        const checkboxContainer = createElement('label', {
            style: {
                display: 'flex',
                alignItems: 'center',
                padding: '0.5rem',
                cursor: 'pointer',
                borderBottom: '1px solid #f3f4f6'
            },
            onmouseover: function() {
                this.style.backgroundColor = '#f9fafb';
            },
            onmouseout: function() {
                this.style.backgroundColor = 'white';
            }
        });
        
        const checkbox = createElement('input', {
            type: 'checkbox',
            'data-market-id': market.id,
            style: {
                marginRight: '0.5rem',
                width: '16px',
                height: '16px',
                cursor: 'pointer'
            },
            onclick: (e) => {
                e.stopPropagation();
                const marketId = parseInt(e.target.getAttribute('data-market-id'));
                
                if (e.target.checked) {
                    if (!selectedIds.includes(marketId)) {
                        selectedIds.push(marketId);
                    }
                } else {
                    selectedIds = selectedIds.filter(id => id !== marketId);
                }
                
                updateDisplay();
            }
        });
        
        // Set checked state after creation
        checkbox.checked = isChecked;
        
        const label = createElement('span', {}, [market.name]);
        
        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
        dropdown.appendChild(checkboxContainer);
    });
    
    // Toggle dropdown on button click
    displayButton.onclick = (e) => {
        e.stopPropagation();
        const isVisible = dropdown.style.display === 'block';
        dropdown.style.display = isVisible ? 'none' : 'block';
    };
    
    // Close dropdown when clicking outside
    const closeDropdown = (e) => {
        if (!container.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    };
    
    // Add event listener after a short delay to avoid immediate closure
    setTimeout(() => {
        document.addEventListener('click', closeDropdown);
        // Store cleanup function
        container._cleanup = () => document.removeEventListener('click', closeDropdown);
    }, 100);
    
    // Store selected IDs getter
    container._getSelectedIds = () => selectedIds;
    
    updateDisplay();
    
    container.appendChild(displayButton);
    container.appendChild(dropdown);
    
    return container;
}

    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    window.showAddItemTypeModal = showAddItemTypeModal;
    window.saveNewItemType = saveNewItemType;
    window.createMarketsMultiSelect = createMarketsMultiSelect;

})();

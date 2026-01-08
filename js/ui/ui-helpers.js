/**
 * UI Helper Functions
 * Contains inline editing and hierarchy rendering functions
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // INLINE EDITING FUNCTIONS
    // ========================================

function enableInlineEdit(row, item, state) {
    // Mark row as editing
    row.classList.add('editing');
    
    // Store original data for cancel
    const originalHTML = row.innerHTML;
    
    // Get all cells
    const cells = row.querySelectorAll('td');
    
    // Get lookup data
    const inventoryTypes = state.inventoryTypes || [];
    const categories = state.categories || [];
    const uoms = state.unitsOfMeasure || [];
    const providers = state.providers || [];
    const markets = state.markets || [];
    
    // Find original item data from state
    const originalItem = state.itemTypes.find(it => it.id === item.id);
    
    // Build edit cells
    const editCells = [
        // Name (required)
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            value: originalItem?.name || '',
            style: { width: '100%' }
        }),
        // Type (inventory_type_id) (required)
        (() => {
            const select = createElement('select', {
                className: 'inline-edit-select required-field',
                style: { width: '100%' }
            }, [
                createElement('option', { value: '' }, ['-- Select --']),
                ...inventoryTypes.map(it => 
                    createElement('option', { value: it.id }, [it.name])
                )
            ]);
            // Set value after creation
            if (originalItem?.inventory_type_id) {
                select.value = originalItem.inventory_type_id;
            }
            return select;
        })(),
        // Manufacturer
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            value: originalItem?.manufacturer || '',
            style: { width: '100%' }
        }),
        // Part Number
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            value: originalItem?.part_number || '',
            style: { width: '100%' }
        }),
        // Description
        createElement('textarea', {
            className: 'inline-edit-textarea',
            style: { width: '100%', minHeight: '60px', resize: 'vertical' }
        }, [originalItem?.description || '']),
        // Units per Package (required)
        createElement('input', {
            type: 'number',
            className: 'inline-edit-input required-field',
            value: originalItem?.units_per_package || 1,
            min: 1,
            style: { width: '100%', textAlign: 'center' }
        }),
        // UOM (required)
        (() => {
            const select = createElement('select', {
                className: 'inline-edit-select required-field',
                style: { width: '100%' }
            }, [
                createElement('option', { value: '' }, ['-- Select --']),
                ...uoms.map(u => 
                    createElement('option', { value: u.id }, [u.name])
                )
            ]);
            // Set value after creation
            if (originalItem?.unit_of_measure_id) {
                select.value = originalItem.unit_of_measure_id;
            }
            return select;
        })(),
        // Category
        (() => {
            const select = createElement('select', {
                className: 'inline-edit-select',
                style: { width: '100%' }
            }, [
                createElement('option', { value: '' }, ['-- Select --']),
                ...categories.map(c => 
                    createElement('option', { value: c.id }, [c.name])
                )
            ]);
            // Set value after creation
            if (originalItem?.category_id) {
                select.value = originalItem.category_id;
            }
            return select;
        })(),
        // Provider (required)
        (() => {
            const select = createElement('select', {
                className: 'inline-edit-select required-field',
                style: { width: '100%' }
            }, [
                createElement('option', { value: '' }, ['-- Select --']),
                ...providers.map(p => 
                    createElement('option', { value: p.id }, [p.name])
                )
            ]);
            // Set value after creation
            if (originalItem?.provider_id) {
                select.value = originalItem.provider_id;
            }
            return select;
        })(),
        // Low Quantity Alert
        createElement('input', {
            type: 'number',
            className: 'inline-edit-input',
            value: originalItem?.low_units_quantity || 0,
            min: 0,
            style: { width: '100%', textAlign: 'center' }
        }),
        // Markets (multi-select dropdown)
        createMarketsMultiSelect(item.marketIds || [], markets),
        // Use Count (read-only)
        createElement('div', {
            style: {
                textAlign: 'center',
                fontWeight: 'bold',
                color: item.useCount > 0 ? '#28a745' : '#999'
            }
        }, [String(item.useCount)])
    ];
    
    // Replace cell contents
    cells.forEach((cell, index) => {
        if (index < editCells.length) {
            cell.innerHTML = '';
            cell.appendChild(editCells[index]);
        }
    });
    
    // Add action buttons in a new row
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
                    
                    // Cancel edit
                    row.innerHTML = originalHTML;
                    row.classList.remove('editing');
                    const actionRow = row.nextElementSibling;
                    if (actionRow && actionRow.classList.contains('edit-actions-row')) {
                        actionRow.remove();
                    }
                    // Re-select the row
                    row.classList.add('selected');
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveInlineEdit(row, item.id, editCells, originalHTML)
            }, ['Save Changes'])
        ])
    ]);
    
    // Insert action row after current row
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    
    // Update button states
    const addBtn = byId('add-item-type-btn');
    const editBtn = byId('edit-item-type-btn');
    const deleteBtn = byId('delete-item-type-btn');
    
    if (addBtn) addBtn.disabled = true;
    if (editBtn) editBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    
    // Focus first input
    const firstInput = row.querySelector('input, select, textarea');
    if (firstInput) firstInput.focus();
}

// Save inline edit
async function saveInlineEdit(row, itemId, editCells, originalHTML) {
    try {
        // Get the state to access original item data
        const currentState = Store.getState();
        const originalItem = currentState.itemTypes.find(it => it.id === itemId);
        
        // Extract values from edit cells
        const updates = {
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
        const selectedMarketIds = marketsContainer._getSelectedIds ? marketsContainer._getSelectedIds() : [];
        
        // Validate required fields
        if (!updates.name) {
            Components.showToast('Name is required', 'error');
            return;
        }
        if (!updates.inventory_type_id) {
            Components.showToast('Inventory Type is required', 'error');
            return;
        }
        if (!updates.unit_of_measure_id) {
            Components.showToast('Unit of Measure is required', 'error');
            return;
        }
        if (!updates.provider_id) {
            Components.showToast('Provider is required', 'error');
            return;
        }
        
        // Check if inventory type is changing
        if (originalItem && originalItem.inventory_type_id !== updates.inventory_type_id) {
            const useCount = parseInt(row.getAttribute('data-use-count')) || 0;
            const originalTypeName = currentState.inventoryTypes.find(it => it.id === originalItem.inventory_type_id)?.name || 'Unknown';
            const newTypeName = currentState.inventoryTypes.find(it => it.id === updates.inventory_type_id)?.name || 'Unknown';
            
            const confirmed = confirm(
                `⚠️ WARNING: Changing Inventory Type\n\n` +
                `You are changing the inventory type from "${originalTypeName}" to "${newTypeName}".\n\n` +
                `This item type has ${useCount} inventory record(s) in use.\n\n` +
                `Changing the inventory type will affect:\n` +
                `• How this item appears in inventory lists\n` +
                `• How quantities are tracked (serialized vs bulk)\n` +
                `• Which operations are available for this item\n\n` +
                `Are you sure you want to proceed?`
            );
            
            if (!confirmed) {
                Components.showToast('Update cancelled', 'info');
                return;
            }
        }
        
        // Update the item
        const result = await Database.update('item_types', itemId, updates);
        
        if (!result.isOk) {
            Components.showToast('Error updating item type', 'error');
            return;
        }
        
        // Update market associations
        const currentAssociations = (currentState.itemTypeMarkets || [])
            .filter(itm => itm.item_type_id === itemId);
        const currentMarketIds = currentAssociations.map(itm => itm.market_id);
        
        // Determine what to add and what to remove
        const toAdd = selectedMarketIds.filter(id => !currentMarketIds.includes(id));
        const toRemove = currentMarketIds.filter(id => !selectedMarketIds.includes(id));
        
        // Remove unchecked associations
        for (const marketId of toRemove) {
            const association = currentAssociations.find(a => a.market_id === marketId);
            if (association && association.id) {
                await Database.deleteRecord('item_type_markets', association.id);
            }
        }
        
        // Add new associations
        for (const marketId of toAdd) {
            await Database.insert('item_type_markets', {
                item_type_id: itemId,
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
        
        Components.showToast('Item type updated successfully', 'success');
        
        // Remove editing state and action row
        row.classList.remove('editing');
        const actionRow = row.nextElementSibling;
        if (actionRow && actionRow.classList.contains('edit-actions-row')) {
            actionRow.remove();
        }
        
        // Check if in duplicate mode and exit it
        const duplicateBtn = byId('identify-duplicates-btn');
        if (duplicateBtn && duplicateBtn.classList.contains('active')) {
            // Exit duplicate mode
            toggleDuplicateHighlighting();
        }
        
        // Refresh the view
        Views.render('manage-items');
        
    } catch (error) {
        console.error('Error saving item type:', error);
        Components.showToast('Error saving changes', 'error');
    }
}

function showManageItemMarketsModal(item) {
    const state = Store.getState();
    
    // Get current market associations for this item
    const currentMarketIds = item.marketIds || [];
    
    // Build checkboxes for all markets
    const marketCheckboxes = state.markets.map(market => {
        const isChecked = currentMarketIds.includes(market.id);
        
        return createElement('label', { 
            className: 'market-checkbox-item',
            style: { backgroundColor: isChecked ? '#e7f3ff' : 'white' }
        }, [
            createElement('input', {
                type: 'checkbox',
                className: 'market-checkbox',
                'data-market-id': market.id,
                checked: isChecked
            }),
            createElement('span', {}, [market.name])
        ]);
    });
    
    const modalContent = div({}, [
        createElement('h3', { className: 'market-modal-title' }, [`Manage Markets for: ${item.name}`]),
        div({ className: 'market-modal-description' }, [
            'Select which markets this item type should be available in:'
        ]),
        div({ className: 'market-modal-list' }, marketCheckboxes),
        div({ className: 'market-modal-actions' }, [
            createElement('button', {
                className: 'btn btn-secondary',
                onclick: () => Components.closeModal()
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-primary',
                onclick: () => saveItemMarketAssociations(item.id)
            }, ['Save'])
        ])
    ]);
    
    Components.showModal(modalContent);
}

async function saveItemMarketAssociations(itemTypeId) {
    const state = Store.getState();
    
    // Get all checked markets
    const checkboxes = document.querySelectorAll('.market-checkbox');
    const selectedMarketIds = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => parseInt(cb.getAttribute('data-market-id')));
    
    try {
        // Get current associations
        const currentAssociations = (state.itemTypeMarkets || [])
            .filter(itm => itm.item_type_id === itemTypeId);
        const currentMarketIds = currentAssociations.map(itm => itm.market_id);
        
        // Determine what to add and what to remove
        const toAdd = selectedMarketIds.filter(id => !currentMarketIds.includes(id));
        const toRemove = currentMarketIds.filter(id => !selectedMarketIds.includes(id));
        
        // Remove unchecked associations
        for (const marketId of toRemove) {
            const association = currentAssociations.find(a => a.market_id === marketId);
            if (association && association.id) {
                const deleteResult = await Database.deleteRecord('item_type_markets', association.id);
                if (!deleteResult.isOk) {
                    console.error('Error deleting association:', deleteResult.error);
                }
            }
        }
        
        // Add new associations
        for (const marketId of toAdd) {
            const insertResult = await Database.insert('item_type_markets', {
                item_type_id: itemTypeId,
                market_id: marketId,
                is_primary: false,
                created_at: getLocalTimestamp()
            });
            if (!insertResult.isOk) {
                console.error('Error inserting association:', insertResult.error);
            }
        }
        
        // Refresh the cached table
        await refreshCachedTable('item_type_markets');
        
        Components.showToast(`Updated market associations (${selectedMarketIds.length} markets)`, 'success');
        Components.closeModal();
        
        // Refresh the view
        Views.render('manage-items');
        
    } catch (error) {
        console.error('Error saving market associations:', error);
        Components.showToast('Error saving market associations', 'error');
    }
}

// ============ CREW MANAGEMENT FUNCTIONS ============

// Handle crew row selection
function handleCrewRowSelection(row) {
    const isCurrentlySelected = row.classList.contains('selected');
    
    // Deselect all rows
    document.querySelectorAll('.crew-row').forEach(r => r.classList.remove('selected'));
    
    // Toggle selection
    if (!isCurrentlySelected) {
        row.classList.add('selected');
    }
    
    // Update button states
    const editBtn = byId('edit-crew-btn');
    const deleteBtn = byId('delete-crew-btn');
    
    if (!isCurrentlySelected) {
        if (editBtn) editBtn.disabled = false;
        if (deleteBtn) deleteBtn.disabled = false;
    } else {
        if (editBtn) editBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
    }
}

// Show add crew row
function showAddCrewRow() {
    const state = Store.getState();
    const table = byId('crews-table');
    
    if (!table) {
        Components.showToast('Table not found', 'error');
        return;
    }
    
    // Check if already adding
    const existingAddRow = document.querySelector('.crew-add-row');
    if (existingAddRow) {
        Components.showToast('Already adding a new crew', 'warning');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const markets = state.markets || [];
    
    // Create edit cells
    const editCells = [
        // Name (required)
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            placeholder: 'Crew name',
            style: { width: '100%' }
        }),
        // Market (required)
        createElement('select', {
            className: 'inline-edit-select required-field',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => 
                createElement('option', { value: m.id }, [m.name])
            )
        ]),
        // Information (optional)
        createElement('textarea', {
            className: 'inline-edit-input',
            placeholder: 'General information (contact, address, etc.)',
            rows: 5,
            style: { width: '100%', resize: 'vertical' }
        }),
        // Use Count (not applicable for new)
        createElement('div', {
            style: { textAlign: 'center', color: '#999' }
        }, ['-']),
        // Created (not applicable for new)
        createElement('div', {
            style: { textAlign: 'center', color: '#999' }
        }, ['-'])
    ];
    
    // Create add row
    const addRow = createElement('tr', {
        className: 'crew-row crew-add-row editing',
        style: { cursor: 'default' }
    }, editCells.map(cell => createElement('td', {}, [cell])));
    
    // Create action buttons row
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' } }, [
            createElement('button', {
                className: 'btn btn-sm btn-secondary',
                style: { marginRight: '0.5rem' },
                onclick: () => {
                    addRow.remove();
                    actionRow.remove();
                    const addBtn = byId('add-crew-btn');
                    if (addBtn) addBtn.disabled = false;
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveNewCrew(editCells, addRow, actionRow)
            }, ['Create Crew'])
        ])
    ]);
    
    // Append rows
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    
    // Disable add button
    const addBtn = byId('add-crew-btn');
    if (addBtn) addBtn.disabled = true;
    
    // Focus first input
    editCells[0].focus();
    
    // Scroll to bottom
    addRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Save new crew
async function saveNewCrew(editCells, addRow, actionRow) {
    try {
        const newCrew = {
            name: editCells[0].value.trim(),
            market_id: parseInt(editCells[1].value) || null,
            information: editCells[2].value.trim() || null
        };
        
        // Validate required fields
        if (!newCrew.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        if (!newCrew.market_id) {
            Components.showToast('Market is required', 'error');
            editCells[1].focus();
            return;
        }
        
        // Add timestamps
        newCrew.created_at = getLocalTimestamp();
        newCrew.updated_at = getLocalTimestamp();
        
        // Insert the new crew (DB wrapper auto-refreshes cached tables)
        const result = await DB.insert('crews', newCrew);
        
        if (!result.isOk) {
            Components.showToast('Error creating crew', 'error');
            return;
        }
        
        // Explicitly wait for cache refresh to complete
        await refreshCachedTable('crews');
        
        Components.showToast('Crew created successfully', 'success');
        
        // Remove add row and action row
        addRow.remove();
        actionRow.remove();
        
        // Refresh the view
        Views.render('manage-crews');
        
    } catch (error) {
        console.error('Error creating crew:', error);
        Components.showToast('Error creating crew', 'error');
    }
}

// Enable inline editing for crew row
function enableCrewInlineEdit(row, crew, state) {
    // Check if already editing
    if (row.classList.contains('editing')) {
        return;
    }
    
    // Mark row as editing
    row.classList.add('editing');
    
    // Store original data for cancel
    const originalHTML = row.innerHTML;
    
    // Get all cells
    const cells = row.querySelectorAll('td');
    
    const markets = state.markets || [];
    
    // Debug: Log crew.market_id and market IDs
    console.log('Crew market_id:', crew.market_id, 'Type:', typeof crew.market_id);
    console.log('Available markets:', markets.map(m => ({ id: m.id, name: m.name, type: typeof m.id })));
    
    // Build edit cells
    const editCells = [
        // Name (required)
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            value: crew.name || '',
            style: { width: '100%' }
        }),
        // Market (required)
        createElement('select', {
            className: 'inline-edit-select required-field',
            style: { width: '100%' }
        }, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => {
                const isSelected = m.id === crew.market_id;
                console.log(`Market ${m.name} (${m.id}): selected=${isSelected}`);
                return createElement('option', { 
                    value: m.id,
                    selected: isSelected
                }, [m.name]);
            })
        ]),
        // Information (optional)
        createElement('textarea', {
            className: 'inline-edit-input',
            value: crew.information || '',
            rows: 5,
            style: { width: '100%', resize: 'vertical' }
        }),
        // Use Count (read-only)
        createElement('div', {
            style: { textAlign: 'center', color: '#666' }
        }, [String(crew.useCount)]),
        // Created (read-only)
        createElement('div', {
            style: { textAlign: 'center', color: '#666' }
        }, [new Date(crew.created_at).toLocaleDateString()])
    ];
    
    // Replace cell contents
    cells.forEach((cell, index) => {
        cell.innerHTML = '';
        cell.appendChild(editCells[index]);
    });
    
    // Explicitly set market dropdown value (fallback for selected attribute)
    const marketSelect = editCells[1];
    if (marketSelect && crew.market_id) {
        marketSelect.value = crew.market_id;
        console.log('Explicitly set market dropdown to:', crew.market_id, 'Result:', marketSelect.value);
    }
    
    // Create action buttons row
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' } }, [
            createElement('button', {
                className: 'btn btn-sm btn-secondary',
                style: { marginRight: '0.5rem' },
                onclick: () => {
                    row.classList.remove('editing');
                    row.classList.remove('selected');
                    row.innerHTML = originalHTML;
                    actionRow.remove();
                    
                    // Re-attach click handler
                    row.onclick = function() {
                        handleCrewRowSelection(this);
                    };
                    
                    // Re-enable buttons
                    const editBtn = byId('edit-crew-btn');
                    const deleteBtn = byId('delete-crew-btn');
                    const addBtn = byId('add-crew-btn');
                    if (editBtn) editBtn.disabled = true;
                    if (deleteBtn) deleteBtn.disabled = true;
                    if (addBtn) addBtn.disabled = false;
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveCrewInlineEdit(row, crew.id, editCells, originalHTML)
            }, ['Save Changes'])
        ])
    ]);
    
    // Insert action row after current row
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    
    // Disable row selection while editing
    row.onclick = null;
    
    // Disable action buttons
    const editBtn = byId('edit-crew-btn');
    const deleteBtn = byId('delete-crew-btn');
    const addBtn = byId('add-crew-btn');
    if (editBtn) editBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    if (addBtn) addBtn.disabled = true;
}


function renderClientsSection(state) {
    const clients = state.clients || [];
    
    // Calculate use count for each client (count markets)
    const enrichedClients = clients.map(client => {
        const useCount = (state.markets || []).filter(m => m.client_id === client.id).length;
        return { ...client, useCount };
    });
    
    return div({}, [
        // Action buttons
        div({ style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            button('Add Client', {
                id: 'add-client-btn',
                className: 'btn btn-primary',
                style: { marginRight: '0.5rem' },
                onclick: () => showAddClientRow()
            }),
            button('Edit Client', {
                id: 'edit-client-btn',
                className: 'btn btn-secondary',
                style: { marginRight: '0.5rem' },
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.client-row.selected');
                    if (selectedRow) {
                        const clientId = parseInt(selectedRow.getAttribute('data-client-id'));
                        const client = enrichedClients.find(c => c.id === clientId);
                        if (client) enableClientInlineEdit(selectedRow, client, state);
                    }
                }
            }),
            button('Delete Client', {
                id: 'delete-client-btn',
                className: 'btn btn-danger',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.client-row.selected');
                    if (selectedRow) {
                        const clientId = parseInt(selectedRow.getAttribute('data-client-id'));
                        const client = enrichedClients.find(c => c.id === clientId);
                        if (client) deleteClientRecord(client);
                    }
                }
            })
        ]),
        
        // Legend
        div({ style: { marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('strong', {}, ['Legend: ']),
            createElement('span', { 
                style: { 
                    display: 'inline-block', 
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                }
            }, ['Required Field'])
        ]),
        
        enrichedClients.length > 0
            ? createElement('table', {
                id: 'clients-table',
                className: 'data-table',
                style: { width: '100%', borderCollapse: 'collapse' }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Name']),
                        createElement('th', {}, ['Address']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Markets Count']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Created'])
                    ])
                ]),
                createElement('tbody', {}, 
                    enrichedClients.map(client => 
                        createElement('tr', {
                            className: 'client-row hierarchy-row',
                            'data-client-id': client.id,
                            style: { cursor: 'pointer' },
                            onclick: function() {
                                handleHierarchyRowSelection(this, 'client');
                            }
                        }, [
                            createElement('td', {}, [client.name || '']),
                            createElement('td', {}, [client.address || '-']),
                            createElement('td', { style: { textAlign: 'center' } }, [String(client.useCount)]),
                            createElement('td', { style: { textAlign: 'center' } }, [
                                new Date(client.created_at).toLocaleDateString()
                            ])
                        ])
                    )
                )
            ])
            : Components.emptyState('No clients defined', '🏢')
    ]);
}

// Render Markets Section
function renderMarketsSection(state) {
    const markets = state.markets || [];
    const clients = state.clients || [];
    
    const enrichedMarkets = markets.map(market => {
        const client = clients.find(c => c.id === market.client_id);
        const useCount = (state.slocs || []).filter(s => s.market_id === market.id).length;
        return { ...market, clientName: client?.name || 'Unknown', useCount };
    });
    
    return div({}, [
        div({ style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            button('Add Market', {
                id: 'add-market-btn',
                className: 'btn btn-primary',
                onclick: () => showAddMarketRow()
            }),
            button('Edit Market', {
                id: 'edit-market-btn',
                className: 'btn btn-secondary',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.market-row.selected');
                    if (selectedRow) {
                        const marketId = parseInt(selectedRow.getAttribute('data-market-id'));
                        const market = enrichedMarkets.find(m => m.id === marketId);
                        if (market) enableMarketInlineEdit(selectedRow, market, state);
                    }
                }
            }),
            button('Delete Market', {
                id: 'delete-market-btn',
                className: 'btn btn-danger',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.market-row.selected');
                    if (selectedRow) {
                        const marketId = parseInt(selectedRow.getAttribute('data-market-id'));
                        const market = enrichedMarkets.find(m => m.id === marketId);
                        if (market) deleteMarketRecord(market);
                    }
                }
            })
        ]),
        
        // Legend
        div({ style: { marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('strong', {}, ['Legend: ']),
            createElement('span', { 
                style: { 
                    display: 'inline-block', 
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                }
            }, ['Required Field'])
        ]),
        
        enrichedMarkets.length > 0
            ? createElement('table', {
                id: 'markets-table',
                className: 'data-table',
                style: { width: '100%', borderCollapse: 'collapse' }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Name']),
                        createElement('th', {}, ['Client']),
                        createElement('th', { style: { textAlign: 'center' } }, ['SLOCs Count']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Created'])
                    ])
                ]),
                createElement('tbody', {}, 
                    enrichedMarkets.map(market => 
                        createElement('tr', {
                            className: 'market-row hierarchy-row',
                            'data-market-id': market.id,
                            style: { cursor: 'pointer' },
                            onclick: function() {
                                handleHierarchyRowSelection(this, 'market');
                            }
                        }, [
                            createElement('td', {}, [market.name || '']),
                            createElement('td', {}, [market.clientName]),
                            createElement('td', { style: { textAlign: 'center' } }, [String(market.useCount)]),
                            createElement('td', { style: { textAlign: 'center' } }, [
                                new Date(market.created_at).toLocaleDateString()
                            ])
                        ])
                    )
                )
            ])
            : Components.emptyState('No markets defined', '🏪')
    ]);
}

// Render SLOCs Section
function renderSlocsSection(state) {
    const slocs = state.slocs || [];
    const markets = state.markets || [];
    
    const enrichedSlocs = slocs.map(sloc => {
        const market = markets.find(m => m.id === sloc.market_id);
        const useCount = (state.areas || []).filter(a => a.sloc_id === sloc.id).length;
        return { ...sloc, marketName: market?.name || 'Unknown', useCount };
    });
    
    return div({}, [
        div({ style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            button('Add SLOC', {
                id: 'add-sloc-btn',
                className: 'btn btn-primary',
                onclick: () => showAddSlocRow()
            }),
            button('Edit SLOC', {
                id: 'edit-sloc-btn',
                className: 'btn btn-secondary',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.sloc-row.selected');
                    if (selectedRow) {
                        const slocId = parseInt(selectedRow.getAttribute('data-sloc-id'));
                        const sloc = enrichedSlocs.find(s => s.id === slocId);
                        if (sloc) enableSlocInlineEdit(selectedRow, sloc, state);
                    }
                }
            }),
            button('Delete SLOC', {
                id: 'delete-sloc-btn',
                className: 'btn btn-danger',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.sloc-row.selected');
                    if (selectedRow) {
                        const slocId = parseInt(selectedRow.getAttribute('data-sloc-id'));
                        const sloc = enrichedSlocs.find(s => s.id === slocId);
                        if (sloc) deleteSlocRecord(sloc);
                    }
                }
            })
        ]),
        
        // Legend
        div({ style: { marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('strong', {}, ['Legend: ']),
            createElement('span', { 
                style: { 
                    display: 'inline-block', 
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                }
            }, ['Required Field'])
        ]),
        
        enrichedSlocs.length > 0
            ? createElement('table', {
                id: 'slocs-table',
                className: 'data-table',
                style: { width: '100%', borderCollapse: 'collapse' }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Name']),
                        createElement('th', {}, ['Address']),
                        createElement('th', {}, ['Market']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Areas Count']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Created'])
                    ])
                ]),
                createElement('tbody', {}, 
                    enrichedSlocs.map(sloc => 
                        createElement('tr', {
                            className: 'sloc-row hierarchy-row',
                            'data-sloc-id': sloc.id,
                            style: { cursor: 'pointer' },
                            onclick: function() {
                                handleHierarchyRowSelection(this, 'sloc');
                            }
                        }, [
                            createElement('td', {}, [sloc.name || '']),
                            createElement('td', {}, [sloc.address || '-']),
                            createElement('td', {}, [sloc.marketName]),
                            createElement('td', { style: { textAlign: 'center' } }, [String(sloc.useCount)]),
                            createElement('td', { style: { textAlign: 'center' } }, [
                                new Date(sloc.created_at).toLocaleDateString()
                            ])
                        ])
                    )
                )
            ])
            : Components.emptyState('No SLOCs defined', '📍')
    ]);
}

// Render Areas Section
function renderAreasSection(state) {
    const areas = state.areas || [];
    const slocs = state.slocs || [];
    
    const enrichedAreas = areas.map(area => {
        const sloc = slocs.find(s => s.id === area.sloc_id);
        const useCount = 0; // Placeholder - calculate actual usage
        return { ...area, slocName: sloc?.name || 'Unknown', useCount };
    });
    
    return div({}, [
        div({ style: { marginBottom: '1rem', display: 'flex', gap: '0.5rem' } }, [
            button('Add Area', {
                id: 'add-area-btn',
                className: 'btn btn-primary',
                onclick: () => showAddAreaRow()
            }),
            button('Edit Area', {
                id: 'edit-area-btn',
                className: 'btn btn-secondary',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.area-row.selected');
                    if (selectedRow) {
                        const areaId = parseInt(selectedRow.getAttribute('data-area-id'));
                        const area = enrichedAreas.find(a => a.id === areaId);
                        if (area) enableAreaInlineEdit(selectedRow, area, state);
                    }
                }
            }),
            button('Delete Area', {
                id: 'delete-area-btn',
                className: 'btn btn-danger',
                disabled: true,
                onclick: () => {
                    const selectedRow = document.querySelector('.area-row.selected');
                    if (selectedRow) {
                        const areaId = parseInt(selectedRow.getAttribute('data-area-id'));
                        const area = enrichedAreas.find(a => a.id === areaId);
                        if (area) deleteAreaRecord(area);
                    }
                }
            })
        ]),
        
        // Legend
        div({ style: { marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('strong', {}, ['Legend: ']),
            createElement('span', { 
                style: { 
                    display: 'inline-block', 
                    marginLeft: '0.5rem',
                    padding: '0.25rem 0.5rem',
                    backgroundColor: '#fee',
                    border: '1px solid #fcc',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem'
                }
            }, ['Required Field'])
        ]),
        
        enrichedAreas.length > 0
            ? createElement('table', {
                id: 'areas-table',
                className: 'data-table',
                style: { width: '100%', borderCollapse: 'collapse' }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Name']),
                        createElement('th', {}, ['SLOC']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Use Count']),
                        createElement('th', { style: { textAlign: 'center' } }, ['Created'])
                    ])
                ]),
                createElement('tbody', {}, 
                    enrichedAreas.map(area => 
                        createElement('tr', {
                            className: 'area-row hierarchy-row',
                            'data-area-id': area.id,
                            style: { cursor: 'pointer' },
                            onclick: function() {
                                handleHierarchyRowSelection(this, 'area');
                            }
                        }, [
                            createElement('td', {}, [area.name || '']),
                            createElement('td', {}, [area.slocName]),
                            createElement('td', { style: { textAlign: 'center' } }, [String(area.useCount)]),
                            createElement('td', { style: { textAlign: 'center' } }, [
                                new Date(area.created_at).toLocaleDateString()
                            ])
                        ])
                    )
                )
            ])
            : Components.emptyState('No areas defined', '📍')
    ]);
}


    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    // Inline editing functions
    window.enableInlineEdit = enableInlineEdit;
    window.saveInlineEdit = saveInlineEdit;
    window.enableCrewInlineEdit = enableCrewInlineEdit;

    // Crew management functions
    window.showAddCrewRow = showAddCrewRow;
    window.handleCrewRowSelection = handleCrewRowSelection;

    // Hierarchy render functions
    window.renderClientsSection = renderClientsSection;
    window.renderMarketsSection = renderMarketsSection;
    window.renderSlocsSection = renderSlocsSection;
    window.renderAreasSection = renderAreasSection;

})();

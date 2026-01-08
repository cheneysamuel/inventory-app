/**
 * Inventory Modals - Modal dialogs for inventory actions
 * Extracted from views.js to improve modularity
 */

const InventoryModals = (() => {
    
    /**
     * Show modal with list of consolidated items
     * @param {Object} row - Consolidated row object with items array
     */
    const showConsolidatedItems = (row) => {
        const state = Store.getState();
        
        const modalContent = div({}, [
            createElement('h3', { style: { margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' } }, [
                'Consolidated Items'
            ]),
            createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                `This row represents ${row.items.length} individual inventory items with the same location, crew, area, item type, and status.`
            ]),
            div({ style: { marginBottom: '1rem', padding: '0.75rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
                createElement('strong', {}, ['Summary:']),
                createElement('div', { style: { marginTop: '0.5rem', fontSize: '0.875rem' } }, [
                    `Location: ${row.location ? row.location.name : '-'}`,
                    createElement('br'),
                    `Crew: ${row.crew ? row.crew.name : '-'}`,
                    createElement('br'),
                    `Area: ${row.area ? row.area.name : '-'}`,
                    createElement('br'),
                    `Item: ${row.itemType ? row.itemType.name : '-'}`,
                    createElement('br'),
                    `Category: ${row.category ? row.category.name : '-'}`,
                    createElement('br'),
                    `Total Quantity: ${row.quantity}`,
                    createElement('br'),
                    `Status: ${row.status ? row.status.name : 'Unknown'}`
                ])
            ]),
            createElement('h4', { style: { margin: '1rem 0 0.5rem 0', fontSize: '0.9rem', fontWeight: '600' } }, [
                'Individual Items:'
            ]),
            createElement('div', { style: { maxHeight: '300px', overflowY: 'auto' } }, [
                createElement('table', { className: 'inventory-table', style: { width: '100%', fontSize: '0.875rem' } }, [
                    createElement('thead', {}, [
                        createElement('tr', {}, [
                            createElement('th', {}, ['ID']),
                            createElement('th', {}, ['Mfgr SN']),
                            createElement('th', {}, ['Tilson SN']),
                            createElement('th', {}, ['Quantity']),
                            createElement('th', {}, ['Actions'])
                        ])
                    ]),
                    createElement('tbody', {}, 
                        row.items.map(item => 
                            createElement('tr', {}, [
                                createElement('td', {}, [String(item.id)]),
                                createElement('td', {}, [item.mfgrsn || '-']),
                                createElement('td', {}, [item.tilsonsn || '-']),
                                createElement('td', {}, [String(item.quantity || 0)]),
                                createElement('td', {}, [
                                    createElement('button', {
                                        className: 'btn btn-sm btn-secondary',
                                        onclick: () => {
                                            Modals.close();
                                            showInventoryActions(item);
                                        }
                                    }, ['View'])
                                ])
                            ])
                        )
                    )
                ])
            ])
        ]);
        
        Modals.custom({
            title: 'Consolidated Inventory Row',
            content: modalContent,
            showCancel: true,
            cancelText: 'Close',
            showConfirm: false,
            size: 'large'
        });
    };
    
    /**
     * Show prompt to set sequential number for an item
     * @param {Object} item - Inventory item
     */
    const showSetSequential = (item) => {
        const promptContent = div({}, [
            createElement('p', { style: { marginBottom: '1rem' } }, ['Enter the sequential number for this item:']),
            createElement('input', {
                type: 'number',
                id: 'sequential-input',
                className: 'form-control',
                placeholder: 'Sequential number',
                min: '1',
                step: '1',
                style: { marginBottom: '1rem' }
            }),
            createElement('textarea', {
                id: 'sequential-notes',
                className: 'form-control',
                placeholder: 'Notes (optional)',
                rows: '3',
                style: { marginBottom: '0' }
            })
        ]);
        
        Modals.custom({
            title: 'Set Sequential Number',
            content: promptContent,
            confirmText: 'Save',
            cancelText: 'Cancel',
            showConfirm: true,
            showCancel: true,
            onConfirm: async () => {
                const sequentialInput = byId('sequential-input');
                const notesInput = byId('sequential-notes');
                const sequentialNumber = parseInt(sequentialInput?.value);
                const notes = notesInput?.value?.trim() || null;
                
                if (!sequentialNumber || sequentialNumber < 1) {
                    Components.showToast('Please enter a valid sequential number', 'error');
                    return false;
                }
                
                const result = await Queries.createSequential({
                    inventory_id: item.id,
                    sequential_number: sequentialNumber,
                    notes: notes
                });
                
                if (result.isOk) {
                    Components.showToast('Sequential number saved', 'success');
                    setTimeout(() => showInventoryActions(item), 300);
                    return true;
                } else {
                    Components.showToast('Failed to save sequential number', 'error');
                    return false;
                }
            }
        });
        
        setTimeout(() => {
            const input = byId('sequential-input');
            if (input) input.focus();
        }, 100);
    };
    
    /**
     * Handle inventory action selection - routes to appropriate action modal
     * @param {Object} item - Inventory item
     * @param {Object} action - Action object from database
     */
    const handleAction = (item, action) => {
        console.log('Action selected:', action.name, 'for item:', item.id);
        
        // Note: These action modal functions are still defined in views.js
        // They will be fully extracted in a future phase
        const actionRoutes = {
            'Issue': () => window.showIssueActionModal([item], action, { requireSelections: true }),
            'Return Material': () => window.showReturnMaterialModal([item], action),
            'Field Install': () => window.showFieldInstallModal && window.showFieldInstallModal([item], action),
            'Adjust': () => window.showAdjustModal([item], action),
            'Reject': () => window.showRejectModal([item], action),
            'Inspect': () => window.showInspectModal([item], action),
            'Remove': () => window.showRemoveModal([item], action)
        };
        
        setTimeout(() => {
            const handler = actionRoutes[action.name];
            if (handler) {
                console.log(`Routing to ${action.name} action modal`);
                handler();
            } else {
                Components.showToast(`Action "${action.name}" selected. Implementation pending.`, 'info');
            }
        }, 100);
    };
    
    /**
     * Show inventory actions modal for a single item
     * @param {Object} item - Inventory item
     */
    const showInventoryActions = async (item) => {
        const state = Store.getState();
        
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const inventoryType = state.inventoryTypes?.find(it => it.id === itemType?.inventory_type_id);
        const isSerialized = inventoryType?.name?.toLowerCase() === 'serialized';
        const status = state.statuses.find(s => s.id === item.status_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
        const area = item.area_id ? (state.areas || []).find(a => a.id === item.area_id) : null;
        
        let latestSequential = null;
        if (isSerialized) {
            const sequentialResult = await Queries.getLatestSequential(item.id);
            if (sequentialResult.isOk) {
                latestSequential = sequentialResult.value;
            }
        }
        
        const availableActionsResult = InventoryActions.getAvailableActions(item.status_id);
        const availableActions = availableActionsResult.isOk ? availableActionsResult.value : [];
        
        const detailsItems = [
            createElement('div', {}, [
                createElement('strong', {}, ['Item Type: ']),
                createElement('span', {}, [itemType?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Status: ']),
                createElement('span', { className: 'status-badge' }, [status?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Location: ']),
                createElement('span', {}, [location?.name || '-'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Quantity: ']),
                createElement('span', {}, [String(item.quantity || 1)])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Mfgr. SN: ']),
                createElement('span', {}, [item.mfgrsn || '-'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Tilson SN: ']),
                createElement('span', {}, [item.tilsonsn || '-'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Crew: ']),
                createElement('span', {}, [crew?.name || '-'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Area: ']),
                createElement('span', {}, [area?.name || '-'])
            ])
        ];
        
        if (isSerialized) {
            detailsItems.push(
                createElement('div', { style: { gridColumn: '1 / -1', marginTop: '0.25rem' } }, [
                    createElement('strong', {}, ['Sequential: ']),
                    latestSequential
                        ? createElement('span', { 
                            id: 'sequential-display',
                            style: { 
                                fontFamily: 'monospace', 
                                fontSize: '1.1em', 
                                color: '#2563eb',
                                fontWeight: '600'
                            } 
                        }, [String(latestSequential.sequential_number)])
                        : createElement('button', {
                            id: 'set-sequential-btn',
                            className: 'btn btn-sm btn-secondary',
                            style: { marginLeft: '0.5rem', padding: '0.25rem 0.75rem' },
                            onclick: () => showSetSequential(item)
                        }, ['Set'])
                ])
            );
        }
        
        const modalContent = div({}, [
            div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
                createElement('h3', { style: { margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' } }, ['Item Details']),
                div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, detailsItems)
            ]),
            
            createElement('h3', { style: { margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' } }, ['Available Actions']),
            
            availableActions.length > 0
                ? div({ style: { display: 'flex', flexDirection: 'column', gap: '0.5rem' } },
                    availableActions.map(action => 
                        createElement('button', {
                            className: 'btn btn-secondary',
                            style: { 
                                textAlign: 'left', 
                                justifyContent: 'flex-start',
                                backgroundColor: action.button_bg_color || '#6b7280',
                                color: action.button_text_color || '#ffffff',
                                border: 'none'
                            },
                            onclick: () => {
                                Modals.close();
                                handleAction(item, action);
                            }
                        }, [
                            createElement('strong', {}, [action.name]),
                            action.description ? createElement('span', { style: { fontSize: '0.875rem', marginLeft: '0.5rem', opacity: '0.9' } }, [` - ${action.description}`]) : null
                        ].filter(Boolean))
                    )
                )
                : createElement('p', { style: { color: '#6b7280', fontStyle: 'italic' } }, ['No actions available for this status'])
        ]);
        
        Modals.custom({
            title: `Inventory Actions - ID: ${item.id}`,
            content: modalContent,
            showCancel: true,
            cancelText: 'Close',
            showConfirm: false
        });
    };
    
    // Public API
    return {
        showConsolidatedItems,
        showInventoryActions,
        showSetSequential,
        handleAction
    };
})();

// Make available globally
window.InventoryModals = InventoryModals;

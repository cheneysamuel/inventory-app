/**
 * Views - Page/view rendering logic
 */

const Views = (() => {
    
    // Dashboard view
    const dashboard = () => {
        const state = Store.getState();
        const inventory = state.inventory;
        
        const stats = [
            { label: 'Total Items', value: inventory.length, icon: '📦', color: 'primary' },
            { label: 'Serialized', value: Store.computed.getSerializedInventory().length, icon: '🔢', color: 'info' },
            { label: 'Bulk Items', value: Store.computed.getBulkInventory().length, icon: '📊', color: 'success' },
            { label: 'Total Quantity', value: Store.computed.getTotalInventoryValue(), icon: '➕', color: 'warning' }
        ];
        
        const content = div({}, [
            Components.pageHeader('Dashboard', 'Inventory overview and statistics'),
            
            div({ className: 'd-flex gap-2', style: { marginBottom: '2rem', flexWrap: 'wrap' } }, 
                stats.map(stat => Components.statsCard(stat.label, stat.value, stat.icon, stat.color))
            ),
            
            Components.card('Recent Transactions', 
                state.transactions.length > 0
                    ? Components.dataTable({
                        columns: [
                            { field: 'transaction_type', label: 'Type' },
                            { field: 'action', label: 'Action' },
                            { field: 'item_type_name', label: 'Item' },
                            { field: 'quantity', label: 'Qty' },
                            { field: 'date_time', label: 'Date', render: (val) => new Date(val).toLocaleString() }
                        ],
                        data: state.transactions.slice(0, 10)
                    })
                    : Components.emptyState('No transactions yet')
            )
        ]);
        
        return content;
    };
    
    // Inventory view
    const inventoryView = () => {
        const state = Store.getState();
        
        // Helper to check if status is visible
        const isStatusVisible = (statusName) => {
            const savedVisibility = JSON.parse(localStorage.getItem('statusVisibility') || '{}');
            const defaultVisible = ['Available', 'Issued', 'Rejected'].includes(statusName);
            return savedVisibility[statusName] !== undefined ? savedVisibility[statusName] : defaultVisible;
        };
        
        // Filter to bulk items (inventory_type_id === 2) for the selected SLOC
        const bulkInventory = state.inventory.filter(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            return itemType && itemType.inventory_type_id === 2;
        });
        
        // Consolidate rows by location, crew, area, item, status
        const consolidatedRows = [];
        
        bulkInventory.forEach(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const category = itemType && itemType.category_id 
                ? state.categories.find(c => c.id === itemType.category_id) 
                : null;
            const status = state.statuses.find(s => s.id === item.status_id);
            const location = state.locations.find(l => l.id === item.location_id);
            const crew = state.crews.find(c => c.id === item.assigned_crew_id);
            const area = item.area_id ? (state.areas || []).find(a => a.id === item.area_id) : null;
            
            // Check if a matching row already exists
            const existingRow = consolidatedRows.find(row => 
                row.location_id === item.location_id &&
                row.crew_id === item.assigned_crew_id &&
                row.area_id === item.area_id &&
                row.item_type_id === item.item_type_id &&
                row.status_id === item.status_id
            );
            
            if (existingRow) {
                // Aggregate quantity into existing row
                existingRow.quantity += (item.quantity || 0);
                existingRow.items.push(item);
            } else {
                // Create new consolidated row
                consolidatedRows.push({
                    location_id: item.location_id,
                    crew_id: item.assigned_crew_id,
                    area_id: item.area_id,
                    item_type_id: item.item_type_id,
                    status_id: item.status_id,
                    location,
                    crew,
                    area,
                    itemType,
                    category,
                    status,
                    quantity: item.quantity || 0,
                    items: [item] // Keep reference to original items
                });
            }
        });
        
        // Filter by visibility preferences
        const visibleRows = consolidatedRows.filter(row => {
            return row.status && isStatusVisible(row.status.name);
        });
        
        // Get status colors from localStorage
        const getStatusColors = (statusName) => {
            const defaultColors = {
                'Available': { background: '#75c283', text: '#000000' },
                'Issued': { background: '#4099dd', text: '#ffffff' },
                'Rejected': { background: '#ed4545', text: '#000000' }
            };
            const colors = JSON.parse(localStorage.getItem('statusColors') || '{}');
            return colors[statusName] || defaultColors[statusName] || { background: '#ffffff', text: '#000000' };
        };
        
        const content = div({}, [
            Components.pageHeader(
                'Manage Bulk Items', 
                'View and manage bulk inventory items',
                [
                    button('🔄 Refresh', {
                        className: 'btn btn-secondary',
                        onclick: () => loadInventory()
                    })
                ]
            ),
            
            // Search bar
            div({ style: { marginBottom: '1rem' } }, [
                Components.formField({
                    type: 'text',
                    id: 'manage-bulk-search',
                    name: 'manage_bulk_search',
                    label: 'Search Items',
                    placeholder: 'Search by location, crew, area, item, category...',
                    onkeyup: (e) => filterManageBulkTable(e.target.value)
                })
            ]),
            
            visibleRows.length > 0
                ? createElement('table', { 
                    id: 'manage-bulk-table',
                    className: 'inventory-table', 
                    style: { width: '100%' } 
                }, [
                    createElement('thead', {}, [
                        createElement('tr', {}, [
                            createElement('th', {}, ['Location']),
                            createElement('th', {}, ['Crew']),
                            createElement('th', {}, ['Area']),
                            createElement('th', {}, ['Item']),
                            createElement('th', {}, ['Category']),
                            createElement('th', {}, ['Quantity']),
                            createElement('th', {}, ['Status'])
                        ])
                    ]),
                    createElement('tbody', {}, 
                        visibleRows.map(row => {
                            const statusColors = getStatusColors(row.status ? row.status.name : 'Unknown');
                            
                            return createElement('tr', {
                                className: 'clickable-row',
                                style: {
                                    backgroundColor: statusColors.background,
                                    color: statusColors.text
                                },
                                onclick: () => {
                                    // If multiple items, show list; otherwise show single item
                                    if (row.items.length === 1) {
                                        showInventoryActionsModal(row.items[0]);
                                    } else {
                                        showConsolidatedItemsModal(row);
                                    }
                                }
                            }, [
                                createElement('td', {}, [row.location ? row.location.name : '-']),
                                createElement('td', {}, [row.crew ? row.crew.name : '-']),
                                createElement('td', {}, [row.area ? row.area.name : '-']),
                                createElement('td', {}, [row.itemType ? row.itemType.name : '-']),
                                createElement('td', {}, [row.category ? row.category.name : '-']),
                                createElement('td', {}, [String(row.quantity)]),
                                createElement('td', {}, [
                                    createElement('span', { className: 'status-badge' }, [row.status ? row.status.name : 'Unknown'])
                                ])
                            ]);
                        })
                    )
                ])
                : Components.emptyState('No bulk inventory items found', '📦')
        ]);
        
        return content;
    };
    
    // Filter manage bulk table
    function filterManageBulkTable(searchTerm) {
        const table = byId('manage-bulk-table');
        if (!table) return;
        
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        const term = searchTerm.toLowerCase().trim();
        
        rows.forEach(row => {
            if (!term) {
                row.style.display = '';
                return;
            }
            
            const cells = row.querySelectorAll('td');
            const text = Array.from(cells).map(cell => cell.textContent.toLowerCase()).join(' ');
            
            if (text.includes(term)) {
                row.style.display = '';
            } else {
                row.style.display = 'none';
            }
        });
    }
    
    // Manage serialized items view
    const receiveSerialized = () => {
        const state = Store.getState();
        
        // Get serialized item types (inventory_type_id === 1)
        let serializedItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 1);
        
        // Filter by selected market associations
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            serializedItemTypes = serializedItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        const serializedInventory = state.inventory.filter(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            return itemType && itemType.inventory_type_id === 1;
        });
        
        // Group inventory by category then by item type
        const hierarchicalInventory = {};
        serializedInventory.forEach(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            if (!itemType) return;
            
            const category = state.categories.find(c => c.id === itemType.category_id);
            const categoryName = category ? category.name : 'Uncategorized';
            
            if (!hierarchicalInventory[categoryName]) {
                hierarchicalInventory[categoryName] = {};
            }
            
            if (!hierarchicalInventory[categoryName][itemType.name]) {
                hierarchicalInventory[categoryName][itemType.name] = [];
            }
            
            hierarchicalInventory[categoryName][itemType.name].push(item);
        });
        
        // Build hierarchical display
        const buildHierarchy = () => {
            return buildHierarchyFromData(hierarchicalInventory, state);
        };
        
        const content = div({}, [
            Components.pageHeader('Manage Serialized Items', 'Receive, issue, and view serialized inventory'),
            
            div({ className: 'two-column-layout' }, [
                // Left section - 25% - Accordions
                div({ className: 'left-column' }, [
                    // Receive Accordion
                    div({ className: 'accordion-item', id: 'receive-accordion' }, [
                        div({ 
                            className: 'accordion-header',
                            onclick: (e) => {
                                const receiveContent = byId('receive-accordion-content');
                                const issueContent = byId('issue-accordion-content');
                                const isCurrentlyOpen = receiveContent.style.display === 'block';
                                
                                if (isCurrentlyOpen) {
                                    // Close and reset this accordion
                                    receiveContent.style.display = 'none';
                                    resetReceiveForm();
                                } else {
                                    // Close the other accordion and reset it
                                    issueContent.style.display = 'none';
                                    resetIssueForm();
                                    // Open this accordion
                                    receiveContent.style.display = 'block';
                                }
                            }
                        }, ['📥 Receive Serialized Items']),
                        div({ 
                            id: 'receive-accordion-content',
                            className: 'accordion-content'
                        }, [
                            // Item Type Selector
                            Components.formField({
                                type: 'select',
                                id: 'receive_item_type_id',
                                name: 'receive_item_type_id',
                                label: 'Item Type',
                                required: true,
                                options: [
                                    { value: '', text: 'Select Item Type' },
                                    ...serializedItemTypes.map(it => ({ value: it.id, text: it.name }))
                                ],
                                onchange: (e) => handleItemTypeChange(e.target.value)
                            }),
                            // Units per package note
                            div({ id: 'units-per-package-note', style: { display: 'none' } }),
                            // Batch Count
                            Components.formField({
                                type: 'number',
                                id: 'batch_count',
                                name: 'batch_count',
                                label: 'Batch Count',
                                placeholder: '0',
                                min: '0',
                                max: '999',
                                onblur: (e) => handleBatchCountChange(e.target.value),
                                onkeypress: (e) => {
                                    // Only allow digits 0-9
                                    if (!/[0-9]/.test(e.key)) {
                                        e.preventDefault();
                                    }
                                }
                            }),
                            // Batch Entry Table Container
                            div({ 
                                id: 'batch-entry-container',
                                className: 'batch-entry-container',
                                style: { display: 'none' }
                            }),
                            // Buttons
                            div({ style: { display: 'flex', gap: '0.5rem', marginTop: '1rem' } }, [
                                createElement('button', {
                                    className: 'btn btn-primary',
                                    style: { flex: '1' },
                                    id: 'receive-items-btn',
                                    onclick: () => processSerializedReceive()
                                }, ['Receive Items']),
                                createElement('button', {
                                    className: 'btn btn-secondary',
                                    style: { flex: '1' },
                                    onclick: () => {
                                        resetReceiveForm();
                                        Components.showToast('Form cleared', 'info');
                                    }
                                }, ['Clear'])
                            ])
                        ])
                    ]),
                    
                    // Issue Accordion
                    div({ className: 'accordion-item', id: 'issue-accordion' }, [
                        div({ 
                            className: 'accordion-header',
                            onclick: (e) => {
                                const receiveContent = byId('receive-accordion-content');
                                const issueContent = byId('issue-accordion-content');
                                const isCurrentlyOpen = issueContent.style.display === 'block';
                                
                                if (isCurrentlyOpen) {
                                    // Close and reset this accordion
                                    issueContent.style.display = 'none';
                                    resetIssueForm();
                                } else {
                                    // Close the other accordion and reset it
                                    receiveContent.style.display = 'none';
                                    resetReceiveForm();
                                    // Open this accordion
                                    issueContent.style.display = 'block';
                                }
                            }
                        }, ['📤 Issue Serialized Items']),
                        div({ 
                            id: 'issue-accordion-content',
                            className: 'accordion-content'
                        }, [
                            div({ id: 'issue-initial-state' }, [
                                createElement('button', {
                                    className: 'btn btn-primary full-width-button',
                                    onclick: () => startIssueProcess()
                                }, ['Begin Issue Process'])
                            ]),
                            div({ id: 'issue-selection-state', style: { display: 'none' } }, [
                                div({ style: { marginBottom: '1rem' } }, [
                                    createElement('p', { style: { color: '#3b82f6', fontWeight: '600', marginBottom: '0.5rem' } }, 
                                        ['Select items from the inventory list to issue']),
                                    createElement('button', {
                                        className: 'btn btn-secondary full-width-button',
                                        onclick: () => cancelIssueProcess()
                                    }, ['Cancel'])
                                ]),
                                div({ id: 'issue-crew-area-selectors', style: { marginTop: '1rem' } }),
                                div({ style: { marginTop: '1rem' } }, [
                                    createElement('h4', { style: { marginBottom: '0.5rem', fontSize: '0.9rem', fontWeight: '600' } }, 
                                        ['Selected Items:']),
                                    div({ id: 'selected-items-list', style: { 
                                        maxHeight: '200px', 
                                        overflowY: 'auto',
                                        border: '1px solid #e5e7eb',
                                        borderRadius: '0.25rem',
                                        padding: '0.5rem',
                                        backgroundColor: '#f9fafb',
                                        marginBottom: '1rem'
                                    } }, [
                                        createElement('p', { style: { color: '#6b7280', fontSize: '0.875rem', margin: 0 } }, 
                                            ['No items selected'])
                                    ])
                                ]),
                                createElement('button', {
                                    className: 'btn btn-success full-width-button',
                                    id: 'complete-issue-btn',
                                    disabled: true,
                                    onclick: () => completeIssueProcess()
                                }, ['Complete Issue Process'])
                            ])
                        ])
                    ])
                ]),
                
                // Right section - 75% - Serialized Inventory
                div({ className: 'right-column' }, [
                    createElement('h2', { className: 'section-header' }, ['Serialized Inventory']),
                    
                    // Search bar
                    div({ style: { marginBottom: '1rem' } }, [
                        Components.formField({
                            type: 'text',
                            id: 'manage-serialized-search',
                            name: 'manage_serialized_search',
                            label: 'Search Items',
                            placeholder: 'Search by item name, serial numbers, location, crew, area...',
                            onkeyup: (e) => filterSerializedHierarchy(e.target.value)
                        })
                    ]),
                    
                    div({ id: 'serialized-inventory-hierarchy' }, [
                        buildHierarchy()
                    ])
                ])
            ])
        ]);
        
        return content;
    };
    
    // Filter serialized inventory hierarchy
    function filterSerializedHierarchy(searchTerm) {
        const container = byId('serialized-inventory-hierarchy');
        if (!container) return;
        
        const term = searchTerm.toLowerCase().trim();
        const categoryGroups = container.querySelectorAll('.category-group');
        
        if (!term) {
            // Show all
            categoryGroups.forEach(catGroup => {
                catGroup.style.display = '';
                const itemTypeGroups = catGroup.querySelectorAll('.item-type-group');
                itemTypeGroups.forEach(itemGroup => {
                    itemGroup.style.display = '';
                    const rows = itemGroup.querySelectorAll('tbody tr');
                    rows.forEach(row => row.style.display = '');
                });
            });
            return;
        }
        
        // Filter
        categoryGroups.forEach(catGroup => {
            let categoryHasMatch = false;
            const categoryHeader = catGroup.querySelector('.category-header span');
            const categoryName = categoryHeader ? categoryHeader.textContent.toLowerCase() : '';
            
            const itemTypeGroups = catGroup.querySelectorAll('.item-type-group');
            itemTypeGroups.forEach(itemGroup => {
                let itemTypeHasMatch = false;
                const itemTypeHeader = itemGroup.querySelector('.item-type-header span');
                const itemTypeName = itemTypeHeader ? itemTypeHeader.textContent.toLowerCase() : '';
                
                // Check if item type name matches
                if (itemTypeName.includes(term) || categoryName.includes(term)) {
                    itemTypeHasMatch = true;
                    categoryHasMatch = true;
                    itemGroup.style.display = '';
                    // Show all rows in this item type
                    const rows = itemGroup.querySelectorAll('tbody tr');
                    rows.forEach(row => row.style.display = '');
                } else {
                    // Check individual rows
                    const rows = itemGroup.querySelectorAll('tbody tr');
                    let hasVisibleRows = false;
                    
                    rows.forEach(row => {
                        const cells = row.querySelectorAll('td');
                        const text = Array.from(cells).map(cell => cell.textContent.toLowerCase()).join(' ');
                        
                        if (text.includes(term)) {
                            row.style.display = '';
                            hasVisibleRows = true;
                            itemTypeHasMatch = true;
                            categoryHasMatch = true;
                        } else {
                            row.style.display = 'none';
                        }
                    });
                    
                    // Hide item type if no rows match
                    itemGroup.style.display = hasVisibleRows ? '' : 'none';
                }
            });
            
            // Hide category if no item types match
            catGroup.style.display = categoryHasMatch ? '' : 'none';
        });
    }
    
    // Receive bulk items view
    const receiveBulk = () => {
        const state = Store.getState();
        
        // Get bulk item types filtered by selected market
        // Filter item_types that are bulk (inventory_type_id === 2) and associated with the selected market
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // If a market is selected, filter by market associations
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        // Build initial table data
        const tableData = buildBulkTableData(bulkItemTypes, state);
        
        const content = div({}, [
            Components.pageHeader('Manage Bulk Items', 'Receive, issue, and view bulk inventory'),
            
            // Top section - Process buttons (horizontal)
            div({ style: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' } }, [
                // Begin Receive Process
                div({ 
                    id: 'bulk-receive-section',
                    className: 'bulk-process-section',
                    style: { 
                        flex: '1', 
                        padding: '1rem', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '0.375rem',
                        backgroundColor: '#f9fafb'
                    } 
                }, [
                    createElement('h3', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' } }, 
                        ['📥 Receive Process']),
                    createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, 
                        ['Add new bulk materials to inventory']),
                    
                    // Initial state - Begin button
                    div({ id: 'bulk-receive-initial', style: { display: 'block' } }, [
                        createElement('button', {
                            id: 'begin-bulk-receive-btn',
                            className: 'btn btn-primary',
                            style: { width: '100%' },
                            onclick: () => beginBulkReceiveProcess()
                        }, ['Begin Receive Process'])
                    ]),
                    
                    // Active state - Controls (will be populated dynamically)
                    div({ id: 'bulk-receive-active', style: { display: 'none' } })
                ]),
                
                // Begin Issue Process
                div({ 
                    id: 'bulk-issue-section',
                    className: 'bulk-process-section',
                    style: { 
                        flex: '1', 
                        padding: '1rem', 
                        border: '1px solid #e5e7eb', 
                        borderRadius: '0.375rem',
                        backgroundColor: '#f9fafb'
                    } 
                }, [
                    createElement('h3', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600' } }, 
                        ['📤 Issue Process']),
                    createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, 
                        ['Issue bulk materials to crews']),
                    
                    // Initial state - Begin button
                    div({ id: 'bulk-issue-initial', style: { display: 'block' } }, [
                        createElement('button', {
                            id: 'begin-bulk-issue-btn',
                            className: 'btn btn-primary',
                            style: { width: '100%' },
                            onclick: () => beginBulkIssueProcess()
                        }, ['Begin Issue Process'])
                    ]),
                    
                    // Active state - Controls (will be populated dynamically)
                    div({ id: 'bulk-issue-active', style: { display: 'none' } })
                ])
            ]),
            
            // Bottom section - Search and table
            div({ style: { marginTop: '1.5rem' } }, [
                // Search bar
                div({ style: { marginBottom: '1rem' } }, [
                    Components.formField({
                        type: 'text',
                        id: 'bulk-items-search',
                        name: 'bulk_items_search',
                        label: 'Search Items',
                        placeholder: 'Search by name, description, part number, category...',
                        onkeyup: (e) => filterBulkTable(e.target.value)
                    })
                ]),
                
                // Bulk items table
                div({ id: 'bulk-items-table-container' }, [
                    renderBulkItemsTable(tableData, false, false)
                ])
            ])
        ]);
        
        return content;
    };
    
    // Build bulk table data with aggregated quantities
    function buildBulkTableData(itemTypes, state) {
        const inventory = state.inventory || [];
        const sloc = state.selectedSloc;
        
        if (!sloc) {
            return itemTypes.map(itemType => ({
                ...itemType,
                availableQty: 0,
                issuedQty: 0,
                installedQty: 0,
                rejectedQty: 0
            }));
        }
        
        // Filter inventory to bulk items at selected SLOC
        const bulkInventory = inventory.filter(inv => {
            const invItemType = state.itemTypes.find(it => it.id === inv.item_type_id);
            return invItemType && invItemType.inventory_type_id === 2 && inv.sloc_id === sloc.id;
        });
        
        // Aggregate quantities by item_type and status
        return itemTypes.map(itemType => {
            const itemInventory = bulkInventory.filter(inv => inv.item_type_id === itemType.id);
            
            // Get status IDs
            const availableStatus = state.statuses?.find(s => s.name === 'Available');
            const issuedStatus = state.statuses?.find(s => s.name === 'Issued');
            const installedStatus = state.statuses?.find(s => s.name === 'Installed');
            const rejectedStatus = state.statuses?.find(s => s.name === 'Rejected');
            
            const availableQty = itemInventory
                .filter(inv => inv.status_id === availableStatus?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            const issuedQty = itemInventory
                .filter(inv => inv.status_id === issuedStatus?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            const installedQty = itemInventory
                .filter(inv => inv.status_id === installedStatus?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            const rejectedQty = itemInventory
                .filter(inv => inv.status_id === rejectedStatus?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            // Get related data for display
            const category = state.categories?.find(c => c.id === itemType.category_id);
            const uom = state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id);
            const provider = state.providers?.find(p => p.id === itemType.provider_id);
            
            return {
                ...itemType,
                availableQty,
                issuedQty,
                installedQty,
                rejectedQty,
                categoryName: category?.name || '-',
                uomName: uom?.name || '-',
                providerName: provider?.name || '-'
            };
        });
    }
    
    // Render bulk items table
    function renderBulkItemsTable(tableData, receiveMode = false, issueMode = false) {
        // Filter data based on mode
        let filteredData = tableData;
        if (issueMode) {
            // Only show items with available quantity > 0
            filteredData = tableData.filter(item => item.availableQty > 0);
        }
        
        return createElement('table', { className: 'inventory-table', style: { width: '100%' } }, [
            createElement('thead', {}, [
                createElement('tr', {}, [
                    createElement('th', { style: { textAlign: 'center' } }, ['Available']),
                    createElement('th', { style: { textAlign: 'center' } }, ['Issued']),
                    createElement('th', { style: { textAlign: 'center' } }, ['Installed']),
                    createElement('th', { style: { textAlign: 'center' } }, ['Rejected']),
                    createElement('th', { style: { textAlign: 'center' } }, ['Quantity']),
                    createElement('th', {}, ['Name']),
                    createElement('th', {}, ['Description']),
                    createElement('th', {}, ['Part Number']),
                    createElement('th', {}, ['Category']),
                    createElement('th', {}, ['Unit of Measure']),
                    createElement('th', {}, ['Provider'])
                ])
            ]),
            createElement('tbody', { id: 'bulk-items-tbody' }, 
                filteredData.map(item => {
                    const inputAttrs = {
                        type: 'text',
                        className: 'bulk-qty-input',
                        'data-item-type-id': item.id,
                        'data-available-qty': item.availableQty || 0,
                        onkeypress: (e) => {
                            // Only allow 0-9
                            if (!/[0-9]/.test(e.key)) {
                                e.preventDefault();
                            }
                        },
                        onpaste: (e) => {
                            // Handle paste - strip non-numeric characters
                            e.preventDefault();
                            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                            const numericOnly = pastedText.replace(/[^0-9]/g, '');
                            e.target.value = numericOnly;
                            
                            // Trigger validation
                            if (receiveMode) validateBulkReceiveForm();
                            if (issueMode) validateBulkIssueForm();
                        },
                        onkeyup: (e) => {
                            if (receiveMode) validateBulkReceiveForm();
                            if (issueMode) validateBulkIssueForm();
                        }
                    };
                    
                    // Only add disabled if in neither mode
                    if (!receiveMode && !issueMode) {
                        inputAttrs.disabled = true;
                    }
                    
                    return createElement('tr', { 
                        'data-item-id': item.id,
                        'data-name': item.name || '',
                        'data-description': item.description || '',
                        'data-part-number': item.part_number || '',
                        'data-category': item.categoryName || '',
                        'data-uom': item.uomName || '',
                        'data-provider': item.providerName || ''
                    }, [
                        createElement('td', { className: 'text-center' }, [String(item.availableQty || 0)]),
                        createElement('td', { className: 'text-center' }, [String(item.issuedQty || 0)]),
                        createElement('td', { className: 'text-center' }, [String(item.installedQty || 0)]),
                        createElement('td', { className: 'text-center' }, [String(item.rejectedQty || 0)]),
                        createElement('td', { className: 'bulk-qty-cell' }, [
                            createElement('input', inputAttrs)
                        ]),
                        createElement('td', {}, [item.name || '-']),
                        createElement('td', { className: 'bulk-description-cell' }, 
                            [item.description || '-']),
                        createElement('td', {}, [item.part_number || '-']),
                        createElement('td', {}, [item.categoryName]),
                        createElement('td', {}, [item.uomName]),
                        createElement('td', {}, [item.providerName])
                    ]);
                })
            )
        ]);
    }
    
    // Filter bulk table by search text
    function filterBulkTable(searchText) {
        const tbody = byId('bulk-items-tbody');
        if (!tbody) return;
        
        const rows = tbody.querySelectorAll('tr');
        const lowerSearch = searchText.toLowerCase();
        
        rows.forEach(row => {
            if (!searchText.trim()) {
                row.style.display = '';
                return;
            }
            
            const name = row.getAttribute('data-name') || '';
            const description = row.getAttribute('data-description') || '';
            const partNumber = row.getAttribute('data-part-number') || '';
            const category = row.getAttribute('data-category') || '';
            const uom = row.getAttribute('data-uom') || '';
            const provider = row.getAttribute('data-provider') || '';
            
            const searchableText = [name, description, partNumber, category, uom, provider]
                .join(' ')
                .toLowerCase();
            
            row.style.display = searchableText.includes(lowerSearch) ? '' : 'none';
        });
    }
    
    // Begin bulk receive process
    function beginBulkReceiveProcess() {
        console.log('Begin bulk receive process');
        Components.showToast('Receive mode activated. Enter quantities and submit.', 'info');
        // TODO: Enable quantity inputs, show submit/cancel buttons
    }
    
    // Begin bulk receive process
    function beginBulkReceiveProcess() {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('Please select a SLOC first', 'warning');
            return;
        }
        
        // Hide initial button
        const initialDiv = byId('bulk-receive-initial');
        if (initialDiv) initialDiv.style.display = 'none';
        
        // Disable issue section
        const issueSection = byId('bulk-issue-section');
        if (issueSection) {
            issueSection.style.opacity = '0.5';
            issueSection.style.pointerEvents = 'none';
        }
        
        // Build and populate active controls dynamically
        const activeDiv = byId('bulk-receive-active');
        if (activeDiv) {
            activeDiv.style.display = 'block';
            activeDiv.innerHTML = '';
            
            // Notes textarea
            activeDiv.appendChild(Components.formField({
                type: 'textarea',
                id: 'bulk-receive-notes',
                name: 'bulk_receive_notes',
                label: 'Receive Notes (optional)',
                placeholder: 'Add notes about this receipt...'
            }));
            
            // Buttons
            const buttonsDiv = div({ style: { display: 'flex', gap: '0.5rem', marginTop: '1rem' } }, [
                createElement('button', {
                    id: 'cancel-bulk-receive-btn',
                    className: 'btn btn-secondary',
                    style: { flex: '1' },
                    onclick: () => cancelBulkReceiveProcess()
                }, ['Cancel']),
                createElement('button', {
                    id: 'complete-bulk-receive-btn',
                    className: 'btn btn-primary',
                    style: { flex: '1' },
                    disabled: true,
                    onclick: () => completeBulkReceiveProcess()
                }, ['Complete Receive Process'])
            ]);
            activeDiv.appendChild(buttonsDiv);
        }
        
        // Rebuild table with receive mode enabled
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // Filter by market associations if market is selected
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        const tableData = buildBulkTableData(bulkItemTypes, state);
        const tableContainer = byId('bulk-items-table-container');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(renderBulkItemsTable(tableData, true, false));
        }
        
        Components.showToast('Receive mode activated. Enter quantities to receive.', 'info');
    }
    
    // Cancel bulk receive process
    function cancelBulkReceiveProcess(silent = false) {
        const state = Store.getState();
        
        // Show initial, hide active controls
        const initialDiv = byId('bulk-receive-initial');
        const activeDiv = byId('bulk-receive-active');
        
        if (initialDiv) initialDiv.style.display = 'block';
        if (activeDiv) activeDiv.style.display = 'none';
        
        // Re-enable issue section
        const issueSection = byId('bulk-issue-section');
        if (issueSection) {
            issueSection.style.opacity = '';
            issueSection.style.pointerEvents = '';
        }
        
        // Rebuild table with receive mode disabled
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // Filter by market associations if market is selected
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        const tableData = buildBulkTableData(bulkItemTypes, state);
        const tableContainer = byId('bulk-items-table-container');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(renderBulkItemsTable(tableData, false, false));
        }
        
        if (!silent) {
            Components.showToast('Receive process cancelled', 'info');
        }
    }
    
    // Validate bulk receive form
    function validateBulkReceiveForm() {
        const completeBtn = byId('complete-bulk-receive-btn');
        if (!completeBtn) return;
        
        // Check if any valid quantities entered
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        let hasValidQuantity = false;
        
        qtyInputs.forEach(input => {
            const value = parseInt(input.value);
            if (value && value > 0) {
                hasValidQuantity = true;
            }
        });
        
        // Enable complete button only if at least one quantity
        completeBtn.disabled = !hasValidQuantity;
        
        if (hasValidQuantity) {
            completeBtn.classList.remove('btn-disabled');
        } else {
            completeBtn.classList.add('btn-disabled');
        }
    }
    
    // Complete bulk receive process
    async function completeBulkReceiveProcess() {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('No SLOC selected', 'error');
            return;
        }
        
        // Collect quantities from inputs
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        const itemsToReceive = [];
        
        qtyInputs.forEach(input => {
            const quantity = parseInt(input.value);
            if (quantity && quantity > 0) {
                const itemTypeId = parseInt(input.getAttribute('data-item-type-id'));
                const itemType = state.itemTypes.find(it => it.id === itemTypeId);
                if (itemType) {
                    itemsToReceive.push({ 
                        item_type_id: itemTypeId, 
                        item_type_name: itemType.name,
                        quantity 
                    });
                }
            }
        });
        
        if (itemsToReceive.length === 0) {
            Components.showToast('No items to receive', 'warning');
            return;
        }
        
        // Use unified receive modal
        showReceiveActionModal(itemsToReceive, { sourceView: 'receive-bulk' });
    }
    
    // Execute bulk receive operation
    async function executeBulkReceive(itemsToReceive) {
        const state = Store.getState();
        
        // Get receiving status from preferences
        const receivingStatusName = (state.config || []).find(c => c.key === 'receivingStatus')?.value || 'Available';
        const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
        
        if (!receivingStatus) {
            Components.showToast('Receiving status not found', 'error');
            return;
        }
        
        // Get receiving location - look for 'Warehouse' location
        const warehouseLocation = state.locations.find(l => l.name === 'Warehouse');
        
        if (!warehouseLocation) {
            Components.showToast('Warehouse location not found', 'error');
            console.error('Available locations:', state.locations);
            return;
        }
        
        try {
            console.log('📦 [executeBulkReceive] Starting bulk receive for', itemsToReceive.length, 'items');
            Components.showToast(`Receiving ${itemsToReceive.length} item(s)...`, 'info');
            
            // Process each item with upsert
            const results = [];
            for (const item of itemsToReceive) {
                console.log('📦 [executeBulkReceive] Receiving item:', item.item_type_name, 'qty:', item.quantity);
                
                const inventoryData = {
                    location_id: warehouseLocation.id,
                    assigned_crew_id: null,
                    area_id: null,
                    item_type_id: item.item_type_id,
                    quantity: item.quantity,
                    status_id: receivingStatus.id,
                    sloc_id: state.selectedSloc.id
                };
                
                const result = await Queries.upsertBulkInventory(inventoryData, 'add');
                console.log('📦 [executeBulkReceive] Upsert result:', result);
                
                if (result.isOk) {
                    // Create transaction record
                    await Queries.createTransaction({
                        inventory_id: result.value.inventory_id,
                        transaction_type: 'Receive',
                        action: 'Receive from Vendor',
                        item_type_name: item.item_type_name,
                        quantity: item.quantity,
                        to_location_name: 'Warehouse',
                        status_name: receivingStatus.name,
                        notes: `Bulk receive: ${result.value.operation === 'created' ? 'New record' : 'Updated existing'}`
                    });
                    
                    results.push({ success: true, ...result.value });
                } else {
                    console.error('📦 [executeBulkReceive] Failed to receive item:', result.error);
                    results.push({ success: false, error: result.error });
                }
            }
            
            // Refresh inventory data filtered by SLOC
            console.log('🔄 [executeBulkReceive] About to refresh inventory for SLOC:', state.selectedSloc.id);
            
            // First, consolidate any duplicate records
            console.log('🔀 [executeBulkReceive] Running auto-consolidation...');
            const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
            if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                console.log(`✅ [executeBulkReceive] Consolidated ${consolidationResult.value.consolidated} groups, deleted ${consolidationResult.value.deleted} duplicate records`);
            }
            
            // Then re-query inventory
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            console.log('🔄 [executeBulkReceive] Inventory query result:', inventoryResult.isOk ? `Success (${inventoryResult.value.length} items)` : `Failed: ${inventoryResult.error}`);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
                console.log('✅ [executeBulkReceive] State updated with', inventoryResult.value.length, 'inventory items');
            }
            
            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;
            
            if (failCount === 0) {
                Components.showToast(`Successfully received ${successCount} item type(s)`, 'success');
            } else {
                Components.showToast(`Received ${successCount} item(s), ${failCount} failed`, 'warning');
            }
            
            // Reset the view (silently - don't show cancellation message)
            cancelBulkReceiveProcess(true);
            
        } catch (error) {
            console.error('Error completing bulk receive:', error);
            Components.showToast('Error completing receive process', 'error');
        }
    }
    
    // Show bulk action modal (standard modal for receive/issue operations)
    function showBulkActionModal({ action, title, items, sloc, crew = null, area = null, onConfirm }) {
        const state = Store.getState();
        
        // Build items list for display
        const itemsList = div({ style: { marginBottom: '1rem' } }, [
            createElement('table', { 
                className: 'inventory-table',
                style: { width: '100%', marginTop: '1rem' }
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Item Type']),
                        createElement('th', { style: { textAlign: 'center', width: '100px' } }, ['Quantity'])
                    ])
                ]),
                createElement('tbody', {},
                    items.map(item =>
                        createElement('tr', {}, [
                            createElement('td', {}, [item.item_type_name]),
                            createElement('td', { style: { textAlign: 'center', fontWeight: 'bold' } }, [String(item.quantity)])
                        ])
                    )
                )
            ])
        ]);
        
        // Build summary section
        const summaryItems = [
            { label: 'SLOC', value: sloc.name },
            { label: 'Total Item Types', value: items.length },
            { label: 'Total Units', value: items.reduce((sum, item) => sum + item.quantity, 0) }
        ];
        
        if (crew) summaryItems.push({ label: 'Crew', value: crew.name });
        if (area) summaryItems.push({ label: 'Area', value: area.name });
        
        const summary = div({ 
            style: { 
                backgroundColor: '#f9fafb',
                padding: '1rem',
                borderRadius: '0.5rem',
                marginBottom: '1rem'
            }
        }, [
            createElement('h3', { 
                style: { 
                    margin: '0 0 0.75rem 0',
                    fontSize: '1rem',
                    fontWeight: '600'
                }
            }, ['Summary']),
            ...summaryItems.map(({ label, value }) =>
                div({ 
                    style: { 
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0'
                    }
                }, [
                    createElement('span', { style: { fontWeight: '500' } }, [label + ':']),
                    createElement('span', {}, [String(value)])
                ])
            )
        ]);
        
        const content = div({}, [
            summary,
            itemsList
        ]);
        
        const modal = Modals.create({
            title,
            content,
            size: 'large',
            actions: [
                {
                    label: 'Cancel',
                    type: 'secondary',
                    handler: () => Modals.close()
                },
                {
                    label: action === 'receive' ? 'Receive Items' : 'Issue Items',
                    type: 'primary',
                    handler: async () => {
                        Modals.close();
                        await onConfirm();
                    }
                }
            ]
        });
        
        Modals.show(modal);
    }
    
    // Begin bulk issue process
    function beginBulkIssueProcess() {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('Please select a SLOC first', 'warning');
            return;
        }
        
        // Hide initial button
        const initialDiv = byId('bulk-issue-initial');
        if (initialDiv) initialDiv.style.display = 'none';
        
        // Disable receive section
        const receiveSection = byId('bulk-receive-section');
        if (receiveSection) {
            receiveSection.style.opacity = '0.5';
            receiveSection.style.pointerEvents = 'none';
        }
        
        // Build and populate active controls dynamically with current state
        const activeDiv = byId('bulk-issue-active');
        if (activeDiv) {
            activeDiv.style.display = 'block';
            activeDiv.innerHTML = '';
            
            // Get crews for selected market and areas for selected SLOC
            const marketCrews = state.selectedMarket 
                ? (state.crews || []).filter(c => c.market_id === state.selectedMarket.id)
                : [];
            const slocAreas = (state.areas || []).filter(a => a.sloc_id === state.selectedSloc.id);
            
            // Crew dropdown (filtered by market)
            activeDiv.appendChild(Components.formField({
                type: 'select',
                id: 'bulk-issue-crew',
                name: 'bulk_issue_crew',
                label: 'Crew',
                required: true,
                options: [
                    { value: '', text: '-- Select Crew --' },
                    ...marketCrews.map(c => ({ value: c.id, text: c.name }))
                ],
                onchange: () => validateBulkIssueForm()
            }));
            
            // Area dropdown
            activeDiv.appendChild(Components.formField({
                type: 'select',
                id: 'bulk-issue-area',
                name: 'bulk_issue_area',
                label: 'Area',
                required: true,
                options: [
                    { value: '', text: '-- Select Area --' },
                    ...slocAreas.map(a => ({ value: a.id, text: a.name }))
                ],
                onchange: () => validateBulkIssueForm()
            }));
            
            // Buttons
            const buttonsDiv = div({ style: { display: 'flex', gap: '0.5rem', marginTop: '1rem' } }, [
                createElement('button', {
                    id: 'cancel-bulk-issue-btn',
                    className: 'btn btn-secondary',
                    style: { flex: '1' },
                    onclick: () => cancelBulkIssueProcess()
                }, ['Cancel']),
                createElement('button', {
                    id: 'complete-bulk-issue-btn',
                    className: 'btn btn-primary',
                    style: { flex: '1' },
                    disabled: true,
                    onclick: () => completeBulkIssueProcess()
                }, ['Complete Process'])
            ]);
            activeDiv.appendChild(buttonsDiv);
        }
        
        // Rebuild table with issue mode enabled and filtered to available items
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // Filter by market associations if market is selected
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        const tableData = buildBulkTableData(bulkItemTypes, state);
        const tableContainer = byId('bulk-items-table-container');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(renderBulkItemsTable(tableData, false, true));
        }
        
        Components.showToast('Issue mode activated. Select crew, area, and enter quantities.', 'info');
    }
    
    // Cancel bulk issue process
    function cancelBulkIssueProcess() {
        // Show initial, hide active controls
        const initialDiv = byId('bulk-issue-initial');
        const activeDiv = byId('bulk-issue-active');
        
        if (initialDiv) initialDiv.style.display = 'block';
        if (activeDiv) activeDiv.style.display = 'none';
        
        // Re-enable receive section
        const receiveSection = byId('bulk-receive-section');
        if (receiveSection) {
            receiveSection.style.opacity = '';
            receiveSection.style.pointerEvents = '';
        }
        
        // Reset form
        const crewSelect = byId('bulk-issue-crew');
        const areaSelect = byId('bulk-issue-area');
        if (crewSelect) crewSelect.value = '';
        if (areaSelect) areaSelect.value = '';
        
        // Get FRESH state for rebuilding table
        const state = Store.getState();
        
        // Rebuild table with issue mode disabled and show all items
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // Filter by market associations if market is selected
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        const tableData = buildBulkTableData(bulkItemTypes, state);
        const tableContainer = byId('bulk-items-table-container');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(renderBulkItemsTable(tableData, false, false));
        }
    }
    
    // Validate bulk issue form
    function validateBulkIssueForm() {
        const crewSelect = byId('bulk-issue-crew');
        const areaSelect = byId('bulk-issue-area');
        const completeBtn = byId('complete-bulk-issue-btn');
        
        if (!completeBtn) return;
        
        // Check crew selected
        const crewSelected = crewSelect && crewSelect.value;
        
        // Check area selected
        const areaSelected = areaSelect && areaSelect.value;
        
        // Check if any valid quantities entered and validate against available
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        let hasValidQuantity = false;
        let hasExceededQuantity = false;
        
        qtyInputs.forEach(input => {
            const value = parseInt(input.value);
            const availableQty = parseInt(input.getAttribute('data-available-qty')) || 0;
            
            // Reset styling
            input.style.color = '';
            
            if (value && value > 0) {
                hasValidQuantity = true;
                
                // Check if quantity exceeds available
                if (value > availableQty) {
                    hasExceededQuantity = true;
                    input.style.color = 'red';
                }
            }
        });
        
        // Enable complete button only if all conditions met
        const isValid = crewSelected && areaSelected && hasValidQuantity && !hasExceededQuantity;
        completeBtn.disabled = !isValid;
        
        if (isValid) {
            completeBtn.classList.remove('btn-disabled');
        } else {
            completeBtn.classList.add('btn-disabled');
        }
    }
    
    // Complete bulk issue process
    async function completeBulkIssueProcess() {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('No SLOC selected', 'error');
            return;
        }
        
        // Get crew and area selections
        const crewSelect = byId('bulk-issue-crew');
        const areaSelect = byId('bulk-issue-area');
        
        if (!crewSelect || !areaSelect) {
            Components.showToast('Form elements not found', 'error');
            return;
        }
        
        const crewId = parseInt(crewSelect.value);
        const areaId = parseInt(areaSelect.value);
        
        if (!crewId || !areaId) {
            Components.showToast('Please select crew and area', 'warning');
            return;
        }
        
        const crew = state.crews.find(c => c.id === crewId);
        const area = (state.areas || []).find(a => a.id === areaId);
        
        // Collect quantities from inputs
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        const itemsToIssue = [];
        
        qtyInputs.forEach(input => {
            const quantity = parseInt(input.value);
            const availableQty = parseInt(input.getAttribute('data-available-qty')) || 0;
            
            if (quantity && quantity > 0 && quantity <= availableQty) {
                const itemTypeId = parseInt(input.getAttribute('data-item-type-id'));
                const itemType = state.itemTypes.find(it => it.id === itemTypeId);
                const status = state.statuses.find(s => s.name === 'Available');
                
                // Create a pseudo-item for the modal
                itemsToIssue.push({
                    item_type_id: itemTypeId,
                    quantity: quantity,
                    status_id: status?.id,
                    mfgrsn: null,
                    tilsonsn: `BULK-${itemType?.name || 'Item'}`
                });
            }
        });
        
        if (itemsToIssue.length === 0) {
            Components.showToast('No valid items to issue', 'warning');
            return;
        }
        
        // Get Issue action definition
        const issueAction = state.actionTypes.find(a => a.name === 'Issue') || { name: 'Issue', allow_pdf: true };
        
        // Show the Issue modal with preselected crew and area
        showBulkIssueModal(itemsToIssue, issueAction, { crew, area });
    }
    
    // Show Bulk Issue Modal
    function showBulkIssueModal(items, action, assignments) {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        // Calculate total quantity
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        let signaturePad = null;
        let signatureCanvas = null;
        
        // Build items table
        const itemsTableHtml = createElement('table', { className: 'inventory-table', style: { marginBottom: '1rem' } }, [
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
        
        // Build signature section if action allows PDF
        let signatureSection = null;
        if (action.allow_pdf) {
            signatureSection = div({ style: { marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
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
                        onclick: () => { if (signaturePad) signaturePad.clear(); }
                    })
                ])
            ]);
        }
        
        // Summary section
        const summarySection = div({ style: { marginTop: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Issue Summary:']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                div({}, [createElement('strong', {}, ['Total Items:']), ` ${items.length}`]),
                div({}, [createElement('strong', {}, ['Total Quantity:']), ` ${totalQuantity}`]),
                div({}, [createElement('strong', {}, ['Crew:']), ` ${crew.name}`]),
                div({}, [createElement('strong', {}, ['Area:']), ` ${area.name}`])
            ])
        ]);
        
        // Build modal content
        const modalContent = [
            itemsTableHtml,
            summarySection,
            signatureSection
        ].filter(Boolean);
        
        // Modal actions
        const actions = [
            {
                label: 'Complete Issue',
                type: 'primary',
                handler: async () => {
                    await executeBulkIssueAction(items, { crew, area });
                    
                    // Auto-generate PDF if signature is present
                    if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                        await generateBulkIssuePDF(items, { crew, area }, signaturePad);
                    }
                    
                    // Refresh transactions list
                    await refreshTransactionsList();
                    
                    Modals.close();
                    cancelBulkIssueProcess();
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => {
                    Modals.close();
                    cancelBulkIssueProcess();
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
        
        // Initialize signature pad if present
        if (signatureCanvas && action.allow_pdf) {
            setTimeout(() => {
                // Function to properly resize canvas
                function resizeCanvas() {
                    const ratio = Math.max(window.devicePixelRatio || 1, 1);
                    const rect = signatureCanvas.getBoundingClientRect();
                    
                    signatureCanvas.width = rect.width * ratio;
                    signatureCanvas.height = rect.height * ratio;
                    signatureCanvas.getContext('2d').scale(ratio, ratio);
                }
                
                resizeCanvas();
                
                signaturePad = new SignaturePad(signatureCanvas, {
                    backgroundColor: 'rgb(255, 255, 255)',
                    penColor: 'rgb(0, 0, 0)'
                });
            }, 200);
        }
    }
    
    // Execute Bulk Issue Action
    async function executeBulkIssueAction(items, assignments) {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        // Get statuses
        const availableStatus = state.statuses.find(s => s.name === 'Available');
        const issuedStatus = state.statuses.find(s => s.name === 'Issued');
        
        if (!availableStatus || !issuedStatus) {
            Components.showToast('Required statuses not found', 'error');
            return;
        }
        
        // Get 'With Crew' location
        const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
        
        if (!withCrewLocation) {
            Components.showToast('With Crew location not found', 'error');
            return;
        }
        
        // Get receiving location from preferences (this is where available inventory is stored)
        const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
        const sourceLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
        
        if (!sourceLocation) {
            Components.showToast('Receiving location not set in preferences', 'error');
            return;
        }
        
        try {
            Components.showToast(`Issuing ${items.length} item(s)...`, 'info');
            
            // Process each item: subtract from source and add to 'With Crew' location
            const results = [];
            for (const item of items) {
                // Step 1: Subtract from available inventory at source location
                const sourceData = {
                    location_id: sourceLocation.id,
                    assigned_crew_id: null,
                    area_id: null,
                    item_type_id: item.item_type_id,
                    quantity: item.quantity,
                    status_id: availableStatus.id,
                    sloc_id: state.selectedSloc.id
                };
                
                const subtractResult = await Queries.upsertBulkInventory(sourceData, 'subtract');
                
                if (!subtractResult.isOk) {
                    console.error('Failed to subtract from source:', subtractResult.error);
                    results.push({ success: false, error: subtractResult.error, item_type_id: item.item_type_id });
                    continue;
                }
                
                // Step 2: Add to 'With Crew' location with crew/area assignment
                const issuedData = {
                    location_id: withCrewLocation.id,
                    assigned_crew_id: crew.id,
                    area_id: area.id,
                    item_type_id: item.item_type_id,
                    quantity: item.quantity,
                    status_id: issuedStatus.id,
                    sloc_id: state.selectedSloc.id
                };
                
                const issueResult = await Queries.upsertBulkInventory(issuedData, 'add');
                
                if (issueResult.isOk) {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    // Create transaction record
                    await Queries.createTransaction({
                        transaction_type: 'Issue',
                        action: 'Issue to Crew',
                        item_type_name: itemType?.name || 'Unknown',
                        quantity: item.quantity,
                        to_location_name: 'With Crew',
                        assigned_crew_name: crew.name,
                        area_name: area.name,
                        status_name: 'Issued',
                        notes: `Bulk issue to ${crew.name} - ${area.name}`
                    });
                    
                    results.push({ success: true, ...issueResult.value });
                } else {
                    console.error('Failed to add to With Crew:', issueResult.error);
                    results.push({ success: false, error: issueResult.error, item_type_id: item.item_type_id });
                }
            }
            
            // Refresh inventory from database (inventory is not cached, must be re-queried)
            console.log('🔄 [executeBulkIssueAction] About to refresh inventory for SLOC:', state.selectedSloc?.id);
            if (state.selectedSloc) {
                // First, consolidate any duplicate records
                console.log('🔀 [executeBulkIssueAction] Running auto-consolidation...');
                const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
                if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                    console.log(`✅ [executeBulkIssueAction] Consolidated ${consolidationResult.value.consolidated} groups, deleted ${consolidationResult.value.deleted} duplicate records`);
                }
                
                // Then re-query inventory
                const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
                console.log('🔄 [executeBulkIssueAction] Inventory query result:', inventoryResult.isOk ? `Success (${inventoryResult.value.length} items)` : `Failed: ${inventoryResult.error}`);
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                    console.log('✅ [executeBulkIssueAction] State updated with', inventoryResult.value.length, 'inventory items');
                }
            }
            
            const successCount = results.filter(r => r.success).length;
            const failCount = results.length - successCount;
            
            if (failCount === 0) {
                Components.showToast(`Successfully issued ${successCount} item type(s)`, 'success');
            } else {
                Components.showToast(`Issued ${successCount} item(s), ${failCount} failed`, 'warning');
            }
            
            // NOTE: Do NOT call cancelBulkIssueProcess() here
            // It will be called by the modal handler after this function completes
            // and it will refresh the display with the updated state
            
        } catch (error) {
            console.error('Error executing bulk issue:', error);
            Components.showToast('Error completing issue process', 'error');
        }
    }
    
    // Generate Bulk Issue PDF
    async function generateBulkIssuePDF(items, assignments, signaturePad) {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        try {
            // Get and increment receipt number
            const configResult = await Queries.getConfig('lastReceiptNumber');
            let receiptNumber = 1;
            if (configResult.isOk) {
                receiptNumber = parseInt(configResult.value) + 1;
            }
            await Queries.setConfig('lastReceiptNumber', receiptNumber);
            
            const { PDFDocument, rgb, StandardFonts } = PDFLib;
            
            // Create PDF
            const pdfDoc = await PDFDocument.create();
            const page = pdfDoc.addPage([612, 792]); // Letter size
            const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
            const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
            
            let yPosition = 750;
            
            // Header
            page.drawText('BULK INVENTORY ISSUE RECEIPT', {
                x: 50,
                y: yPosition,
                size: 18,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            
            // Receipt Number
            yPosition -= 25;
            page.drawText(`Receipt #: ${String(receiptNumber).padStart(6, '0')}`, {
                x: 50,
                y: yPosition,
                size: 12,
                font: boldFont,
                color: rgb(0, 0, 0)
            });
            
            yPosition -= 30;
            page.drawText(`Date: ${new Date().toLocaleString()}`, {
                x: 50,
                y: yPosition,
                size: 10,
                font: font
            });
            
            yPosition -= 20;
            page.drawText(`Crew: ${crew?.name || 'N/A'}`, {
                x: 50,
                y: yPosition,
                size: 10,
                font: font
            });
            
            yPosition -= 20;
            page.drawText(`Area: ${area?.name || 'N/A'}`, {
                x: 50,
                y: yPosition,
                size: 10,
                font: font
            });
            
            yPosition -= 40;
            
            // Items header
            page.drawText('Items Issued:', {
                x: 50,
                y: yPosition,
                size: 12,
                font: boldFont
            });
            
            yPosition -= 25;
            
            // Table headers - removed Status column
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
            const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
            
            // Helper function to wrap text
            const wrapText = (text, maxWidth) => {
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
            
            for (const item of items) {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                const itemTypeName = itemType?.name || 'Unknown';
                
                // Wrap item type name if needed (max width ~380px for 400px column)
                const wrappedLines = wrapText(itemTypeName, 380);
                const startY = yPosition;
                
                // Draw wrapped item type lines
                for (let i = 0; i < wrappedLines.length; i++) {
                    page.drawText(wrappedLines[i], { x: 50, y: yPosition - (i * 12), size: 9, font: font });
                }
                
                // Draw quantity aligned with first line
                page.drawText(String(item.quantity || 1), { x: 450, y: startY, size: 9, font: font });
                
                // Advance position based on number of wrapped lines
                yPosition -= Math.max(15, wrappedLines.length * 12 + 3);
                
                if (yPosition < 150) break; // Leave space for signature
            }
            
            // Total
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
            
            // Signature
            if (signaturePad && !signaturePad.isEmpty()) {
                yPosition -= 60;
                page.drawText('Received By:', { x: 50, y: yPosition + 50, size: 10, font: boldFont });
                
                const signatureDataUrl = signaturePad.toDataURL();
                const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
                const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
                
                page.drawImage(signatureImage, {
                    x: 50,
                    y: yPosition - 30,
                    width: 200,
                    height: 60
                });
            }
            
            // Save PDF
            const pdfBytes = await pdfDoc.save();
            const blob = new Blob([pdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            
            // Download
            const a = document.createElement('a');
            a.href = url;
            a.download = `Bulk_Issue_Receipt_${getLocalTimestamp().split('T')[0]}.pdf`;
            a.click();
            
            Components.showToast('PDF generated successfully', 'success');
            
        } catch (error) {
            console.error('Error generating PDF:', error);
            Components.showToast('Error generating PDF', 'error');
        }
    }
    
    // Export Data view
    const exportData = () => {
        const state = Store.getState();
        
        // Helper to populate dropdown options directly
        const populateExportDropdown = (selectId, items, defaultText, selectedValue = '') => {
            const select = byId(selectId);
            if (!select) return;
            
            // Store current value if provided
            const valueToSet = selectedValue || select.value || '';
            
            // Clear and rebuild options
            select.innerHTML = '';
            
            // Add default option
            const defaultOption = createElement('option', { value: '' }, [defaultText]);
            select.appendChild(defaultOption);
            
            // Add items
            items.forEach(item => {
                const option = createElement('option', { value: item.id }, [item.name]);
                select.appendChild(option);
            });
            
            // Restore value if it exists in the new options
            if (valueToSet) {
                select.value = valueToSet;
            }
        };
        
        // Build cascading dropdowns (initial setup only)
        const buildExportForm = () => {
            const formContainer = byId('export-filter-form');
            if (!formContainer) return;
            
            formContainer.innerHTML = '';
            
            // Client dropdown
            const clientOptions = [{ value: '', text: 'All Clients' }];
            state.clients.forEach(c => {
                clientOptions.push({ value: c.id, text: c.name });
            });
            
            // Initial empty dropdowns for cascading filters
            const marketOptions = [{ value: '', text: 'All Markets' }];
            const slocOptions = [{ value: '', text: 'All SLOCs' }];
            const areaOptions = [{ value: '', text: 'All Areas' }];
            
            // Crew dropdown
            const crewOptions = [{ value: '', text: 'All Crews' }];
            state.crews.forEach(c => {
                crewOptions.push({ value: c.id, text: c.name });
            });
            
            formContainer.appendChild(
                div({ className: 'row' }, [
                    div({ className: 'col-md-4' }, [
                        Components.formField({
                            type: 'select',
                            id: 'export-client-filter',
                            name: 'client',
                            label: 'Client',
                            options: clientOptions,
                            onchange: (e) => {
                                const clientId = e.target.value;
                                
                                // Filter and update markets dropdown
                                let filteredMarkets = clientId 
                                    ? state.markets.filter(m => m.client_id === parseInt(clientId))
                                    : state.markets;
                                populateExportDropdown('export-market-filter', filteredMarkets, 'All Markets');
                                
                                // Clear dependent dropdowns
                                populateExportDropdown('export-sloc-filter', [], 'All SLOCs');
                                populateExportDropdown('export-area-filter', [], 'All Areas');
                            }
                        })
                    ]),
                    div({ className: 'col-md-4' }, [
                        Components.formField({
                            type: 'select',
                            id: 'export-market-filter',
                            name: 'market',
                            label: 'Market',
                            options: marketOptions,
                            onchange: (e) => {
                                const marketId = e.target.value;
                                
                                // Filter and update SLOCs dropdown
                                let filteredSlocs = marketId
                                    ? state.slocs.filter(s => s.market_id === parseInt(marketId))
                                    : state.slocs;
                                populateExportDropdown('export-sloc-filter', filteredSlocs, 'All SLOCs');
                                
                                // Clear dependent dropdown
                                populateExportDropdown('export-area-filter', [], 'All Areas');
                            }
                        })
                    ]),
                    div({ className: 'col-md-4' }, [
                        Components.formField({
                            type: 'select',
                            id: 'export-sloc-filter',
                            name: 'sloc',
                            label: 'SLOC',
                            options: slocOptions,
                            onchange: (e) => {
                                const slocId = e.target.value;
                                
                                // Filter and update areas dropdown
                                let filteredAreas = slocId
                                    ? state.areas.filter(a => a.sloc_id === parseInt(slocId))
                                    : state.areas;
                                populateExportDropdown('export-area-filter', filteredAreas, 'All Areas');
                            }
                        })
                    ])
                ])
            );
            
            formContainer.appendChild(
                div({ className: 'row mt-3' }, [
                    div({ className: 'col-md-4' }, [
                        Components.formField({
                            type: 'select',
                            id: 'export-area-filter',
                            name: 'area',
                            label: 'Area',
                            options: areaOptions,
                            onchange: (e) => {
                                // No cascading needed for area
                            }
                        })
                    ]),
                    div({ className: 'col-md-4' }, [
                        Components.formField({
                            type: 'select',
                            id: 'export-crew-filter',
                            name: 'crew',
                            label: 'Crew',
                            options: crewOptions,
                            onchange: (e) => {
                                // No cascading needed for crew
                            }
                        })
                    ])
                ])
            );
        };
        
        const handleReset = () => {
            // Clear all form fields by directly setting values
            const clientField = byId('export-client-filter');
            const marketField = byId('export-market-filter');
            const slocField = byId('export-sloc-filter');
            const areaField = byId('export-area-filter');
            const crewField = byId('export-crew-filter');
            
            if (clientField) clientField.value = '';
            if (marketField) marketField.value = '';
            if (slocField) slocField.value = '';
            if (areaField) areaField.value = '';
            if (crewField) crewField.value = '';
            
            // Reset cascading dropdowns to show all options
            populateExportDropdown('export-market-filter', state.markets, 'All Markets');
            populateExportDropdown('export-sloc-filter', state.slocs, 'All SLOCs');
            populateExportDropdown('export-area-filter', state.areas, 'All Areas');
            
            Components.showToast('Filters reset', 'info');
        };
        
        const handleExport = async () => {
            try {
                // Get filter values from DOM
                const selectedClient = byId('export-client-filter')?.value || '';
                const selectedMarket = byId('export-market-filter')?.value || '';
                const selectedSloc = byId('export-sloc-filter')?.value || '';
                const selectedArea = byId('export-area-filter')?.value || '';
                const selectedCrew = byId('export-crew-filter')?.value || '';
                
                // Get filter values
                const filters = {
                    clientId: selectedClient ? parseInt(selectedClient) : null,
                    marketId: selectedMarket ? parseInt(selectedMarket) : null,
                    slocId: selectedSloc ? parseInt(selectedSloc) : null,
                    areaId: selectedArea ? parseInt(selectedArea) : null,
                    crewId: selectedCrew ? parseInt(selectedCrew) : null
                };
                
                // Get filter names for display
                const filterNames = {
                    client: selectedClient ? state.clients.find(c => c.id === parseInt(selectedClient))?.name : 'All',
                    market: selectedMarket ? state.markets.find(m => m.id === parseInt(selectedMarket))?.name : 'All',
                    sloc: selectedSloc ? state.slocs.find(s => s.id === parseInt(selectedSloc))?.name : 'All',
                    area: selectedArea ? state.areas.find(a => a.id === parseInt(selectedArea))?.name : 'All',
                    crew: selectedCrew ? state.crews.find(c => c.id === parseInt(selectedCrew))?.name : 'All'
                };
                
                await ImportExportService.exportFilteredDataToExcel(filters, filterNames);
            } catch (error) {
                console.error('Export error:', error);
                Components.showToast('Export failed', 'error');
            }
        };
        
        const content = div({}, [
            Components.pageHeader('Export Data', 'Filter and export inventory, transactions, and reference data'),
            
            div({ className: 'card mb-3' }, [
                div({ className: 'card-body' }, [
                    h3('Filter Options', { className: 'mb-3' }),
                    p('Select filters to narrow down the data to export. Filters cascade - selecting a Client will limit Markets to those under that Client, and so on.', { className: 'text-muted mb-3' }),
                    
                    div({ id: 'export-filter-form' }),
                    
                    div({ className: 'd-flex gap-2 mt-4' }, [
                        button('Reset Filters', {
                            className: 'btn btn-secondary',
                            onclick: handleReset
                        }),
                        button('Export to Excel', {
                            className: 'btn btn-primary',
                            onclick: handleExport
                        })
                    ])
                ])
            ]),
            
            div({ className: 'card' }, [
                div({ className: 'card-body' }, [
                    h3('Export Contents', { className: 'mb-3' }),
                    p('The exported Excel file will contain the following sheets:', { className: 'mb-2' }),
                    div({ className: 'export-contents-list' }, [
                        div({ className: 'export-contents-item' }, ['• CONTROL - Export metadata including timestamp, filter values, and sheet descriptions']),
                        div({ className: 'export-contents-item' }, ['• INVENTORY - Filtered inventory records based on selected filters']),
                        div({ className: 'export-contents-item' }, ['• ITEM_TYPES - Complete list of all item types']),
                        div({ className: 'export-contents-item' }, ['• TRANSACTIONS - Filtered transaction history matching inventory filters'])
                    ])
                ])
            ])
        ]);
        
        // Build initial form
        setTimeout(buildExportForm, 0);
        
        return content;
    };
    
    // Import Data view
    const importData = () => {
        const state = Store.getState();
        const hasSlocSelected = !!state.selectedSloc;
        
        console.log('Import Data - Selected SLOC:', state.selectedSloc);
        console.log('Import Data - Has SLOC Selected:', hasSlocSelected);
        
        const content = div({}, [
            Components.pageHeader('Import Data', 'Generate import templates for bulk data entry'),
            
            // SLOC Status Display
            state.selectedSloc ? div({ className: 'sloc-status-banner success' }, [
                createElement('strong', {}, ['Selected SLOC: ']),
                createElement('span', {}, [state.selectedSloc.name || 'Unknown'])
            ]) : div({ id: 'import-no-sloc-warning', className: 'sloc-status-banner error' }, [
                createElement('strong', {}, ['⚠️ No SLOC Selected']),
                p('Please select a SLOC from the dropdown in the header to enable inventory import features.')
            ]),
            
            div({ className: 'card' }, [
                div({ className: 'card-header' }, [h3('Import Templates')]),
                div({ className: 'card-body' }, [
                    p('Select an import template to download. Fill in the template and use the upload feature to import your data.'),
                    
                    div({ className: 'import-template-options' }, [
                        
                        // Item Types Template
                        div({ className: 'template-card' }, [
                            div({ className: 'template-card-header' }, [
                                createElement('h4', {}, ['📦 Item Types Template']),
                                p('Import new item types or apply existing item types to new markets', { className: 'text-muted' })
                            ]),
                            div({ className: 'template-card-features' }, [
                                p('• View existing item types by market'),
                                p('• Apply existing items to new markets'),
                                p('• Add new item types with validation')
                            ]),
                            button('📥 Download Item Types Template', { 
                                className: 'btn btn-primary btn-block',
                                onclick: () => ImportExportService.generateItemTypesTemplate()
                            }),
                            button('📤 Import Item Types', { 
                                className: 'btn btn-success btn-block',
                                onclick: handleImportItemTypes
                            })
                        ]),
                        
                        // Inventory Template
                        div({ className: 'template-card' }, [
                            div({ className: 'template-card-header' }, [
                                createElement('h4', {}, ['📊 Inventory Template']),
                                p('Download inventory update template for the selected SLOC', { className: 'text-muted' })
                            ]),
                            div({ className: 'template-card-features' }, [
                                p('• Export serialized and bulk inventory'),
                                p('• Update quantities in Excel'),
                                p('• Includes inventory summary by status')
                            ]),
                            createElement('button', 
                                !hasSlocSelected 
                                    ? { 
                                        id: 'download-inventory-template-btn',
                                        className: 'btn btn-primary btn-block',
                                        disabled: '',
                                        onclick: () => ImportExportService.generateInventoryUpdateTemplate()
                                    }
                                    : { 
                                        id: 'download-inventory-template-btn',
                                        className: 'btn btn-primary btn-block',
                                        onclick: () => ImportExportService.generateInventoryUpdateTemplate()
                                    }
                            , ['📥 Download Inventory Update Template']),
                            createElement('button', 
                                !hasSlocSelected 
                                    ? { 
                                        id: 'import-inventory-btn',
                                        className: 'btn btn-success btn-block',
                                        disabled: '',
                                        onclick: handleImportInventory
                                    }
                                    : { 
                                        id: 'import-inventory-btn',
                                        className: 'btn btn-success btn-block',
                                        onclick: handleImportInventory
                                    }
                            , ['📤 Import Inventory Quantity Adjustment(s)']),
                            createElement('button', 
                                !hasSlocSelected 
                                    ? { 
                                        id: 'import-new-inventory-btn',
                                        className: 'btn btn-success btn-block',
                                        disabled: '',
                                        onclick: handleImportNewInventory
                                    }
                                    : { 
                                        id: 'import-new-inventory-btn',
                                        className: 'btn btn-success btn-block',
                                        onclick: handleImportNewInventory
                                    }
                            , ['📤 Import Inventory']),
                            !hasSlocSelected ? p('⚠️ Please select a SLOC first', { 
                                id: 'inventory-template-warning',
                                className: 'import-warning text-muted'
                            }) : null
                        ])
                    ])
                ])
            ]),
            
            // Import Preview Section (initially hidden)
            div({ id: 'import-preview-section', style: { display: 'none' } })
        ]);
        
        return content;
    };
    
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
            
            // Get row values
            const items = ImportItemTypesService.getNewItemTypeRowValues(workbook);
            
            if (items.length === 0) {
                Components.showToast('No item types found in template', 'warning');
                return;
            }
            
            // Validate each item
            const state = Store.getState();
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
                createElement('h4', {}, ['Import Preview']),
                p(`Found ${items.length} item type(s): ${validCount} valid, ${invalidCount} invalid`, 
                  { style: { margin: '0.5rem 0 0 0', fontSize: '0.9rem' } })
            ]),
            div({ className: 'card-body' }, [
                // Client and Market selectors
                div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f3f4f6', borderRadius: '8px' } }, [
                    // Client selector
                    div({ style: { marginBottom: '1rem' } }, [
                        createElement('label', { 
                            style: { display: 'block', fontWeight: '600', marginBottom: '0.5rem' } 
                        }, ['Select Client:']),
                        (() => {
                            const select = createElement('select', {
                                id: 'import-client-selector',
                                style: { 
                                    width: '100%', 
                                    maxWidth: '400px',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem'
                                },
                                onchange: (e) => {
                                    // Filter markets by selected client
                                    const clientId = e.target.value;
                                    const marketSelector = byId('import-market-selector');
                                    marketSelector.innerHTML = '';
                                    
                                    if (clientId) {
                                        const filteredMarkets = state.markets.filter(m => m.client_id === parseInt(clientId));
                                        filteredMarkets.forEach(market => {
                                            const option = createElement('option', { value: market.name }, [market.name]);
                                            marketSelector.appendChild(option);
                                        });
                                    }
                                }
                            });
                            
                            // Add placeholder option
                            select.appendChild(createElement('option', { value: '' }, ['-- Select a Client --']));
                            
                            // Add client options
                            state.clients.forEach(client => {
                                const option = createElement('option', { value: client.id }, [client.name]);
                                select.appendChild(option);
                            });
                            
                            return select;
                        })()
                    ]),
                    
                    // Market selector
                    div({ style: { marginBottom: '0.5rem' } }, [
                        createElement('label', { 
                            style: { display: 'block', fontWeight: '600', marginBottom: '0.5rem' } 
                        }, ['Select Market(s) for Import:']),
                        p('Hold Ctrl/Cmd to select multiple markets', 
                          { style: { fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.5rem 0' } }),
                        (() => {
                            const select = createElement('select', {
                                id: 'import-market-selector',
                                multiple: true,
                                size: 5,
                                style: { 
                                    width: '100%', 
                                    maxWidth: '400px',
                                    padding: '0.5rem',
                                    border: '1px solid #d1d5db',
                                    borderRadius: '0.375rem'
                                }
                            });
                            
                            // Initially empty - will be populated when client is selected
                            
                            return select;
                        })()
                    ])
                ]),
                
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
        const marketSelector = byId('import-market-selector');
        const selectedMarkets = Array.from(marketSelector.selectedOptions).map(opt => opt.value);
        
        if (selectedMarkets.length === 0) {
            Components.showToast('Please select at least one market', 'warning');
            return;
        }
        
        // Get checked items from table
        const checkboxes = document.querySelectorAll('.import-preview-table input[type="checkbox"]:checked:not(:disabled)');
        const selectedIndices = Array.from(checkboxes).map(cb => parseInt(cb.dataset.index));
        const selectedItems = selectedIndices.map(index => items[index]);
        
        if (selectedItems.length === 0) {
            Components.showToast('No valid items selected for import', 'warning');
            return;
        }
        
        // Confirm import
        if (!confirm(`Import ${selectedItems.length} item type(s) to ${selectedMarkets.length} market(s)?\n\nThis will create ${selectedItems.length} item type record(s) and ${selectedItems.length * selectedMarkets.length} market association(s).`)) {
            return;
        }
        
        // Execute import
        Components.showToast('Importing item types...', 'info');
        
        const results = await ImportItemTypesService.generateNewItemTypes(selectedItems, selectedMarkets);
        
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
    
    // Transactions view
    const transactions = () => {
        const state = Store.getState();
        
        // Filter transactions by selected SLOC
        let filteredTransactions = state.transactions;
        if (state.selectedSloc) {
            filteredTransactions = state.transactions.filter(tx => 
                tx.sloc === state.selectedSloc.name
            );
        }
        
        // Helper to generate changes text from before/after state
        const getChangesText = (tx) => {
            if (!tx.before_state || !tx.after_state) {
                return tx.notes || '-';
            }
            
            try {
                const before = typeof tx.before_state === 'string' ? JSON.parse(tx.before_state) : tx.before_state;
                const after = typeof tx.after_state === 'string' ? JSON.parse(tx.after_state) : tx.after_state;
                
                const changes = [];
                
                // Check for location changes
                if (before.location_id !== after.location_id) {
                    changes.push(`Location: ${tx.from_location_name || 'N/A'} → ${tx.to_location_name || 'N/A'}`);
                }
                
                // Check for status changes
                if (before.status_id !== after.status_id) {
                    changes.push(`Status: ${tx.old_status_name || 'N/A'} → ${tx.status_name || 'N/A'}`);
                }
                
                // Check for quantity changes
                if (before.quantity !== after.quantity) {
                    changes.push(`Quantity: ${tx.old_quantity || before.quantity || 0} → ${tx.quantity || after.quantity || 0}`);
                }
                
                // Check for crew changes
                if (before.assigned_crew_id !== after.assigned_crew_id) {
                    const beforeCrew = before.assigned_crew_id ? state.crews.find(c => c.id === before.assigned_crew_id)?.name : 'None';
                    const afterCrew = tx.assigned_crew_name || 'None';
                    changes.push(`Crew: ${beforeCrew} → ${afterCrew}`);
                }
                
                // Check for area changes
                if (before.area_id !== after.area_id) {
                    const beforeArea = before.area_id ? state.areas.find(a => a.id === before.area_id)?.name : 'None';
                    const afterArea = tx.area_name || 'None';
                    changes.push(`Area: ${beforeArea} → ${afterArea}`);
                }
                
                return changes.length > 0 ? changes.join('; ') : (tx.notes || 'No changes detected');
            } catch (error) {
                return tx.notes || 'Error parsing changes';
            }
        };
        
        // Search functionality
        const searchInputId = 'transaction-search-input';
        const tableContainerId = 'transaction-table-container';
        
        const handleSearch = () => {
            const searchTerm = byId(searchInputId).value.toLowerCase();
            
            const searchFiltered = filteredTransactions.filter(tx => {
                // Search across all relevant fields
                const searchableText = [
                    tx.action,
                    tx.item_type_name,
                    tx.user_name,
                    tx.quantity?.toString(),
                    tx.old_quantity?.toString(),
                    tx.notes,
                    tx.from_location_name,
                    tx.to_location_name,
                    tx.status_name,
                    tx.old_status_name,
                    tx.assigned_crew_name,
                    tx.area_name,
                    getChangesText(tx)
                ].filter(Boolean).join(' ').toLowerCase();
                
                return searchableText.includes(searchTerm);
            });
            
            // Re-render table
            const tableContainer = byId(tableContainerId);
            tableContainer.innerHTML = '';
            
            if (searchFiltered.length > 0) {
                tableContainer.appendChild(Components.dataTable({
                    columns: [
                        { field: 'action', label: 'Action' },
                        { field: 'item_type_name', label: 'Item' },
                        { 
                            field: 'quantity', 
                            label: 'Qty', 
                            render: (val, row) => {
                                const oldQty = row.old_quantity;
                                const newQty = row.quantity;
                                
                                if (oldQty != null && newQty != null) {
                                    const diff = newQty - oldQty;
                                    const diffStr = diff > 0 ? `+${diff}` : diff;
                                    return `${oldQty} → ${newQty} (${diffStr})`;
                                }
                                
                                if (newQty != null) return newQty;
                                if (oldQty != null) return oldQty;
                                return '-';
                            }
                        },
                        { 
                            field: 'user_name', 
                            label: 'User',
                            render: (val, row) => {
                                try {
                                    const userInfo = JSON.parse(row.user_name);
                                    return userInfo.email || userInfo.name || 'Unknown';
                                } catch {
                                    return row.user_name || 'Unknown';
                                }
                            }
                        },
                        { 
                            field: 'date_time', 
                            label: 'Date/Time', 
                            render: (val, row) => formatTimestampWithTimezone(val, row.created_timezone)
                        },
                        { field: 'changes', label: 'Changes', render: (val, row) => getChangesText(row) }
                    ],
                    data: searchFiltered
                }));
            } else {
                tableContainer.appendChild(Components.emptyState('No matching transactions found', '🔍'));
            }
        };
        
        const content = div({}, [
            Components.pageHeader('Transaction History', 'View all inventory transactions'),
            // Search bar
            div({ className: 'mb-3' }, [
                label('Search', { for: searchInputId, style: { marginRight: '0.5rem' } }),
                input('text', {
                    id: searchInputId,
                    placeholder: 'Search transactions...',
                    oninput: handleSearch,
                    style: { width: '300px', padding: '0.5rem' }
                })
            ]),
            // Table container
            div({ id: tableContainerId }, [
                filteredTransactions.length > 0
                    ? Components.dataTable({
                        columns: [
                            { field: 'action', label: 'Action' },
                            { field: 'item_type_name', label: 'Item' },
                            { 
                                field: 'quantity', 
                                label: 'Qty', 
                                render: (val, row) => {
                                    console.log('Transaction row data:', { 
                                        action: row.action, 
                                        quantity: row.quantity, 
                                        old_quantity: row.old_quantity,
                                        item: row.item_type_name 
                                    });
                                    const oldQty = row.old_quantity;
                                    const newQty = row.quantity;
                                    if (oldQty != null && newQty != null) {
                                        const diff = newQty - oldQty;
                                        const diffStr = diff > 0 ? `+${diff}` : diff;
                                        return `${oldQty} → ${newQty} (${diffStr})`;
                                    }
                                    if (newQty != null) return newQty;
                                    if (oldQty != null) return oldQty;
                                    return '-';
                                }
                            },
                            { 
                                field: 'user_name', 
                                label: 'User',
                                render: (val, row) => {
                                    try {
                                        const userInfo = JSON.parse(row.user_name);
                                        return userInfo.email || userInfo.name || 'Unknown';
                                    } catch {
                                        return row.user_name || 'Unknown';
                                    }
                                }
                            },
                            { 
                                field: 'date_time', 
                                label: 'Date/Time', 
                                render: (val, row) => formatTimestampWithTimezone(val, row.created_timezone)
                            },
                            { field: 'changes', label: 'Changes', render: (val, row) => getChangesText(row) }
                        ],
                        data: filteredTransactions
                    })
                    : Components.emptyState('No transactions found', '📜')
            ])
        ]);
        return content;
    };
    
    // Manage item types view
    const manageItems = () => {
        const state = Store.getState();
        
        // Calculate use count for each item type (count inventory records)
        const inventoryUsage = {};
        (state.inventory || []).forEach(inv => {
            if (inv.item_type_id) {
                inventoryUsage[inv.item_type_id] = (inventoryUsage[inv.item_type_id] || 0) + 1;
            }
        });
        
        // Build enhanced data with all attributes and market associations
        const enhancedData = state.itemTypes.map(item => {
            // Get related data
            const inventoryType = state.inventoryTypes.find(it => it.id === item.inventory_type_id);
            const category = state.categories.find(c => c.id === item.category_id);
            const uom = state.unitsOfMeasure.find(u => u.id === item.unit_of_measure_id);
            const provider = state.providers.find(p => p.id === item.provider_id);
            
            // Get associated markets for this item type
            const itemMarkets = (state.itemTypeMarkets || [])
                .filter(itm => itm.item_type_id === item.id);
            const marketNames = itemMarkets
                .map(itm => {
                    const market = state.markets.find(m => m.id === itm.market_id);
                    return market ? market.name : null;
                })
                .filter(name => name !== null);
            
            // Get use count
            const useCount = inventoryUsage[item.id] || 0;
            
            return {
                id: item.id,
                name: item.name || '-',
                inventory_type_name: inventoryType?.name || '-',
                manufacturer: item.manufacturer || '-',
                part_number: item.part_number || '-',
                description: item.description || '-',
                units_per_package: item.units_per_package || 0,
                unit_of_measure: uom?.name || '-',
                category_name: category?.name || '-',
                provider_name: provider?.name || '-',
                low_units_quantity: item.low_units_quantity || '-',
                markets: marketNames.length > 0 ? marketNames.join(', ') : 'None',
                marketCount: marketNames.length,
                marketIds: itemMarkets.map(itm => itm.market_id),
                useCount: useCount
            };
        });
        
        const hasItems = state.itemTypes.length > 0;
        
        const content = div({}, [
            Components.pageHeader(
                'Manage Item Types',
                'Configure inventory item types and market associations',
                [
                    button('Apply to Market', {
                        id: 'bulk-market-assign-btn',
                        className: 'btn btn-primary',
                        onclick: () => enterBulkMarketAssignMode()
                    }),
                    button('Identify Duplicates', {
                        id: 'identify-duplicates-btn',
                        className: 'btn btn-secondary',
                        onclick: () => toggleDuplicateHighlighting()
                    }),
                    button('+ Add Item Type', {
                        id: 'add-item-type-btn',
                        className: 'btn btn-primary',
                        disabled: false,
                        onclick: () => showAddItemTypeModal()
                    }),
                    button('Edit Record', {
                        id: 'edit-item-type-btn',
                        className: 'btn btn-secondary',
                        disabled: true,
                        onclick: () => {
                            const selectedRow = document.querySelector('.item-type-row.selected');
                            if (selectedRow && !selectedRow.classList.contains('editing')) {
                                const itemId = parseInt(selectedRow.getAttribute('data-item-id'));
                                const item = enhancedData.find(i => i.id === itemId);
                                if (item) enableInlineEdit(selectedRow, item, state);
                            }
                        }
                    }),
                    button('Delete Record', {
                        id: 'delete-item-type-btn',
                        className: 'btn btn-danger',
                        disabled: true,
                        onclick: () => {
                            const selectedRow = document.querySelector('.item-type-row.selected');
                            if (selectedRow) {
                                const itemId = parseInt(selectedRow.getAttribute('data-item-id'));
                                const item = enhancedData.find(i => i.id === itemId);
                                if (item) confirmDeleteItemType(item);
                            }
                        }
                    })
                ]
            ),
            
            // Bulk market assignment controls (hidden by default)
            div({ 
                id: 'bulk-market-controls',
                className: 'bulk-market-controls'
            }, [
                div({ className: 'bulk-market-controls-inner' }, [
                    createElement('label', {}, ['Select Market:']),
                    createElement('select', {
                        id: 'bulk-market-select',
                        className: 'form-control',
                        onchange: (e) => handleBulkMarketSelection(e.target.value)
                    }, [
                        createElement('option', { value: '' }, ['-- Select a market --']),
                        ...state.markets.map(market => 
                            createElement('option', { value: market.id }, [market.name])
                        )
                    ]),
                    button('Apply', {
                        id: 'bulk-market-apply-btn',
                        className: 'btn btn-primary btn-apply',
                        disabled: true,
                        onclick: () => applyBulkMarketAssignments()
                    }),
                    button('Cancel', {
                        id: 'bulk-market-cancel-btn',
                        className: 'btn btn-secondary',
                        onclick: () => exitBulkMarketAssignMode()
                    })
                ])
            ]),
            
            hasItems
                ? div({ 
                    id: 'item-types-container'
                }, [
                    // Search bar
                    div({ 
                        style: { 
                            marginBottom: '1rem',
                            padding: '1rem',
                            backgroundColor: '#f9fafb',
                            borderRadius: '0.5rem',
                            border: '1px solid #e5e7eb'
                        }
                    }, [
                        createElement('div', { 
                            style: { 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '0.75rem' 
                            } 
                        }, [
                            createElement('label', { 
                                htmlFor: 'item-type-search',
                                style: { 
                                    fontWeight: '500',
                                    minWidth: '60px'
                                }
                            }, ['Search:']),
                            createElement('input', {
                                type: 'text',
                                id: 'item-type-search',
                                className: 'form-control',
                                placeholder: 'Filter by name, manufacturer, part number, category, market, or description...',
                                style: { 
                                    flex: '1',
                                    padding: '0.5rem 0.75rem'
                                },
                                oninput: (e) => filterItemTypes(e.target.value)
                            }),
                            createElement('span', {
                                id: 'item-type-count',
                                style: {
                                    fontSize: '0.875rem',
                                    color: '#6b7280',
                                    minWidth: '100px',
                                    textAlign: 'right'
                                }
                            }, [`${enhancedData.length} items`])
                        ])
                    ]),
                    // Legend for required fields (fixed at top)
                    div({ className: 'field-legend' }, [
                        createElement('span', { className: 'field-legend-indicator' }),
                        createElement('span', {}, ['= Required field'])
                    ]),
                    // Duplicate move controls (hidden by default)
                    div({ 
                        id: 'duplicate-move-controls',
                        className: 'duplicate-move-controls'
                    }, [
                        div({ className: 'move-control-group' }, [
                            button('Move From', {
                                id: 'move-from-btn',
                                className: 'btn btn-sm btn-warning',
                                disabled: true,
                                onclick: () => setMoveFromItem()
                            }),
                            createElement('span', { 
                                id: 'move-from-info',
                                className: 'move-info'
                            }, ['Not set'])
                        ]),
                        div({ className: 'move-control-group' }, [
                            button('Move To', {
                                id: 'move-to-btn',
                                className: 'btn btn-sm btn-info',
                                disabled: true,
                                onclick: () => setMoveToItem()
                            }),
                            createElement('span', { 
                                id: 'move-to-info',
                                className: 'move-info'
                            }, ['Not set'])
                        ]),
                        button('Execute', {
                            id: 'execute-move-btn',
                            className: 'btn btn-sm btn-success',
                            disabled: true,
                            onclick: () => executeMoveInventory()
                        }),
                        button('Clear', {
                            id: 'clear-move-btn',
                            className: 'btn btn-sm btn-secondary',
                            disabled: true,
                            onclick: () => clearMoveSelection()
                        }),
                        button('Show All Rows', {
                            id: 'toggle-unique-rows-btn',
                            className: 'btn btn-sm btn-secondary',
                            onclick: () => toggleUniqueRows()
                        })
                    ]),
                    // Scrollable table container
                    div({ className: 'item-types-table-scroll' }, [
                        createElement('table', { 
                            id: 'item-types-table',
                            className: 'inventory-table item-types-sticky-header'
                        }, [
                        createElement('thead', {}, [
                            createElement('tr', {}, [
                                createElement('th', {}, ['Name']),
                                createElement('th', {}, ['Type']),
                                createElement('th', {}, ['Manufacturer']),
                                createElement('th', {}, ['Part #']),
                                createElement('th', {}, ['Description']),
                                createElement('th', { className: 'text-center' }, ['Units/Pkg']),
                                createElement('th', {}, ['UOM']),
                                createElement('th', {}, ['Category']),
                                createElement('th', {}, ['Provider']),
                                createElement('th', { className: 'text-center' }, ['Low Qty Alert']),
                                createElement('th', { className: 'markets-column' }, ['Markets']),
                                createElement('th', { className: 'text-center' }, ['Use Count'])
                            ])
                        ]),
                        createElement('tbody', {}, 
                            enhancedData.map(item => 
                                createElement('tr', {
                                    className: 'item-type-row',
                                    'data-item-id': item.id,
                                    'data-use-count': item.useCount,
                                    'data-item-name': (item.name || '').toLowerCase(),
                                    'data-item-part-number': (item.part_number || '').toLowerCase(),
                                    onclick: (e) => {
                                        handleItemTypeRowSelection(item.id, item.useCount);
                                    }
                                }, [
                                    createElement('td', {}, [item.name]),
                                    createElement('td', {}, [item.inventory_type_name]),
                                    createElement('td', {}, [item.manufacturer]),
                                    createElement('td', {}, [item.part_number]),
                                    createElement('td', { className: 'description-cell' }, [item.description]),
                                    createElement('td', { className: 'text-center' }, [String(item.units_per_package)]),
                                    createElement('td', {}, [item.unit_of_measure]),
                                    createElement('td', {}, [item.category_name]),
                                    createElement('td', {}, [item.provider_name]),
                                    createElement('td', { className: 'text-center' }, [String(item.low_units_quantity)]),
                                    createElement('td', { 
                                        className: item.marketCount === 0 ? 'market-cell no-markets' : 'market-cell has-markets'
                                    }, [item.markets]),
                                    createElement('td', { 
                                        className: item.useCount > 0 ? 'text-center use-count-cell in-use' : 'text-center use-count-cell not-used'
                                    }, [String(item.useCount)])
                                ])
                            )
                        )
                    ])
                    ])
                ])
                : Components.emptyState('No item types defined', '🔧')
        ]);
        
        // Add global click handler to deselect when clicking outside table
        setTimeout(() => {
            // Ensure Add button is enabled on load
            const addBtn = byId('add-item-type-btn');
            if (addBtn) addBtn.disabled = false;
            
            const handleOutsideClick = (e) => {
                const table = byId('item-types-table');
                const buttons = document.querySelectorAll('#add-item-type-btn, #edit-item-type-btn, #delete-item-type-btn');
                
                // Check if click is outside table and not on control buttons
                if (table && !table.contains(e.target) && !Array.from(buttons).some(btn => btn.contains(e.target))) {
                    // Don't deselect if a row is being edited
                    const editingRow = document.querySelector('.item-type-row.editing');
                    if (editingRow) return;
                    
                    // Remove all selections
                    const allRows = document.querySelectorAll('.item-type-row');
                    allRows.forEach(row => row.classList.remove('selected'));
                    
                    // Reset button states
                    const addBtn = byId('add-item-type-btn');
                    const editBtn = byId('edit-item-type-btn');
                    const deleteBtn = byId('delete-item-type-btn');
                    
                    if (addBtn) addBtn.disabled = false;
                    if (editBtn) editBtn.disabled = true;
                    if (deleteBtn) deleteBtn.disabled = true;
                }
            };
            
            // Remove any existing listener
            document.removeEventListener('click', window.itemTypeOutsideClickHandler);
            // Add new listener
            window.itemTypeOutsideClickHandler = handleOutsideClick;
            document.addEventListener('click', handleOutsideClick);
        }, 0);
        
        return content;
    };
    
    // Toggle duplicate highlighting for item types
    function toggleDuplicateHighlighting() {
        const btn = byId('identify-duplicates-btn');
        const allRows = document.querySelectorAll('.item-type-row');
        const moveControls = byId('duplicate-move-controls');
        
        // Check if duplicates are currently highlighted
        const isHighlighted = btn.classList.contains('active');
        
        if (isHighlighted) {
            // Remove highlighting and filtering
            allRows.forEach(row => {
                row.classList.remove('duplicate-name', 'duplicate-part', 'hidden-non-duplicate');
            });
            btn.classList.remove('active');
            btn.textContent = 'Identify Duplicates';
            
            // Hide move controls (includes toggle button)
            if (moveControls) {
                moveControls.classList.remove('active');
            }
            
            // Reset toggle unique rows button
            const toggleBtn = byId('toggle-unique-rows-btn');
            if (toggleBtn) {
                toggleBtn.textContent = 'Show All Rows';
                toggleBtn.classList.remove('active');
            }
            
            // Clear move selection
            clearMoveSelection();
        } else {
            // Add highlighting
            const nameGroups = {};
            const partGroups = {};
            const duplicateIds = new Set();
            
            // Group rows by name and part number
            allRows.forEach(row => {
                const name = row.getAttribute('data-item-name');
                const partNumber = row.getAttribute('data-item-part-number');
                const itemId = row.getAttribute('data-item-id');
                
                if (name && name !== '-') {
                    if (!nameGroups[name]) nameGroups[name] = [];
                    nameGroups[name].push({ row, itemId });
                }
                
                if (partNumber && partNumber !== '-') {
                    if (!partGroups[partNumber]) partGroups[partNumber] = [];
                    partGroups[partNumber].push({ row, itemId });
                }
            });
            
            // Highlight rows with duplicate names and track IDs
            Object.values(nameGroups).forEach(group => {
                if (group.length > 1) {
                    group.forEach(({ row, itemId }) => {
                        row.classList.add('duplicate-name');
                        duplicateIds.add(itemId);
                    });
                }
            });
            
            // Highlight rows with duplicate part numbers and track IDs
            Object.values(partGroups).forEach(group => {
                if (group.length > 1) {
                    group.forEach(({ row, itemId }) => {
                        row.classList.add('duplicate-part');
                        duplicateIds.add(itemId);
                    });
                }
            });
            
            // Hide non-duplicate rows
            allRows.forEach(row => {
                const itemId = row.getAttribute('data-item-id');
                if (!duplicateIds.has(itemId)) {
                    row.classList.add('hidden-non-duplicate');
                }
            });
            
            btn.classList.add('active');
            btn.textContent = 'Clear Duplicates';
            
            // Show move controls (includes toggle button)
            if (moveControls) {
                moveControls.classList.add('active');
            }
            
            // Count duplicates
            const duplicateNameCount = Object.values(nameGroups).filter(g => g.length > 1).length;
            const duplicatePartCount = Object.values(partGroups).filter(g => g.length > 1).length;
            
            if (duplicateNameCount === 0 && duplicatePartCount === 0) {
                Components.showToast('No duplicate names or part numbers found', 'success');
            } else {
                const msg = `Found ${duplicateNameCount} duplicate name group(s) and ${duplicatePartCount} duplicate part number group(s). Only duplicates are shown.`;
                Components.showToast(msg, 'info');
            }
        }
    }
    
    // Toggle visibility of unique (non-duplicate) rows
    function toggleUniqueRows() {
        const toggleBtn = byId('toggle-unique-rows-btn');
        const allRows = document.querySelectorAll('.item-type-row');
        
        // Check current state
        const isShowingAll = toggleBtn.classList.contains('active');
        
        if (isShowingAll) {
            // Hide unique rows again
            allRows.forEach(row => {
                if (!row.classList.contains('duplicate-name') && !row.classList.contains('duplicate-part')) {
                    row.classList.add('hidden-non-duplicate');
                }
            });
            toggleBtn.classList.remove('active');
            toggleBtn.textContent = 'Show All Rows';
        } else {
            // Show all rows
            allRows.forEach(row => {
                row.classList.remove('hidden-non-duplicate');
            });
            toggleBtn.classList.add('active');
            toggleBtn.textContent = 'Hide Unique Rows';
        }
    }
    
    // Move inventory item type management
    let moveFromItemId = null;
    let moveToItemId = null;
    
    function setMoveFromItem() {
        const selectedRow = document.querySelector('.item-type-row.selected');
        if (!selectedRow) return;
        
        const itemId = parseInt(selectedRow.getAttribute('data-item-id'));
        const useCount = parseInt(selectedRow.getAttribute('data-use-count'));
        
        // Clear previous move-from selection
        document.querySelectorAll('.item-type-row.move-from-selected').forEach(row => {
            row.classList.remove('move-from-selected');
        });
        
        // Set new move-from
        moveFromItemId = itemId;
        selectedRow.classList.add('move-from-selected');
        
        // Update UI
        const moveFromInfo = byId('move-from-info');
        if (moveFromInfo) {
            moveFromInfo.textContent = `ID: ${itemId} (${useCount} records)`;
            moveFromInfo.classList.add('has-value');
        }
        
        // Enable buttons
        byId('move-to-btn').disabled = false;
        byId('clear-move-btn').disabled = false;
        
        // Check if can execute
        updateExecuteButton();
    }
    
    function setMoveToItem() {
        const selectedRow = document.querySelector('.item-type-row.selected');
        if (!selectedRow) return;
        
        const itemId = parseInt(selectedRow.getAttribute('data-item-id'));
        const useCount = parseInt(selectedRow.getAttribute('data-use-count'));
        
        // Clear previous move-to selection
        document.querySelectorAll('.item-type-row.move-to-selected').forEach(row => {
            row.classList.remove('move-to-selected');
        });
        
        // Set new move-to
        moveToItemId = itemId;
        selectedRow.classList.add('move-to-selected');
        
        // Update UI
        const moveToInfo = byId('move-to-info');
        if (moveToInfo) {
            moveToInfo.textContent = `ID: ${itemId} (${useCount} records)`;
            moveToInfo.classList.add('has-value');
        }
        
        // Check if can execute
        updateExecuteButton();
    }
    
    function updateExecuteButton() {
        const executeBtn = byId('execute-move-btn');
        if (executeBtn) {
            executeBtn.disabled = !(moveFromItemId && moveToItemId && moveFromItemId !== moveToItemId);
        }
    }
    
    function clearMoveSelection() {
        moveFromItemId = null;
        moveToItemId = null;
        
        // Clear visual selections
        document.querySelectorAll('.item-type-row.move-from-selected, .item-type-row.move-to-selected').forEach(row => {
            row.classList.remove('move-from-selected', 'move-to-selected');
        });
        
        // Reset UI
        const moveFromInfo = byId('move-from-info');
        const moveToInfo = byId('move-to-info');
        
        if (moveFromInfo) {
            moveFromInfo.textContent = 'Not set';
            moveFromInfo.classList.remove('has-value');
        }
        
        if (moveToInfo) {
            moveToInfo.textContent = 'Not set';
            moveToInfo.classList.remove('has-value');
        }
        
        // Disable buttons
        byId('move-from-btn').disabled = true;
        byId('move-to-btn').disabled = true;
        byId('execute-move-btn').disabled = true;
        byId('clear-move-btn').disabled = true;
    }
    
    async function executeMoveInventory() {
        if (!moveFromItemId || !moveToItemId || moveFromItemId === moveToItemId) return;
        
        const state = Store.getState();
        const fromItem = state.itemTypes.find(it => it.id === moveFromItemId);
        const toItem = state.itemTypes.find(it => it.id === moveToItemId);
        
        if (!fromItem || !toItem) {
            Components.showToast('Item types not found', 'error');
            return;
        }
        
        // Count affected records
        const affectedRecords = state.inventory.filter(inv => inv.item_type_id === moveFromItemId);
        
        const message = `Move ${affectedRecords.length} inventory record(s) from:\n\n` +
            `FROM: "${fromItem.name}" (ID: ${moveFromItemId})\n` +
            `TO: "${toItem.name}" (ID: ${moveToItemId})\n\n` +
            `This will change the item type association for all affected inventory records. Continue?`;
        
        if (!confirm(message)) return;
        
        try {
            // Update all affected inventory records
            let successCount = 0;
            let errorCount = 0;
            
            for (const record of affectedRecords) {
                const result = await Database.update('inventory', record.id, {
                    item_type_id: moveToItemId,
                    updated_at: getLocalTimestamp()
                });
                
                if (result.isOk) {
                    successCount++;
                } else {
                    errorCount++;
                }
            }
            
            if (errorCount > 0) {
                Components.showToast(`Moved ${successCount} record(s), ${errorCount} failed`, 'warning');
            } else {
                Components.showToast(`Successfully moved ${successCount} inventory record(s)`, 'success');
            }
            
            // Clear selection
            clearMoveSelection();
            
            // Reload data and re-render
            await window.loadInitialData();
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error moving inventory records:', error);
            Components.showToast('Error moving inventory records', 'error');
        }
    }
    
    // Filter item types based on search input
    function filterItemTypes(searchTerm) {
        const rows = document.querySelectorAll('.item-type-row');
        const term = searchTerm.toLowerCase().trim();
        let visibleCount = 0;
        
        rows.forEach(row => {
            if (!term) {
                // Show all rows if search is empty
                row.style.display = '';
                visibleCount++;
            } else {
                // Get searchable content from data attributes
                const name = row.getAttribute('data-item-name') || '';
                const partNumber = row.getAttribute('data-item-part-number') || '';
                
                // Also search in visible cell content
                const cells = row.querySelectorAll('td');
                const manufacturer = cells[2]?.textContent.toLowerCase() || '';
                const description = cells[4]?.textContent.toLowerCase() || '';
                const category = cells[7]?.textContent.toLowerCase() || '';
                const markets = cells[10]?.textContent.toLowerCase() || '';
                
                // Check if any field matches the search term
                const matches = name.includes(term) || 
                               partNumber.includes(term) || 
                               manufacturer.includes(term) || 
                               description.includes(term) ||
                               category.includes(term) ||
                               markets.includes(term);
                
                if (matches) {
                    row.style.display = '';
                    visibleCount++;
                } else {
                    row.style.display = 'none';
                    // Deselect if hidden
                    row.classList.remove('selected');
                }
            }
        });
        
        // Update count display
        const countDisplay = byId('item-type-count');
        if (countDisplay) {
            const totalCount = rows.length;
            if (term) {
                countDisplay.textContent = `${visibleCount} of ${totalCount} items`;
            } else {
                countDisplay.textContent = `${totalCount} items`;
            }
        }
        
        // Disable edit/delete buttons if no rows visible or selected
        const selectedRow = document.querySelector('.item-type-row.selected:not([style*="display: none"])');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        
        if (!selectedRow) {
            if (editBtn) editBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
        }
    }
    
    // Handle item type row selection
    function handleItemTypeRowSelection(itemId, useCount) {
        const clickedRow = document.querySelector(`.item-type-row[data-item-id="${itemId}"]`);
        
        // Check if in duplicate mode
        const duplicateMode = byId('identify-duplicates-btn')?.classList.contains('active');
        if (duplicateMode) {
            // In duplicate mode, handle selection for move operations AND edit/delete
            const wasSelected = clickedRow && clickedRow.classList.contains('selected');
            
            // Remove previous selection
            document.querySelectorAll('.item-type-row.selected').forEach(row => {
                row.classList.remove('selected');
            });
            
            if (!wasSelected && clickedRow) {
                clickedRow.classList.add('selected');
                
                // Enable Move From button if nothing is set yet
                if (!moveFromItemId) {
                    byId('move-from-btn').disabled = false;
                } else if (moveFromItemId && !moveToItemId) {
                    // Enable Move To if Move From is already set
                    byId('move-to-btn').disabled = false;
                }
                
                // Enable edit and delete buttons
                byId('edit-item-type-btn').disabled = false;
                byId('delete-item-type-btn').disabled = false;
            } else {
                // Deselected - disable move buttons if no items are set
                if (!moveFromItemId) {
                    byId('move-from-btn').disabled = true;
                }
                if (!moveToItemId) {
                    byId('move-to-btn').disabled = true;
                }
                
                // Disable edit and delete buttons
                byId('edit-item-type-btn').disabled = true;
                byId('delete-item-type-btn').disabled = true;
            }
            return;
        }
        
        // Check if in bulk market assign mode
        if (window.bulkMarketAssignMode) {
            if (clickedRow) {
                // Check if row is locked (has usage and was initially selected)
                const isLocked = clickedRow.getAttribute('data-locked') === 'true';
                if (isLocked) {
                    Components.showToast('Cannot remove market from items in use', 'warning');
                    return;
                }
                
                // Toggle selection for bulk operations
                const isSelected = clickedRow.classList.contains('bulk-selected');
                if (isSelected) {
                    clickedRow.classList.remove('bulk-selected');
                } else {
                    clickedRow.classList.add('bulk-selected');
                }
            }
            return;
        }
        
        // If row is being edited, don't allow selection changes
        if (clickedRow && clickedRow.classList.contains('editing')) {
            return;
        }
        
        // Check if clicking on already selected row (deselect)
        const wasSelected = clickedRow && clickedRow.classList.contains('selected');
        
        // Remove previous selection
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => row.classList.remove('selected'));
        
        // If it was already selected, deselect it
        if (wasSelected) {
            // Reset button states to default
            const addBtn = byId('add-item-type-btn');
            const editBtn = byId('edit-item-type-btn');
            const deleteBtn = byId('delete-item-type-btn');
            
            if (addBtn) addBtn.disabled = false;
            if (editBtn) editBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
            return;
        }
        
        // Add selection to clicked row
        if (clickedRow) {
            clickedRow.classList.add('selected');
        }
        
        // Update button states
        const addBtn = byId('add-item-type-btn');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        
        if (addBtn) addBtn.disabled = true;
        if (editBtn) editBtn.disabled = false;
        if (deleteBtn) deleteBtn.disabled = useCount > 0;
    }
    
    // Confirm delete item type
    function confirmDeleteItemType(item) {
        const confirmed = confirm(
            `Are you sure you want to delete the item type "${item.name}"?\n\n` +
            `This action cannot be undone.`
        );
        
        if (confirmed) {
            deleteItemType(item.id);
        }
    }
    
    // Delete item type
    async function deleteItemType(itemTypeId) {
        try {
            // Delete the item type
            const deleteResult = await Database.deleteRecord('item_types', itemTypeId);
            
            if (!deleteResult.isOk) {
                Components.showToast('Error deleting item type', 'error');
                return;
            }
            
            // Refresh cached item types
            await refreshCachedTable('item_types');
            
            Components.showToast('Item type deleted successfully', 'success');
            
            // Check if in duplicate mode and exit it
            const duplicateBtn = byId('identify-duplicates-btn');
            if (duplicateBtn && duplicateBtn.classList.contains('active')) {
                // Exit duplicate mode
                toggleDuplicateHighlighting();
            }
            
            // Refresh the view
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error deleting item type:', error);
            Components.showToast('Error deleting item type', 'error');
        }
    }
    
    // Bulk market assignment functions
    function enterBulkMarketAssignMode() {
        window.bulkMarketAssignMode = true;
        window.bulkMarketSelectedMarketId = null;
        window.bulkMarketInitialAssignments = {};
        
        // Show controls, hide other buttons
        const controls = byId('bulk-market-controls');
        const addBtn = byId('add-item-type-btn');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        const bulkBtn = byId('bulk-market-assign-btn');
        
        if (controls) controls.style.display = 'block';
        if (addBtn) addBtn.style.display = 'none';
        if (editBtn) editBtn.style.display = 'none';
        if (deleteBtn) deleteBtn.style.display = 'none';
        if (bulkBtn) bulkBtn.style.display = 'none';
        
        // Clear any existing selections
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => {
            row.classList.remove('selected', 'bulk-selected');
        });
        
        Components.showToast('Select a market to manage assignments', 'info');
    }
    
    function handleBulkMarketSelection(marketId) {
        if (!marketId) {
            const applyBtn = byId('bulk-market-apply-btn');
            if (applyBtn) applyBtn.disabled = true;
            return;
        }
        
        window.bulkMarketSelectedMarketId = parseInt(marketId);
        const state = Store.getState();
        
        // Get SLOCs for the selected market
        const marketSlocs = (state.slocs || []).filter(sloc => sloc.market_id === parseInt(marketId));
        const marketSlocIds = marketSlocs.map(sloc => sloc.id);
        
        // Store initial assignments for this market
        window.bulkMarketInitialAssignments = {};
        const allRows = document.querySelectorAll('.item-type-row');
        
        allRows.forEach(row => {
            const itemId = parseInt(row.getAttribute('data-item-id'));
            
            // Calculate use count for this item at SLOCs in the selected market
            const marketUseCount = (state.inventory || []).filter(inv => 
                inv.item_type_id === itemId && marketSlocIds.includes(inv.sloc_id)
            ).length;
            
            // Update the use count column to show market-specific count
            const useCountCell = row.cells[row.cells.length - 1];
            if (useCountCell) {
                useCountCell.textContent = String(marketUseCount);
                useCountCell.style.fontWeight = 'bold';
                useCountCell.style.color = marketUseCount > 0 ? '#28a745' : '#999';
            }
            
            // Check if this item is associated with selected market
            const hasAssociation = (state.itemTypeMarkets || []).some(itm => 
                itm.item_type_id === itemId && itm.market_id === window.bulkMarketSelectedMarketId
            );
            
            window.bulkMarketInitialAssignments[itemId] = hasAssociation;
            
            // Select rows that are already associated
            if (hasAssociation) {
                row.classList.add('bulk-selected');
            } else {
                row.classList.remove('bulk-selected');
            }
            
            // Disable rows with market-specific use count > 0 for deselection protection
            if (hasAssociation && marketUseCount > 0) {
                row.style.backgroundColor = '#e0e0e0';
                row.style.color = '#666';
                row.style.cursor = 'not-allowed';
                row.setAttribute('data-locked', 'true');
                
                // Make all cells gray
                for (let i = 0; i < row.cells.length; i++) {
                    row.cells[i].style.backgroundColor = '#e0e0e0';
                    row.cells[i].style.color = '#666';
                }
            } else {
                row.style.backgroundColor = '';
                row.style.color = '';
                row.style.cursor = 'pointer';
                row.removeAttribute('data-locked');
                
                // Reset cell colors
                for (let i = 0; i < row.cells.length; i++) {
                    row.cells[i].style.backgroundColor = '';
                    row.cells[i].style.color = '';
                }
            }
        });
        
        const applyBtn = byId('bulk-market-apply-btn');
        if (applyBtn) applyBtn.disabled = false;
    }
    
    async function applyBulkMarketAssignments() {
        if (!window.bulkMarketSelectedMarketId) return;
        
        const state = Store.getState();
        const marketId = window.bulkMarketSelectedMarketId;
        const allRows = document.querySelectorAll('.item-type-row');
        
        const toAdd = [];
        const toRemove = [];
        
        allRows.forEach(row => {
            const itemId = parseInt(row.getAttribute('data-item-id'));
            const isLocked = row.getAttribute('data-locked') === 'true';
            const isSelected = row.classList.contains('bulk-selected');
            const wasInitiallyAssociated = window.bulkMarketInitialAssignments[itemId];
            
            // If locked (has usage), cannot be removed
            if (isLocked && wasInitiallyAssociated) {
                return; // Keep existing assignment
            }
            
            // Check for changes
            if (isSelected && !wasInitiallyAssociated) {
                toAdd.push(itemId);
            } else if (!isSelected && wasInitiallyAssociated && !isLocked) {
                toRemove.push(itemId);
            }
        });
        
        try {
            // Remove associations
            for (const itemId of toRemove) {
                const association = state.itemTypeMarkets.find(itm => 
                    itm.item_type_id === itemId && itm.market_id === marketId
                );
                if (association) {
                    await Database.deleteRecord('item_type_markets', association.id);
                }
            }
            
            // Add new associations
            for (const itemId of toAdd) {
                await Queries.insert('item_type_markets', {
                    item_type_id: itemId,
                    market_id: marketId
                });
            }
            
            // Refresh data
            await refreshCachedTable('item_type_markets');
            
            Components.showToast(`Updated ${toAdd.length + toRemove.length} associations`, 'success');
            
            // Exit mode and refresh view
            exitBulkMarketAssignMode();
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error applying bulk market assignments:', error);
            Components.showToast('Error updating market assignments', 'error');
        }
    }
    
    function exitBulkMarketAssignMode() {
        window.bulkMarketAssignMode = false;
        window.bulkMarketSelectedMarketId = null;
        window.bulkMarketInitialAssignments = {};
        
        // Hide controls, show other buttons
        const controls = byId('bulk-market-controls');
        const addBtn = byId('add-item-type-btn');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        const bulkBtn = byId('bulk-market-assign-btn');
        
        if (controls) controls.style.display = 'none';
        if (addBtn) addBtn.style.display = 'inline-block';
        if (editBtn) editBtn.style.display = 'inline-block';
        if (deleteBtn) deleteBtn.style.display = 'inline-block';
        if (bulkBtn) bulkBtn.style.display = 'inline-block';
        
        // Clear selections and reset styles
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => {
            row.classList.remove('selected', 'bulk-selected');
            row.style.backgroundColor = '';
            row.style.cursor = 'pointer';
            row.removeAttribute('data-locked');
            
            // Restore original use count
            const itemId = parseInt(row.getAttribute('data-item-id'));
            const originalUseCount = parseInt(row.getAttribute('data-use-count'));
            const useCountCell = row.cells[row.cells.length - 1];
            if (useCountCell) {
                useCountCell.textContent = String(originalUseCount);
                useCountCell.style.fontWeight = 'bold';
                useCountCell.style.color = originalUseCount > 0 ? '#28a745' : '#999';
            }
        });
        
        // Reset button states
        if (addBtn) addBtn.disabled = false;
        if (editBtn) editBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
        
        // Reset market dropdown
        const marketSelect = byId('bulk-market-select');
        if (marketSelect) marketSelect.value = '';
    }
    
    // Manage crews view
    const manageCrews = () => {
        const state = Store.getState();
        
        // Get markets for lookup
        const markets = state.markets || [];
        
        // Enrich crew data with market name and use count
        const enrichedCrews = (state.crews || []).map(crew => {
            const market = markets.find(m => m.id === crew.market_id);
            const useCount = (state.inventory || []).filter(inv => inv.assigned_crew_id === crew.id).length;
            
            return {
                ...crew,
                marketName: market?.name || 'Unknown',
                useCount: useCount
            };
        });
        
        const content = div({}, [
            Components.pageHeader(
                'Manage Crews',
                'Configure work crews by market',
                [
                    button('Add Crew', {
                        id: 'add-crew-btn',
                        className: 'btn btn-primary',
                        onclick: () => showAddCrewRow()
                    }),
                    button('Edit Crew', {
                        id: 'edit-crew-btn',
                        className: 'btn btn-secondary',
                        disabled: true,
                        onclick: () => {
                            const selectedRow = document.querySelector('.crew-row.selected');
                            if (selectedRow) {
                                const crewId = parseInt(selectedRow.getAttribute('data-crew-id'));
                                const crew = enrichedCrews.find(c => c.id === crewId);
                                if (crew) enableCrewInlineEdit(selectedRow, crew, state);
                            }
                        }
                    }),
                    button('Delete Crew', {
                        id: 'delete-crew-btn',
                        className: 'btn btn-danger',
                        disabled: true,
                        onclick: () => {
                            const selectedRow = document.querySelector('.crew-row.selected');
                            if (selectedRow) {
                                const crewId = parseInt(selectedRow.getAttribute('data-crew-id'));
                                const crew = enrichedCrews.find(c => c.id === crewId);
                                if (crew) deleteCrewRecord(crew);
                            }
                        }
                    })
                ]
            ),
            
            // Legend
            div({ className: 'crew-legend' }, [
                createElement('strong', {}, ['Legend: ']),
                createElement('span', { className: 'crew-legend-field' }, ['Required Field'])
            ]),
            
            enrichedCrews.length > 0
                ? div({}, [
                    createElement('table', {
                        id: 'crews-table',
                        className: 'data-table'
                    }, [
                        createElement('thead', {}, [
                            createElement('tr', {}, [
                                createElement('th', {}, ['Name']),
                                createElement('th', {}, ['Market']),
                                createElement('th', {}, ['Information']),
                                createElement('th', { className: 'text-center' }, ['Use Count']),
                                createElement('th', { className: 'text-center' }, ['Created'])
                            ])
                        ]),
                        createElement('tbody', {}, 
                            enrichedCrews.map(crew => 
                                createElement('tr', {
                                    className: 'crew-row',
                                    'data-crew-id': crew.id,
                                    onclick: function() {
                                        handleCrewRowSelection(this);
                                    }
                                }, [
                                    createElement('td', {}, [crew.name]),
                                    createElement('td', {}, [crew.marketName]),
                                    createElement('td', {}, [crew.information || '']),
                                    createElement('td', { className: 'text-center' }, [String(crew.useCount)]),
                                    createElement('td', { className: 'text-center' }, [
                                        new Date(crew.created_at).toLocaleDateString()
                                    ])
                                ])
                            )
                        )
                    ])
                ])
                : Components.emptyState('No crews defined', '👥')
        ]);
        
        return content;
    };
    
    // Manage Hierarchy (Clients/Markets/SLOCs/Areas) view
    const manageHierarchy = () => {
        const state = Store.getState();
        
        // Get current selection from state or default to 'clients'
        const selectedTable = state.hierarchyTableSelection || 'clients';
        
        const content = div({}, [
            Components.pageHeader(
                'Manage Clients/Markets/SLOCs/Areas',
                'Configure organizational hierarchy',
                []
            ),
            
            // Table selector dropdown
            div({ className: 'hierarchy-selector' }, [
                createElement('label', {}, ['Select Table:']),
                (() => {
                    const select = createElement('select', {
                        id: 'hierarchy-table-selector',
                        className: 'form-select',
                        onchange: (e) => {
                            Store.setState({ hierarchyTableSelection: e.target.value });
                            Views.render('manage-areas');
                        }
                    }, [
                        createElement('option', { value: 'clients' }, ['Clients']),
                        createElement('option', { value: 'markets' }, ['Markets']),
                        createElement('option', { value: 'slocs' }, ['SLOCs']),
                        createElement('option', { value: 'areas' }, ['Areas'])
                    ]);
                    select.value = selectedTable;
                    return select;
                })()
            ]),
            
            // Render selected subsection
            selectedTable === 'clients' ? renderClientsSection(state) :
            selectedTable === 'markets' ? renderMarketsSection(state) :
            selectedTable === 'slocs' ? renderSlocsSection(state) :
            selectedTable === 'areas' ? renderAreasSection(state) :
            div({}, ['Invalid selection'])
        ]);
        
        return content;
    };
    
    // Render view
    const render = (viewName) => {
        const container = byId('view-container');
        if (!container) return;
        
        // Update active nav button
        $$('.nav-btn').forEach(btn => removeClass('active', btn));
        const activeBtn = $(`.nav-btn[data-view="${viewName}"]`);
        if (activeBtn) addClass('active', activeBtn);
        
        // Render view
        empty(container);
        
        let content;
        switch (viewName) {
            case 'dashboard':
                content = dashboard();
                break;
            case 'inventory-view':
                content = inventoryView();
                break;
            case 'receive-serialized':
                content = receiveSerialized();
                break;
            case 'receive-bulk':
                content = receiveBulk();
                break;
            case 'transactions':
                content = transactions();
                break;
            case 'export':
                content = exportData();
                break;
            case 'import':
                content = importData();
                break;
            case 'manage-items':
                content = manageItems();
                break;
            case 'manage-crews':
                content = manageCrews();
                break;
            case 'manage-areas':
                content = manageHierarchy();
                break;
            case 'preferences':
                content = preferences();
                break;
            default:
                content = div({}, [h2('View not found')]);
        }
        
        container.appendChild(content);
        
        // Only update state if view actually changed (prevent infinite loop)
        if (Store.get('currentView') !== viewName) {
            Store.actions.setView(viewName);
        }
    };
    
    // Preferences view
    const preferences = () => {
        const state = Store.getState();
        
        // Check if user has admin role
        const isAdmin = state.user?.role === 'admin';
        
        // Get current preference values
        const receivingStatusPref = state.config.find(c => c.key === 'receivingStatus');
        const currentReceivingStatus = receivingStatusPref ? receivingStatusPref.value : 'Available';
        
        const receivingLocationPref = state.config.find(c => c.key === 'receivingLocation');
        const currentReceivingLocation = receivingLocationPref ? receivingLocationPref.value : '';
        
        // Get storage locations (location_type = 'Storage')
        const storageLocations = (state.locations || []).filter(loc => 
            loc.location_types?.name === 'Storage'
        );
        
        // Function to show a preference section
        const showPreferenceSection = (sectionId) => {
            // Hide all sections
            const sections = isAdmin ? ['receiving-section', 'display-section', 'admin-section', 'config-section', 'users-section', 'export-section'] : ['receiving-section', 'display-section'];
            sections.forEach(id => {
                const section = byId(id);
                if (section) section.style.display = 'none';
            });
            
            // Remove active class from all nav items
            const navItems = document.querySelectorAll('.prefs-nav-item');
            navItems.forEach(item => item.classList.remove('active'));
            
            // Show selected section
            const selectedSection = byId(sectionId);
            if (selectedSection) selectedSection.style.display = 'block';
            
            // Add active class to clicked nav item
            const activeNav = document.querySelector(`[data-section="${sectionId}"]`);
            if (activeNav) activeNav.classList.add('active');
        };
        
        // Handler functions for clearing tables
        const handleClearItemTypes = async () => {
            const state = Store.getState();
            const count = state.itemTypes.length;
            
            if (count === 0) {
                Components.showToast('No item types to clear', 'info');
                return;
            }
            
            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete ALL ${count} item types.\n\n` +
                `This action cannot be undone and may affect inventory records.\n\n` +
                `Are you sure you want to continue?`
            );
            
            if (!confirmed) return;
            
            try {
                // Delete all item types
                const deletePromises = state.itemTypes.map(itemType => 
                    Database.deleteRecord('item_types', itemType.id)
                );
                
                await Promise.all(deletePromises);
                
                // Reload item types state
                const itemTypesResult = await Queries.getAllItemTypes();
                if (itemTypesResult.isOk) {
                    Store.setState({ itemTypes: itemTypesResult.value });
                }
                
                Components.showToast(`Successfully cleared ${count} item types`, 'success');
                
                // Refresh preferences view to update counts
                Views.render('preferences');
            } catch (error) {
                console.error('Error clearing item types:', error);
                Components.showToast('Failed to clear item types', 'error');
            }
        };
        
        const handleClearInventory = async () => {
            const state = Store.getState();
            const count = state.inventory.length;
            
            if (count === 0) {
                Components.showToast('No inventory to clear', 'info');
                return;
            }
            
            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete ALL ${count} inventory records.\n\n` +
                `This action cannot be undone.\n\n` +
                `Are you sure you want to continue?`
            );
            
            if (!confirmed) return;
            
            try {
                // Delete all inventory
                const deletePromises = state.inventory.map(item => 
                    Database.deleteRecord('inventory', item.id)
                );
                
                await Promise.all(deletePromises);
                
                // Reload inventory state
                const inventoryResult = await Queries.getAllInventory();
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
                
                Components.showToast(`Successfully cleared ${count} inventory records`, 'success');
                
                // Refresh preferences view to update counts
                Views.render('preferences');
            } catch (error) {
                console.error('Error clearing inventory:', error);
                Components.showToast('Failed to clear inventory', 'error');
            }
        };
        
        const handleClearTransactions = async () => {
            const state = Store.getState();
            const count = state.transactions.length;
            
            if (count === 0) {
                Components.showToast('No transactions to clear', 'info');
                return;
            }
            
            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete ALL ${count} transaction records.\n\n` +
                `This action cannot be undone.\n\n` +
                `Are you sure you want to continue?`
            );
            
            if (!confirmed) return;
            
            try {
                // Delete all transactions
                const deletePromises = state.transactions.map(tx => 
                    Database.deleteRecord('transactions', tx.id)
                );
                
                await Promise.all(deletePromises);
                
                // Reload transactions state
                const transactionsResult = await Queries.getAllTransactions(100);
                if (transactionsResult.isOk) {
                    Store.setState({ transactions: transactionsResult.value });
                }
                
                Components.showToast(`Successfully cleared ${count} transaction records`, 'success');
                
                // Refresh preferences view to update counts
                Views.render('preferences');
            } catch (error) {
                console.error('Error clearing transactions:', error);
                Components.showToast('Failed to clear transactions', 'error');
            }
        };
        
        const handleClearSequentials = async () => {
            const state = Store.getState();
            const count = (state.sequentials || []).length;
            
            if (count === 0) {
                Components.showToast('No sequentials to clear', 'info');
                return;
            }
            
            const confirmed = confirm(
                `⚠️ WARNING: This will permanently delete ALL ${count} sequential records.\n\n` +
                `This action cannot be undone.\n\n` +
                `Are you sure you want to continue?`
            );
            
            if (!confirmed) return;
            
            try {
                // Delete all sequentials
                const deletePromises = state.sequentials.map(seq => 
                    Database.deleteRecord('sequentials', seq.id)
                );
                
                await Promise.all(deletePromises);
                
                // Reload sequentials state
                const sequentialsResult = await Queries.getAllSequentials();
                if (sequentialsResult.isOk) {
                    Store.setState({ sequentials: sequentialsResult.value });
                }
                
                Components.showToast(`Successfully cleared ${count} sequential records`, 'success');
                
                // Refresh preferences view to update counts
                Views.render('preferences');
            } catch (error) {
                console.error('Error clearing sequentials:', error);
                Components.showToast('Failed to clear sequentials', 'error');
            }
        };
        
        // Config Management Handlers
        const handleEditConfigValue = async (key, currentValue) => {
            const newValue = prompt(`Edit config value for "${key}":`, currentValue || '');
            
            if (newValue === null) return; // User cancelled
            
            const result = await Queries.setConfig(key, newValue);
            if (result.isOk) {
                // Reload config
                const configResult = await Queries.getAllConfig();
                if (configResult.isOk) {
                    Store.setState({ config: configResult.value });
                }
                Components.showToast('Config updated successfully', 'success');
                Views.render('preferences');
                showPreferenceSection('admin-section');
            } else {
                Components.showToast('Failed to update config', 'error');
            }
        };
        
        const handleDeleteConfigKey = async (key) => {
            const confirmed = confirm(`Are you sure you want to delete the config key "${key}"?`);
            if (!confirmed) return;
            
            // Use direct Supabase delete since config table uses 'key' as primary key
            try {
                const client = Database.getClient();
                const { error } = await client
                    .from('config')
                    .delete()
                    .eq('key', key);
                
                if (error) throw error;
                
                // Reload config
                const configResult = await Queries.getAllConfig();
                if (configResult.isOk) {
                    Store.setState({ config: configResult.value });
                }
                Components.showToast('Config key deleted successfully', 'success');
                Views.render('preferences');
                showPreferenceSection('config-section');
            } catch (error) {
                console.error('Delete config error:', error);
                Components.showToast('Failed to delete config key', 'error');
            }
        };
        
        // User Management - Open Supabase Dashboard
        const handleOpenSupabaseDashboard = () => {
            const supabaseUrl = Database.getClient().supabaseUrl;
            if (supabaseUrl) {
                // Extract project reference from URL
                const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
                if (projectRef) {
                    window.open(`https://supabase.com/dashboard/project/${projectRef}/auth/users`, '_blank');
                } else {
                    window.open('https://supabase.com/dashboard', '_blank');
                }
            } else {
                window.open('https://supabase.com/dashboard', '_blank');
            }
        };
        
        const handleBulkExport = async () => {
            Components.showToast('Preparing database export...', 'info');
            const result = await ImportExportService.exportDatabaseToExcel();
            // Toast is shown by the service
        };
        
        const content = div({}, [
            Components.pageHeader('Preferences', 'Configure system settings'),
            
            div({ className: 'two-column-layout' }, [
                // Left column - navigation links
                div({ className: 'left-column' }, [
                    div({ style: { padding: '1rem' } }, [
                        createElement('h3', { style: { margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151' } }, [
                            'Settings'
                        ]),
                        div({ className: 'prefs-nav-list' }, [
                            createElement('div', {
                                className: 'prefs-nav-item active',
                                'data-section': 'receiving-section',
                                onclick: () => showPreferenceSection('receiving-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['⚙️']),
                                'Receiving'
                            ]),
                            createElement('div', {
                                className: 'prefs-nav-item',
                                'data-section': 'display-section',
                                onclick: () => showPreferenceSection('display-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['🎨']),
                                'Inventory Display'
                            ])
                        ].concat(isAdmin ? [
                            div({ style: { margin: '1rem 0 0.5rem 0', padding: '0.5rem 1rem', fontSize: '0.75rem', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' } }, ['Admin Functions']),
                            createElement('div', {
                                className: 'prefs-nav-item',
                                'data-section': 'admin-section',
                                onclick: () => showPreferenceSection('admin-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['🗑️']),
                                'Clear Tables'
                            ]),
                            createElement('div', {
                                className: 'prefs-nav-item',
                                'data-section': 'config-section',
                                onclick: () => showPreferenceSection('config-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['⚙️']),
                                'Config Management'
                            ]),
                            createElement('div', {
                                className: 'prefs-nav-item',
                                'data-section': 'users-section',
                                onclick: () => showPreferenceSection('users-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['👥']),
                                'User Management'
                            ]),
                            createElement('div', {
                                className: 'prefs-nav-item',
                                'data-section': 'export-section',
                                onclick: () => showPreferenceSection('export-section')
                            }, [
                                createElement('span', { style: { marginRight: '0.5rem' } }, ['📤']),
                                'Bulk Export'
                            ])
                        ] : []))
                    ])
                ]),
                
                // Right column - content sections
                div({ className: 'right-column' }, [
                    // Receiving Preferences Section
                    div({ id: 'receiving-section', className: 'prefs-content-section', style: { display: 'block' } }, [
                        createElement('h3', { className: 'section-header' }, ['Receiving Preferences']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Configure how items are processed when received into inventory.'
                        ]),
                        div({ style: { maxWidth: '500px' } }, [
                            Components.formField({
                                type: 'select',
                                id: 'receiving_status',
                                name: 'receiving_status',
                                label: 'Set newly received items as',
                                value: currentReceivingStatus,
                                options: [
                                    { value: 'Received', text: 'Received' },
                                    { value: 'Available', text: 'Available' }
                                ],
                                onchange: async (e) => {
                                    const newValue = e.target.value;
                                    const result = await Queries.setConfig('receivingStatus', newValue);
                                    if (result.isOk) {
                                        // Update state
                                        const updatedConfig = state.config.map(c => 
                                            c.key === 'receivingStatus' ? { ...c, value: newValue } : c
                                        );
                                        // If key doesn't exist, add it
                                        if (!updatedConfig.find(c => c.key === 'receivingStatus')) {
                                            updatedConfig.push({ key: 'receivingStatus', value: newValue });
                                        }
                                        Store.setState({ config: updatedConfig });
                                        Components.showToast('Preference saved', 'success');
                                    } else {
                                        Components.showToast('Failed to save preference', 'error');
                                    }
                                }
                            }),
                            Components.formField({
                                type: 'select',
                                id: 'receiving_location',
                                name: 'receiving_location',
                                label: 'Default receiving location',
                                value: currentReceivingLocation,
                                options: [
                                    { value: '', text: '-- Select Location --' },
                                    ...storageLocations.map(loc => ({
                                        value: loc.id.toString(),
                                        text: loc.name
                                    }))
                                ],
                                onchange: async (e) => {
                                    const newValue = e.target.value;
                                    const result = await Queries.setConfig('receivingLocation', newValue);
                                    if (result.isOk) {
                                        // Update state
                                        const updatedConfig = state.config.map(c => 
                                            c.key === 'receivingLocation' ? { ...c, value: newValue } : c
                                        );
                                        // If key doesn't exist, add it
                                        if (!updatedConfig.find(c => c.key === 'receivingLocation')) {
                                            updatedConfig.push({ key: 'receivingLocation', value: newValue });
                                        }
                                        Store.setState({ config: updatedConfig });
                                        Components.showToast('Preference saved', 'success');
                                    } else {
                                        Components.showToast('Failed to save preference', 'error');
                                    }
                                }
                            }),
                            div({ style: { fontSize: '0.875rem', color: '#6b7280', marginTop: '0.75rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
                                createElement('strong', { style: { display: 'block', marginBottom: '0.5rem' } }, ['About this setting:']),
                                createElement('ul', { style: { margin: 0, paddingLeft: '1.5rem' } }, [
                                    createElement('li', { style: { marginBottom: '0.25rem' } }, [
                                        createElement('strong', {}, ['Received:']), ' Items need additional processing before use'
                                    ]),
                                    createElement('li', {}, [
                                        createElement('strong', {}, ['Available:']), ' Items are ready for immediate use'
                                    ])
                                ])
                            ])
                        ])
                    ]),
                    
                    // Inventory Display Preferences Section
                    div({ id: 'display-section', className: 'prefs-content-section', style: { display: 'none' } }, [
                        createElement('h3', { className: 'section-header' }, ['Inventory Display Preferences']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Customize the visual appearance of inventory items based on their status. Click on a color cell to change it.'
                        ]),
                        createElement('table', {
                            className: 'inventory-table',
                            style: { width: '100%', borderCollapse: 'collapse' }
                        }, [
                            createElement('thead', {}, [
                                createElement('tr', {}, [
                                    createElement('th', { style: { width: '15%', textAlign: 'left' } }, ['Status']),
                                    createElement('th', { style: { width: '8%', textAlign: 'center' } }, ['Visible']),
                                    createElement('th', { style: { width: '10%', textAlign: 'center' } }, ['Background']),
                                    createElement('th', { style: { width: '10%', textAlign: 'center' } }, ['Text']),
                                    createElement('th', { style: { width: '57%', textAlign: 'left' } }, ['Preview'])
                                ])
                            ]),
                            createElement('tbody', {},
                                state.statuses.map(status => {
                                    const defaultColors = {
                                        'Available': { background: '#75c283', text: '#000000' },
                                        'Issued': { background: '#4099dd', text: '#ffffff' },
                                        'Rejected': { background: '#ed4545', text: '#000000' }
                                    };
                                    
                                    const savedColors = JSON.parse(localStorage.getItem('statusColors') || '{}');
                                    const colors = savedColors[status.name] || defaultColors[status.name] || { background: '#ffffff', text: '#000000' };
                                    
                                    const savedVisibility = JSON.parse(localStorage.getItem('statusVisibility') || '{}');
                                    const defaultVisible = ['Available', 'Issued', 'Rejected'].includes(status.name);
                                    const isVisible = savedVisibility[status.name] !== undefined ? savedVisibility[status.name] : defaultVisible;
                                    
                                    return createElement('tr', {}, [
                                        // Status name
                                        createElement('td', { style: { fontWeight: '500' } }, [status.name]),
                                        
                                        // Visible checkbox
                                        createElement('td', { 
                                            style: { 
                                                textAlign: 'center',
                                                padding: '0.5rem'
                                            }
                                        }, [
                                            createElement('input', {
                                                type: 'checkbox',
                                                checked: isVisible,
                                                style: {
                                                    width: '18px',
                                                    height: '18px',
                                                    cursor: 'pointer'
                                                },
                                                onchange: (e) => {
                                                    const visibility = JSON.parse(localStorage.getItem('statusVisibility') || '{}');
                                                    visibility[status.name] = e.target.checked;
                                                    localStorage.setItem('statusVisibility', JSON.stringify(visibility));
                                                    
                                                    // Refresh inventory lists to apply visibility filter
                                                    const state = Store.getState();
                                                    if (state.activeView === 'inventory') {
                                                        Views.inventoryView();
                                                    }
                                                }
                                            })
                                        ]),
                                        
                                        // Background color cell
                                        createElement('td', { 
                                            style: { 
                                                textAlign: 'center',
                                                padding: '0.5rem'
                                            }
                                        }, [
                                            createElement('input', {
                                                type: 'color',
                                                value: colors.background,
                                                style: {
                                                    width: '50px',
                                                    height: '40px',
                                                    cursor: 'pointer',
                                                    border: '2px solid #d1d5db',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: colors.background
                                                },
                                                onchange: (e) => {
                                                    updateStatusColor(status.name, 'background', e.target.value);
                                                }
                                            })
                                        ]),
                                        
                                        // Text color cell
                                        createElement('td', { 
                                            style: { 
                                                textAlign: 'center',
                                                padding: '0.5rem'
                                            }
                                        }, [
                                            createElement('input', {
                                                type: 'color',
                                                value: colors.text,
                                                style: {
                                                    width: '50px',
                                                    height: '40px',
                                                    cursor: 'pointer',
                                                    border: '2px solid #d1d5db',
                                                    borderRadius: '0.375rem',
                                                    backgroundColor: colors.text
                                                },
                                                onchange: (e) => {
                                                    updateStatusColor(status.name, 'text', e.target.value);
                                                }
                                            })
                                        ]),
                                        
                                        // Preview cell
                                        createElement('td', {}, [
                                            div({ 
                                                style: { 
                                                    padding: '0.75rem', 
                                                    backgroundColor: colors.background, 
                                                    color: colors.text, 
                                                    borderRadius: '0.25rem', 
                                                    border: '1px solid #d1d5db', 
                                                    fontSize: '0.875rem',
                                                    width: '100%'
                                                } 
                                            }, [
                                                `Location | Crew | Area | Item Type | Category | 100 | ${status.name}`
                                            ])
                                        ])
                                    ]);
                                })
                            )
                        ])
                    ])
                ].concat(isAdmin ? [
                    // Admin Section - Clear Tables
                    div({ id: 'admin-section', className: 'prefs-content-section', style: { display: 'none' } }, [
                        createElement('h3', { className: 'section-header' }, ['Clear Database Tables']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Use these functions to clear data for testing or alpha release preparation.'
                        ]),
                        
                        div({ style: { maxWidth: '600px' } }, [
                            // Warning banner
                            div({ style: { 
                                padding: '1rem', 
                                backgroundColor: '#fef3c7', 
                                border: '1px solid #fbbf24', 
                                borderRadius: '0.375rem',
                                marginBottom: '1.5rem',
                                fontSize: '0.875rem'
                            } }, [
                                createElement('strong', { style: { display: 'block', marginBottom: '0.5rem', color: '#92400e' } }, [
                                    '⚠️ Warning: Destructive Operations'
                                ]),
                                createElement('p', { style: { margin: 0, color: '#78350f' } }, [
                                    'These actions permanently delete data and cannot be undone. You will be asked to confirm before any data is deleted.'
                                ])
                            ]),
                            
                            // Clear Item Types
                            div({ style: { marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' } }, [
                                createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'Clear Item Types'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                                    `Deletes all item type definitions. Current count: ${state.itemTypes.length} records.`
                                ]),
                                createElement('button', {
                                    className: 'btn btn-danger',
                                    onclick: handleClearItemTypes
                                }, ['Clear Item Types'])
                            ]),
                            
                            // Clear Inventory
                            div({ style: { marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' } }, [
                                createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'Clear Inventory'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                                    `Deletes all inventory records. Current count: ${state.inventory.length} records.`
                                ]),
                                createElement('button', {
                                    className: 'btn btn-danger',
                                    onclick: handleClearInventory
                                }, ['Clear Inventory'])
                            ]),
                            
                            // Clear Transactions
                            div({ style: { marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' } }, [
                                createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'Clear Transactions'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                                    `Deletes all transaction history. Current count: ${state.transactions.length} records.`
                                ]),
                                createElement('button', {
                                    className: 'btn btn-danger',
                                    onclick: handleClearTransactions
                                }, ['Clear Transactions'])
                            ]),
                            
                            // Clear Sequentials
                            div({ style: { marginBottom: '1.5rem', padding: '1.5rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '0.5rem' } }, [
                                createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'Clear Sequentials'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                                    `Deletes all sequential number records. Current count: ${(state.sequentials || []).length} records.`
                                ]),
                                createElement('button', {
                                    className: 'btn btn-danger',
                                    onclick: handleClearSequentials
                                }, ['Clear Sequentials'])
                            ])
                        ])
                    ]),
                    
                    // Config Management Section
                    div({ id: 'config-section', className: 'prefs-content-section', style: { display: 'none' } }, [
                        createElement('h3', { className: 'section-header' }, ['Configuration Management']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Manage system configuration key-value pairs.'
                        ]),
                        
                        div({ style: { maxWidth: '800px' } }, [
                            createElement('table', { className: 'inventory-table', style: { width: '100%' } }, [
                                createElement('thead', {}, [
                                    createElement('tr', {}, [
                                        createElement('th', { style: { width: '30%' } }, ['Key']),
                                        createElement('th', { style: { width: '50%' } }, ['Value']),
                                        createElement('th', { style: { width: '20%', textAlign: 'center' } }, ['Actions'])
                                    ])
                                ]),
                                createElement('tbody', {},
                                    (state.config || []).map(cfg => {
                                        return createElement('tr', {}, [
                                            createElement('td', { style: { fontWeight: '500', fontFamily: 'monospace' } }, [cfg.key]),
                                            createElement('td', { style: { fontFamily: 'monospace', fontSize: '0.875rem', color: '#4b5563' } }, [
                                                cfg.value ? String(cfg.value).substring(0, 100) + (String(cfg.value).length > 100 ? '...' : '') : ''
                                            ]),
                                            createElement('td', { style: { textAlign: 'center' } }, [
                                                createElement('button', {
                                                    className: 'btn btn-sm btn-secondary',
                                                    style: { marginRight: '0.5rem', padding: '0.25rem 0.75rem' },
                                                    onclick: () => handleEditConfigValue(cfg.key, cfg.value)
                                                }, ['Edit']),
                                                createElement('button', {
                                                    className: 'btn btn-sm btn-danger',
                                                    style: { padding: '0.25rem 0.75rem' },
                                                    onclick: () => handleDeleteConfigKey(cfg.key)
                                                }, ['Delete'])
                                            ])
                                        ]);
                                    })
                                )
                            ])
                        ])
                    ]),
                    
                    // User Management Section
                    div({ id: 'users-section', className: 'prefs-content-section', style: { display: 'none' } }, [
                        createElement('h3', { className: 'section-header' }, ['User Management']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Manage user accounts and roles through the Supabase dashboard.'
                        ]),
                        
                        div({ style: { maxWidth: '700px' } }, [
                            // Info box
                            div({ style: { 
                                padding: '1.5rem', 
                                backgroundColor: '#eff6ff', 
                                border: '1px solid #3b82f6', 
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            } }, [
                                createElement('h4', { style: { margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#1e40af' } }, [
                                    '🔐 Security Notice'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#1e3a8a', marginBottom: '1rem' } }, [
                                    'User management requires admin privileges that cannot be safely exposed in the browser. Use the Supabase dashboard to manage users.'
                                ])
                            ]),
                            
                            // Instructions
                            div({ style: { 
                                padding: '1.5rem', 
                                backgroundColor: '#f9fafb', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            } }, [
                                createElement('h4', { style: { margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'How to Manage Users'
                                ]),
                                createElement('ol', { style: { fontSize: '0.875rem', color: '#4b5563', paddingLeft: '1.5rem', margin: 0 } }, [
                                    createElement('li', { style: { marginBottom: '0.75rem' } }, [
                                        createElement('strong', {}, ['Create User:']), ' Dashboard → Authentication → Users → Invite User'
                                    ]),
                                    createElement('li', { style: { marginBottom: '0.75rem' } }, [
                                        createElement('strong', {}, ['Set as Admin:']), ' Use SQL Editor or User Metadata:'
                                    ]),
                                    createElement('li', { style: { marginBottom: '0.75rem' } }, [
                                        createElement('strong', {}, ['Delete User:']), ' Select user → Options (⋮) → Delete User'
                                    ]),
                                    createElement('li', { style: { marginBottom: 0 } }, [
                                        createElement('strong', {}, ['Note:']), ' Users must log out and back in for role changes to take effect.'
                                    ])
                                ])
                            ]),
                            
                            // SQL Code section
                            div({ style: { 
                                padding: '1.5rem', 
                                backgroundColor: '#f9fafb', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            } }, [
                                createElement('h4', { style: { margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    '📝 SQL Code to Set Admin Role'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#4b5563', marginBottom: '1rem' } }, [
                                    'Copy and paste this SQL code into the Supabase SQL Editor (Dashboard → SQL Editor):'
                                ]),
                                createElement('div', { 
                                    style: { 
                                        backgroundColor: '#1e293b', 
                                        color: '#e2e8f0', 
                                        padding: '1rem', 
                                        borderRadius: '0.375rem',
                                        fontFamily: 'monospace',
                                        fontSize: '0.875rem',
                                        overflowX: 'auto',
                                        marginBottom: '1rem'
                                    }
                                }, [
                                    createElement('pre', { style: { margin: 0, whiteSpace: 'pre-wrap' } }, [
                                        '-- Set user as admin\n',
                                        'UPDATE auth.users\n',
                                        'SET raw_user_meta_data = raw_user_meta_data || \'{"user_role": "admin"}\'::jsonb\n',
                                        'WHERE email = \'user@example.com\';\n\n',
                                        '-- Set user as regular user\n',
                                        'UPDATE auth.users\n',
                                        'SET raw_user_meta_data = raw_user_meta_data || \'{"user_role": "user"}\'::jsonb\n',
                                        'WHERE email = \'user@example.com\';\n\n',
                                        '-- Remove user role (set to default)\n',
                                        'UPDATE auth.users\n',
                                        'SET raw_user_meta_data = raw_user_meta_data - \'user_role\'\n',
                                        'WHERE email = \'user@example.com\';'
                                    ])
                                ]),
                                createElement('p', { style: { fontSize: '0.75rem', color: '#6b7280', margin: 0, fontStyle: 'italic' } }, [
                                    '💡 Tip: Replace \'user@example.com\' with the actual user\'s email address'
                                ])
                            ]),
                            
                            // Action button
                            div({ style: { textAlign: 'center' } }, [
                                createElement('button', {
                                    className: 'btn btn-primary btn-lg',
                                    onclick: handleOpenSupabaseDashboard
                                }, ['🔗 Open Supabase Dashboard'])
                            ])
                        ])
                    ]),
                    
                    // Bulk Export Section
                    div({ id: 'export-section', className: 'prefs-content-section', style: { display: 'none' } }, [
                        createElement('h3', { className: 'section-header' }, ['Bulk Database Export']),
                        createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem' } }, [
                            'Export the entire database to Excel format with each table as a separate sheet.'
                        ]),
                        
                        div({ style: { maxWidth: '600px' } }, [
                            div({ style: { 
                                padding: '1.5rem', 
                                backgroundColor: '#f9fafb', 
                                border: '1px solid #e5e7eb', 
                                borderRadius: '0.5rem',
                                marginBottom: '1.5rem'
                            } }, [
                                createElement('h4', { style: { margin: '0 0 1rem 0', fontSize: '1rem', fontWeight: '600', color: '#111827' } }, [
                                    'Export All Tables'
                                ]),
                                createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                                    'This will create an Excel workbook containing all database tables including:'
                                ]),
                                createElement('ul', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1.5rem', paddingLeft: '1.5rem' } }, [
                                    createElement('li', {}, ['Clients, Markets, SLOCs, Crews, Areas']),
                                    createElement('li', {}, ['Item Types, Inventory, Transactions']),
                                    createElement('li', {}, ['Locations, Statuses, Categories']),
                                    createElement('li', {}, ['Configuration and Reference Tables'])
                                ]),
                                createElement('button', {
                                    className: 'btn btn-success',
                                    onclick: handleBulkExport
                                }, ['📥 Export Database to Excel'])
                            ]),
                            
                            div({ style: { 
                                padding: '1rem', 
                                backgroundColor: '#eff6ff', 
                                border: '1px solid #3b82f6', 
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem'
                            } }, [
                                createElement('strong', { style: { display: 'block', marginBottom: '0.5rem', color: '#1e40af' } }, [
                                    'ℹ️ Export Information'
                                ]),
                                createElement('p', { style: { margin: 0, color: '#1e3a8a' } }, [
                                    'The export file will be downloaded to your default downloads folder. Each table will be in its own sheet with all columns and data preserved.'
                                ])
                            ])
                        ])
                    ])
                ] : []))
            ])
        ]);
        
        return content;
    };

// Helper functions (to be implemented in main app)
function loadInventory() {
    console.log('Loading inventory...');
}

function showInventoryDetails(item) {
    Modals.alert(JSON.stringify(item, null, 2), 'Item Details');
}

function editInventoryItem(item) {
}

async function processSerializedReceive() {
    const state = Store.getState();
    const itemTypeId = byId('receive_item_type_id')?.value;
    
    if (!itemTypeId) {
        Components.showToast('Please select an item type', 'warning');
        return;
    }
    
    if (batchEntries.length === 0) {
        Components.showToast('Please add items to receive', 'warning');
        return;
    }
    
    // Use all entries (manufacturer SN is optional)
    const validEntries = batchEntries;
    
    try {
        // Get the receiving status preference
        const receivingStatusPref = state.config.find(c => c.key === 'receivingStatus');
        const receivingStatusName = receivingStatusPref ? receivingStatusPref.value : 'Available';
        
        const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
        if (!receivingStatus) {
            Components.showToast(`Error: ${receivingStatusName} status not found`, 'error');
            return;
        }
        
        // Validate that we have a location (SLOC) selected
        if (!state.selectedSloc) {
            Components.showToast('Please select a SLOC first', 'warning');
            return;
        }
        
        // Get receiving location from preferences
        const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
        const locationId = receivingLocationId ? parseInt(receivingLocationId) : state.selectedSloc.id;
        
        if (!receivingLocationId) {
            console.warn('No receiving location set in preferences, using SLOC as location');
        }
        
        // Prepare inventory records
        const inventoryRecords = validEntries.map(entry => ({
            item_type_id: parseInt(itemTypeId),
            quantity: entry.units,
            tilsonsn: entry.sn,
            mfgrsn: entry.mfgrSn,
            status_id: receivingStatus.id,
            location_id: locationId,  // Use preference or SLOC as fallback
            sloc_id: state.selectedSloc.id,
            assigned_crew_id: null,
            area_id: null
        }));
        
        // Insert all records
        const insertPromises = inventoryRecords.map(record => 
            Queries.insert('inventory', record)
        );
        
        const results = await Promise.all(insertPromises);
        const successCount = results.filter(r => r.isOk).length;
        const failCount = results.length - successCount;
        
        if (successCount > 0) {
            // Update the currentSN in config
            const lastEntry = validEntries[validEntries.length - 1];
            const lastSequence = parseInt(lastEntry.sn.split('-')[1]) || currentSNSequence;
            await Queries.setConfig('currentSN', String(lastSequence));
            
            // Refresh inventory data filtered by selected SLOC
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
            
            // Show success message
            if (failCount === 0) {
                Components.showToast(`Successfully received ${successCount} item(s)`, 'success');
            } else {
                Components.showToast(`Received ${successCount} item(s), ${failCount} failed`, 'warning');
            }
            
            // Reset form but keep accordion open
            resetReceiveForm();
            
            // Re-render only the inventory display section
            const rightColumn = document.querySelector('.right-column');
            if (rightColumn) {
                const state = Store.getState();
                // Filter to serialized items (inventory_type_id === 1) for the selected SLOC
                const serializedInventory = state.inventory.filter(item => {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    return itemType && itemType.inventory_type_id === 1;
                });
                
                // Rebuild hierarchy
                const hierarchicalInventory = {};
                serializedInventory.forEach(item => {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    if (!itemType) return;
                    
                    const category = state.categories.find(c => c.id === itemType.category_id);
                    const categoryName = category ? category.name : 'Uncategorized';
                    
                    if (!hierarchicalInventory[categoryName]) {
                        hierarchicalInventory[categoryName] = {};
                    }
                    
                    if (!hierarchicalInventory[categoryName][itemType.name]) {
                        hierarchicalInventory[categoryName][itemType.name] = [];
                    }
                    
                    hierarchicalInventory[categoryName][itemType.name].push(item);
                });
                
                // Build and update inventory display
                rightColumn.innerHTML = '';
                rightColumn.appendChild(createElement('h2', { className: 'section-header' }, ['Serialized Inventory']));
                rightColumn.appendChild(buildHierarchyFromData(hierarchicalInventory, state));
            }
        } else {
            Components.showToast('Failed to receive items. Please try again.', 'error');
        }
        
    } catch (error) {
        console.error('Error receiving items:', error);
        Components.showToast('An error occurred while receiving items', 'error');
    }
}

function processSerializedIssue() {
    Components.showToast('Serialized issue functionality coming soon', 'info');
}

// Issue process state
let isSelectingForIssue = false;
let selectedItemsForIssue = [];

// Start issue process
function startIssueProcess() {
    const state = Store.getState();
    
    if (!state.selectedMarket || !state.selectedSloc) {
        Components.showToast('Please select a Market and SLOC first', 'warning');
        return;
    }
    
    isSelectingForIssue = true;
    selectedItemsForIssue = [];
    
    // Toggle UI states
    const initialState = byId('issue-initial-state');
    const selectionState = byId('issue-selection-state');
    
    if (initialState) initialState.style.display = 'none';
    if (selectionState) selectionState.style.display = 'block';
    
    // Populate crew and area dropdowns
    const selectorsDiv = byId('issue-crew-area-selectors');
    if (selectorsDiv) {
        selectorsDiv.innerHTML = '';
        
        // Get crews for selected market and areas for selected SLOC
        const marketCrews = (state.crews || []).filter(c => c.market_id === state.selectedMarket.id);
        const slocAreas = (state.areas || []).filter(a => a.sloc_id === state.selectedSloc.id);
        
        // Crew dropdown
        selectorsDiv.appendChild(Components.formField({
            type: 'select',
            id: 'issue-crew',
            name: 'issue_crew',
            label: 'Crew',
            required: true,
            options: [
                { value: '', text: '-- Select Crew --' },
                ...marketCrews.map(c => ({ value: c.id, text: c.name }))
            ],
            onchange: () => validateIssueForm()
        }));
        
        // Area dropdown
        selectorsDiv.appendChild(Components.formField({
            type: 'select',
            id: 'issue-area',
            name: 'issue_area',
            label: 'Area',
            required: true,
            options: [
                { value: '', text: '-- Select Area --' },
                ...slocAreas.map(a => ({ value: a.id, text: a.name }))
            ],
            onchange: () => validateIssueForm()
        }));
    }
    
    // Add visual indicator to inventory section
    const rightColumn = document.querySelector('.right-column');
    if (rightColumn) {
        rightColumn.classList.add('selection-mode');
    }
    
    // Re-render inventory with selection enabled
    refreshInventoryDisplay();
    
    Components.showToast('Select crew, area, and click items in the inventory list', 'info');
}

// Cancel issue process
function cancelIssueProcess(showMessage = true) {
    isSelectingForIssue = false;
    selectedItemsForIssue = [];
    
    // Toggle UI states
    const initialState = byId('issue-initial-state');
    const selectionState = byId('issue-selection-state');
    
    if (initialState) initialState.style.display = 'block';
    if (selectionState) selectionState.style.display = 'none';
    
    // Clear crew/area selectors
    const selectorsDiv = byId('issue-crew-area-selectors');
    if (selectorsDiv) selectorsDiv.innerHTML = '';
    
    // Remove visual indicator from inventory section
    const rightColumn = document.querySelector('.right-column');
    if (rightColumn) {
        rightColumn.classList.remove('selection-mode');
    }
    
    // Re-render inventory without selection
    refreshInventoryDisplay();
    
    if (showMessage) {
        Components.showToast('Issue process cancelled', 'info');
    }
}

// Validate issue form and enable/disable Complete button
function validateIssueForm() {
    const crewSelect = byId('issue-crew');
    const areaSelect = byId('issue-area');
    const completeBtn = byId('complete-issue-btn');
    
    if (!completeBtn) return;
    
    const hasCrewSelected = crewSelect && crewSelect.value !== '';
    const hasAreaSelected = areaSelect && areaSelect.value !== '';
    const hasItemsSelected = selectedItemsForIssue.length > 0;
    
    const isValid = hasCrewSelected && hasAreaSelected && hasItemsSelected;
    completeBtn.disabled = !isValid;
}

// Toggle item selection
function toggleItemSelection(item) {
    const index = selectedItemsForIssue.findIndex(i => i.id === item.id);
    
    if (index >= 0) {
        // Remove from selection
        selectedItemsForIssue.splice(index, 1);
    } else {
        // Add to selection
        selectedItemsForIssue.push(item);
    }
    
    // Update selected items list display
    updateSelectedItemsList();
    
    // Validate form to enable/disable Complete button
    validateIssueForm();
    
    // Re-render inventory to update visual state
    refreshInventoryDisplay();
}

// Update the selected items list display
function updateSelectedItemsList() {
    const listContainer = byId('selected-items-list');
    if (!listContainer) return;
    
    if (selectedItemsForIssue.length === 0) {
        listContainer.innerHTML = '';
        listContainer.appendChild(
            createElement('p', { style: { color: '#6b7280', fontSize: '0.875rem', margin: 0 } }, 
                ['No items selected'])
        );
        return;
    }
    
    const state = Store.getState();
    listContainer.innerHTML = '';
    
    const list = createElement('ul', { style: { 
        listStyle: 'none', 
        padding: 0, 
        margin: 0 
    } }, 
        selectedItemsForIssue.map(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            return createElement('li', { 
                style: { 
                    padding: '0.5rem',
                    marginBottom: '0.25rem',
                    backgroundColor: '#e0f2fe',
                    borderRadius: '0.25rem',
                    fontSize: '0.875rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                } 
            }, [
                createElement('span', {}, [
                    `${itemType ? itemType.name : 'Unknown'} - SN: ${item.tilsonsn || item.mfgrsn || 'N/A'}`
                ]),
                createElement('button', {
                    style: {
                        background: 'none',
                        border: 'none',
                        color: '#dc2626',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        padding: '0 0.25rem'
                    },
                    onclick: (e) => {
                        e.stopPropagation();
                        toggleItemSelection(item);
                    }
                }, ['×'])
            ]);
        })
    );
    
    listContainer.appendChild(list);
}

// Complete issue process
async function completeIssueProcess() {
    if (selectedItemsForIssue.length === 0) {
        Components.showToast('Please select at least one item to issue', 'warning');
        return;
    }
    
    const state = Store.getState();
    
    // Get the Issue action from database
    const issueAction = state.actionTypes.find(a => a.name === 'Issue');
    
    if (!issueAction) {
        Components.showToast('Issue action not found in system', 'error');
        return;
    }
    
    // Get selected crew and area from the form
    const crewSelect = byId('issue-crew');
    const areaSelect = byId('issue-area');
    
    const selectedCrewId = crewSelect ? parseInt(crewSelect.value) : null;
    const selectedAreaId = areaSelect ? parseInt(areaSelect.value) : null;
    
    const preselectedCrew = selectedCrewId ? state.crews.find(c => c.id === selectedCrewId) : null;
    const preselectedArea = selectedAreaId ? state.areas.find(a => a.id === selectedAreaId) : null;
    
    // Show the standard Issue modal with selected items and preselected crew/area
    // requireSelections: false because we already have crew/area selected
    showIssueActionModal(selectedItemsForIssue, issueAction, { 
        requireSelections: false,
        preselectedCrew: preselectedCrew,
        preselectedArea: preselectedArea,
        sourceView: 'serialized'
    });
}

// Refresh inventory display
function refreshInventoryDisplay() {
    const rightColumn = document.querySelector('.right-column');
    if (!rightColumn) return;
    
    const state = Store.getState();
    let serializedInventory = state.inventory.filter(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        return itemType && itemType.inventory_type_id === 1;
    });
    
    // If in issue selection mode, filter to only Available status
    if (isSelectingForIssue) {
        const availableStatus = state.statuses.find(s => s.name === 'Available');
        if (availableStatus) {
            serializedInventory = serializedInventory.filter(item => item.status_id === availableStatus.id);
        }
    }
    
    // Rebuild hierarchy
    const hierarchicalInventory = {};
    serializedInventory.forEach(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        if (!itemType) return;
        
        const category = state.categories.find(c => c.id === itemType.category_id);
        const categoryName = category ? category.name : 'Uncategorized';
        
        if (!hierarchicalInventory[categoryName]) {
            hierarchicalInventory[categoryName] = {};
        }
        
        if (!hierarchicalInventory[categoryName][itemType.name]) {
            hierarchicalInventory[categoryName][itemType.name] = [];
        }
        
        hierarchicalInventory[categoryName][itemType.name].push(item);
    });
    
    // Build and update inventory display
    rightColumn.innerHTML = '';
    rightColumn.appendChild(createElement('h2', { className: 'section-header' }, ['Serialized Inventory']));
    rightColumn.appendChild(buildHierarchyFromData(hierarchicalInventory, state));
}

// Batch entry state
let batchEntries = [];
let currentSNSequence = 0;
let isManualEntryMode = false;

// Handle item type selection change
async function handleItemTypeChange(itemTypeId) {
    const state = Store.getState();
    const noteContainer = byId('units-per-package-note');
    const batchCountInput = byId('batch_count');
    
    if (!itemTypeId) {
        noteContainer.style.display = 'none';
        batchCountInput.value = '';
        batchCountInput.disabled = false;
        isManualEntryMode = false;
        clearBatchTable();
        return;
    }
    
    const itemType = state.itemTypes.find(it => it.id === parseInt(itemTypeId));
    if (!itemType) return;
    
    // Display units per package note
    noteContainer.innerHTML = `${itemType.units_per_package} / Item`;
    noteContainer.className = 'units-per-package-note';
    noteContainer.style.display = 'block';
    
    // Get current SN sequence from config
    const configResult = await Queries.getConfig('currentSN');
    if (configResult.isOk) {
        currentSNSequence = parseInt(configResult.value) || 0;
    } else {
        currentSNSequence = 0;
    }
    
    // Initialize with one empty row for manual entry
    batchEntries = [{
        sn: generateSN(currentSNSequence + 1),
        mfgrSn: '',
        units: itemType.units_per_package
    }];
    batchCountInput.value = '';
    batchCountInput.disabled = false;
    isManualEntryMode = false;
    renderBatchTable();
}

// Build hierarchical display from data
// Update status color in localStorage and refresh display
function updateStatusColor(statusName, colorType, value) {
    const savedColors = JSON.parse(localStorage.getItem('statusColors') || '{}');
    
    if (!savedColors[statusName]) {
        savedColors[statusName] = { background: '#ffffff', text: '#000000' };
    }
    
    savedColors[statusName][colorType] = value;
    localStorage.setItem('statusColors', JSON.stringify(savedColors));
    
    // Refresh the preview without resetting the active section
    // Store the currently active section before re-rendering
    const activeSection = document.querySelector('.prefs-content-section[style*="display: block"]');
    const activeSectionId = activeSection ? activeSection.id : 'receiving-section';
    
    Views.render('preferences');
    
    // Restore the active section after re-render
    setTimeout(() => {
        const sections = ['receiving-section', 'display-section'];
        sections.forEach(id => {
            const section = byId(id);
            if (section) section.style.display = id === activeSectionId ? 'block' : 'none';
        });
        
        // Update nav item active state
        const navItems = document.querySelectorAll('.prefs-nav-item');
        navItems.forEach(item => {
            if (item.getAttribute('data-section') === activeSectionId) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
    }, 0);
    
    Components.showToast(`${statusName} ${colorType} color updated`, 'success');
}

// Show consolidated items modal (when multiple items are aggregated)
function showConsolidatedItemsModal(row) {
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
                                        showInventoryActionsModal(item);
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
}

// Show inventory actions modal
async function showInventoryActionsModal(item) {
    const state = Store.getState();
    
    // Get item details
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const inventoryType = state.inventoryTypes?.find(it => it.id === itemType?.inventory_type_id);
    const isSerialized = inventoryType?.name?.toLowerCase() === 'serialized';
    const status = state.statuses.find(s => s.id === item.status_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
    const area = item.area_id ? (state.areas || []).find(a => a.id === item.area_id) : null;
    
    // Get latest sequential if item is serialized
    let latestSequential = null;
    if (isSerialized) {
        const sequentialResult = await Queries.getLatestSequential(item.id);
        if (sequentialResult.isOk) {
            latestSequential = sequentialResult.value;
        }
    }
    
    // Get available actions for this status from local state
    const availableActionsResult = InventoryActions.getAvailableActions(item.status_id);
    const availableActions = availableActionsResult.isOk ? availableActionsResult.value : [];
    
    // Build item details grid items
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
    
    // Add sequential field if serialized
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
                        onclick: () => showSetSequentialPrompt(item)
                    }, ['Set'])
            ])
        );
    }
    
    // Build modal content
    const modalContent = div({}, [
        // Item details section
        div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
            createElement('h3', { style: { margin: '0 0 0.75rem 0', fontSize: '1rem', fontWeight: '600' } }, ['Item Details']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, detailsItems)
        ]),
        
        // Available actions section
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
                            handleInventoryAction(item, action);
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
}

// Show prompt to set sequential number
function showSetSequentialPrompt(item) {
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
                return false; // Prevent modal from closing
            }
            
            // Save sequential to database
            const result = await Queries.createSequential({
                inventory_id: item.id,
                sequential_number: sequentialNumber,
                notes: notes
            });
            
            if (result.isOk) {
                Components.showToast('Sequential number saved', 'success');
                // Reopen the inventory actions modal to show the updated sequential
                setTimeout(() => showInventoryActionsModal(item), 300);
                return true; // Allow modal to close
            } else {
                Components.showToast('Failed to save sequential number', 'error');
                return false; // Prevent modal from closing
            }
        }
    });
    
    // Focus the input after a brief delay
    setTimeout(() => {
        const input = byId('sequential-input');
        if (input) input.focus();
    }, 100);
}

// Handle inventory action selection
function handleInventoryAction(item, action) {
    console.log('Action selected:', action.name, 'for item:', item.id);
    console.log('Action object:', action);
    
    // Route to appropriate action handler based on action.name
    if (action.name === 'Issue') {
        console.log('Routing to Issue action modal');
        // Wait for first modal to close before opening second modal
        setTimeout(() => {
            console.log('Calling showIssueActionModal with item:', item);
            showIssueActionModal([item], action, { requireSelections: true });
        }, 100);
    } else if (action.name === 'Return Material') {
        console.log('Routing to Return Material action modal');
        setTimeout(() => {
            showReturnMaterialModal([item], action);
        }, 100);
    } else if (action.name === 'Field Install') {
        console.log('Routing to Field Install action modal');
        setTimeout(() => {
            showFieldInstallModal([item], action);
        }, 100);
    } else if (action.name === 'Adjust') {
        console.log('Routing to Adjust action modal');
        setTimeout(() => {
            showAdjustModal([item], action);
        }, 100);
    } else if (action.name === 'Reject') {
        console.log('Routing to Reject action modal');
        setTimeout(() => {
            showRejectModal([item], action);
        }, 100);
    } else if (action.name === 'Inspect') {
        console.log('Routing to Inspect action modal');
        setTimeout(() => {
            showInspectModal([item], action);
        }, 100);
    } else if (action.name === 'Remove') {
        console.log('Routing to Remove action modal');
        setTimeout(() => {
            showRemoveModal([item], action);
        }, 100);
    } else {
        Components.showToast(`Action "${action.name}" selected. Implementation pending.`, 'info');
    }
}

// Show Issue Action Modal (single or bulk)
function showIssueActionModal(items, action, options = {}) {
    console.log('=== showIssueActionModal called ===');
    console.log('Items:', items);
    console.log('Action:', action);
    console.log('Options:', options);
    
    const state = Store.getState();
    const { requireSelections = false, preselectedCrew = null, preselectedArea = null, sourceView = null } = options;
    
    // Determine source view if not provided
    const detectedSourceView = sourceView || (() => {
        // Check what view is currently active
        if (document.querySelector('.hierarchy-container')) return 'serialized';
        if (byId('bulk-items-table-container')) return 'bulk';
        return state.currentView; // fallback to state
    })();
    
    console.log('📍 Source view detected:', detectedSourceView);
    
    // Check if this is a single bulk item (not serialized, not from bulk issue section)
    const isSingleBulkItem = items.length === 1 && (() => {
        const item = items[0];
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        return itemType && itemType.inventory_type_id === 2; // Bulk inventory type
    })();
    
    // Store for quantity adjustments
    let issueQuantities = {};
    if (isSingleBulkItem) {
        issueQuantities[items[0].id] = items[0].quantity;
    }
    
    // Calculate total quantity
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    let selectedCrew = preselectedCrew;
    let selectedArea = preselectedArea;
    let signaturePad = null;
    let signatureCanvas = null;
    
    // Build items table
    const itemsTableHtml = createElement('table', { className: 'inventory-table', style: { marginBottom: '1rem' } }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', {}, ['Item Type']),
                createElement('th', {}, ['Serial/ID']),
                createElement('th', {}, ['Quantity']),
                createElement('th', {}, ['Status'])
            ])
        ]),
        createElement('tbody', {},
            items.map(item => {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                const status = state.statuses.find(s => s.id === item.status_id);
                const serialId = item.tilsonsn || item.mfgrsn || '-';
                
                // Create quantity cell - editable for single bulk items
                let quantityCell;
                if (isSingleBulkItem) {
                    const qtyInput = createElement('input', {
                        type: 'text',
                        id: 'issue-quantity-input',
                        className: 'form-control',
                        value: String(item.quantity),
                        style: { width: '80px', textAlign: 'center' },
                        maxlength: 9,
                        oninput: (e) => {
                            // Only allow digits
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            const val = parseInt(e.target.value) || 0;
                            if (val > item.quantity) {
                                e.target.value = String(item.quantity);
                            }
                            issueQuantities[item.id] = parseInt(e.target.value) || 0;
                        }
                    });
                    quantityCell = createElement('td', {}, [qtyInput]);
                } else {
                    quantityCell = createElement('td', {}, [String(item.quantity || 1)]);
                }
                
                return createElement('tr', {}, [
                    createElement('td', {}, [itemType?.name || 'Unknown']),
                    createElement('td', {}, [serialId]),
                    quantityCell,
                    createElement('td', {}, [status?.name || 'Unknown'])
                ]);
            })
        )
    ]);
    
    // Build crew/area selection section if needed
    let selectionSection = null;
    if (requireSelections) {
        // Filter crews by selected market (crews have market_id directly)
        let filteredCrews = state.crews || [];
        if (state.selectedMarket) {
            filteredCrews = filteredCrews.filter(c => c.market_id === state.selectedMarket.id);
            console.log('Filtered crews for market', state.selectedMarket.name, ':', filteredCrews);
        }
        
        // Filter areas by selected SLOC
        let filteredAreas = state.areas || [];
        if (state.selectedSloc) {
            filteredAreas = filteredAreas.filter(a => a.sloc_id === state.selectedSloc.id);
        }
        
        selectionSection = div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 1rem 0' } }, ['Assign To:']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' } }, [
                div({}, [
                    createElement('label', { style: { display: 'block', marginBottom: '0.5rem', fontWeight: '500' } }, ['Crew:']),
                    createElement('select', {
                        id: 'issue-crew-select',
                        className: 'form-control',
                        style: { fontSize: '18px', padding: '8px', width: '100%' },
                        onchange: (e) => { selectedCrew = filteredCrews.find(c => c.id === parseInt(e.target.value)); }
                    }, [
                        createElement('option', { value: '' }, ['-- Select Crew --']),
                        ...filteredCrews.map(crew => 
                            createElement('option', { value: crew.id }, [crew.name])
                        )
                    ])
                ]),
                div({}, [
                    createElement('label', { style: { display: 'block', marginBottom: '0.5rem', fontWeight: '500' } }, ['Area:']),
                    createElement('select', {
                        id: 'issue-area-select',
                        className: 'form-control',
                        style: { fontSize: '18px', padding: '8px', width: '100%' },
                        onchange: (e) => { selectedArea = filteredAreas.find(a => a.id === parseInt(e.target.value)); }
                    }, [
                        createElement('option', { value: '' }, ['-- Select Area --']),
                        ...filteredAreas.map(area => 
                            createElement('option', { value: area.id }, [area.name])
                        )
                    ])
                ])
            ])
        ]);
    }
    
    // Build signature section if action allows PDF
    let signatureSection = null;
    if (action.allow_pdf) {
        signatureSection = div({ style: { marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Signature (Optional):']),
            createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                'Sign below to include signature on receipt'
            ]),
            createElement('div', { style: { border: '2px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff' } }, [
                signatureCanvas = createElement('canvas', {
                    id: 'signature-canvas',
                    style: { display: 'block', width: '100%', height: '150px', touchAction: 'none' }
                })
            ]),
            div({ style: { marginTop: '0.5rem', display: 'flex', gap: '0.5rem' } }, [
                button('Clear Signature', {
                    className: 'btn btn-secondary',
                    style: { fontSize: '0.875rem' },
                    onclick: () => { if (signaturePad) signaturePad.clear(); }
                })
            ])
        ]);
    }
    
    // Summary section
    const summarySection = div({ style: { marginTop: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Issue Summary:']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            div({}, [createElement('strong', {}, ['Total Items:']), ` ${items.length}`]),
            div({}, [createElement('strong', {}, ['Total Quantity:']), ` ${totalQuantity}`]),
            preselectedCrew ? div({}, [createElement('strong', {}, ['Crew:']), ` ${preselectedCrew.name}`]) : null,
            preselectedArea ? div({}, [createElement('strong', {}, ['Area:']), ` ${preselectedArea.name}`]) : null
        ].filter(Boolean))
    ]);
    
    // Build modal content
    const modalContent = [
        selectionSection,
        itemsTableHtml,
        summarySection,
        signatureSection
    ].filter(Boolean);
    
    // Modal actions
    const actions = [
        {
            label: 'Complete Issue',
            type: 'primary',
            handler: async () => {
                if (requireSelections && (!selectedCrew || !selectedArea)) {
                    Components.showToast('Please select both Crew and Area', 'error');
                    return;
                }
                
                // Pass issue quantities if this is a single bulk item
                const options = { 
                    crew: selectedCrew, 
                    area: selectedArea,
                    sourceView: detectedSourceView 
                };
                if (isSingleBulkItem) {
                    options.issueQuantities = issueQuantities;
                }
                
                await executeIssueAction(items, options, action);
                
                // Auto-generate PDF if signature is present
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                    await generateIssuePDF(items, { crew: selectedCrew, area: selectedArea }, signaturePad);
                }
                
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    // Show modal
    console.log('About to call Modals.create with title:', 'Issue Inventory');
    console.log('Modal content:', modalContent);
    console.log('Modal actions:', actions);
    
    const modal = Modals.create({
        title: 'Issue Inventory',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    console.log('Modals.create called successfully, now calling Modals.show');
    Modals.show(modal);
    console.log('Modals.show called successfully');
    
    // Focus and select quantity input for single bulk items
    if (isSingleBulkItem) {
        setTimeout(() => {
            const qtyInput = byId('issue-quantity-input');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        }, 150);
    }
    
    // Initialize signature pad if present
    if (signatureCanvas && action.allow_pdf) {
        setTimeout(() => {
            // Function to properly resize canvas
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = signatureCanvas.getBoundingClientRect();
                
                signatureCanvas.width = rect.width * ratio;
                signatureCanvas.height = rect.height * ratio;
                signatureCanvas.getContext('2d').scale(ratio, ratio);
            }
            
            resizeCanvas();
            
            signaturePad = new SignaturePad(signatureCanvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 0)'
            });
        }, 200);
    }
}

// Show Receive Action Modal (unified receive function for all entry points)
function showReceiveActionModal(items, options = {}) {
    console.log('=== showReceiveActionModal called ===');
    console.log('Items:', items);
    console.log('Options:', options);
    
    const state = Store.getState();
    const { sourceView = null } = options;
    
    // Determine source view if not provided
    const detectedSourceView = sourceView || (() => {
        if (document.querySelector('.hierarchy-container')) return 'serialized';
        if (byId('bulk-items-table-container')) return 'bulk';
        return state.currentView;
    })();
    
    console.log('📍 Source view detected:', detectedSourceView);
    
    // Get receiving status from preferences
    const receivingStatusName = (state.config || []).find(c => c.key === 'receivingStatus')?.value || 'Available';
    const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
    
    if (!receivingStatus) {
        Components.showToast('Receiving status not found in preferences', 'error');
        return;
    }
    
    // Get receiving location from preferences
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return;
    }
    
    // Calculate total quantity
    const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    
    // Build items table
    const itemsTableHtml = createElement('table', { className: 'inventory-table', style: { marginBottom: '1rem' } }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', {}, ['Item Type']),
                createElement('th', {}, ['Quantity'])
            ])
        ]),
        createElement('tbody', {},
            items.map(item => {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                return createElement('tr', {}, [
                    createElement('td', {}, [itemType?.name || item.item_type_name || 'Unknown']),
                    createElement('td', {}, [String(item.quantity || 1)])
                ]);
            })
        )
    ]);
    
    // Summary section
    const summarySection = div({ style: { marginTop: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Receive Summary:']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            div({}, [createElement('strong', {}, ['Total Items:']), ` ${items.length}`]),
            div({}, [createElement('strong', {}, ['Total Quantity:']), ` ${totalQuantity}`]),
            div({}, [createElement('strong', {}, ['Receiving Location:']), ` ${receivingLocation.name}`]),
            div({}, [createElement('strong', {}, ['Status:']), ` ${receivingStatus.name}`])
        ])
    ]);
    
    // Build modal content
    const modalContent = [
        itemsTableHtml,
        summarySection
    ];
    
    // Modal actions
    const actions = [
        {
            label: 'Complete Receive',
            type: 'primary',
            handler: async () => {
                await executeReceiveAction(items, { sourceView: detectedSourceView });
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => {
                Modals.close();
            }
        }
    ];
    
    // Show modal
    const modal = Modals.create({
        title: 'Receive Inventory',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
}

// Execute Receive Action (unified receive execution for all entry points)
async function executeReceiveAction(items, options = {}) {
    const state = Store.getState();
    const { sourceView } = options;
    
    console.log('📍 [executeReceiveAction] Source view:', sourceView);
    
    // Get receiving status from preferences
    const receivingStatusName = (state.config || []).find(c => c.key === 'receivingStatus')?.value || 'Available';
    const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
    
    if (!receivingStatus) {
        Components.showToast('Receiving status not found', 'error');
        return;
    }
    
    // Get receiving location from preferences
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return;
    }
    
    try {
        console.log('📦 [executeReceiveAction] Receiving', items.length, 'items to', receivingLocation.name);
        Components.showToast(`Receiving ${items.length} item(s)...`, 'info');
        
        // Process each item
        const results = [];
        for (const item of items) {
            console.log('📦 [executeReceiveAction] Processing item:', {
                item_type_id: item.item_type_id,
                item_type_name: item.item_type_name,
                quantity: item.quantity
            });
            
            const inventoryData = {
                location_id: receivingLocation.id,
                assigned_crew_id: null,
                area_id: null,
                item_type_id: item.item_type_id,
                quantity: item.quantity,
                status_id: receivingStatus.id,
                sloc_id: state.selectedSloc.id
            };
            
            console.log('📦 [executeReceiveAction] Calling upsertBulkInventory with:', inventoryData);
            const result = await Queries.upsertBulkInventory(inventoryData, 'add');
            console.log('📦 [executeReceiveAction] Upsert result:', result);
            
            if (result.isOk) {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                await Queries.createTransaction({
                    inventory_id: result.value.inventory_id,
                    transaction_type: 'Receive',
                    action: 'Receive from Vendor',
                    item_type_name: itemType?.name || item.item_type_name || 'Unknown',
                    quantity: item.quantity,
                    to_location_name: receivingLocation.name,
                    status_name: receivingStatus.name,
                    notes: `Received: ${result.value.operation === 'created' ? 'New record' : 'Updated existing'}`,
                    after_state: JSON.stringify(inventoryData)
                });
                
                console.log('✅ [executeReceiveAction] Successfully received:', item.item_type_name);
                results.push({ success: true, ...result.value });
            } else {
                console.error('❌ [executeReceiveAction] Failed to receive:', item.item_type_name, 'Error:', result.error);
                results.push({ success: false, error: result.error });
            }
        }
        
        // Refresh inventory from database
        console.log('🔄 [executeReceiveAction] About to refresh inventory for SLOC:', state.selectedSloc?.id);
        if (state.selectedSloc) {
            // First, consolidate any duplicate records
            console.log('🔀 [executeReceiveAction] Running auto-consolidation...');
            const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
            if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                console.log(`✅ [executeReceiveAction] Consolidated ${consolidationResult.value.consolidated} groups, deleted ${consolidationResult.value.deleted} duplicate records`);
            }
            
            // Then re-query inventory
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            console.log('🔄 [executeReceiveAction] Inventory query result:', inventoryResult.isOk ? `Success (${inventoryResult.value.length} items)` : `Failed: ${inventoryResult.error}`);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
                console.log('✅ [executeReceiveAction] State updated with', inventoryResult.value.length, 'inventory items');
            } else {
                console.error('Failed to get inventory:', inventoryResult.error);
                Components.showToast('Error refreshing inventory', 'error');
                return;
            }
        } else {
            console.warn('No selectedSloc, cannot refresh inventory');
        }
        
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        if (failCount === 0) {
            Components.showToast(`Successfully received ${successCount} item(s)`, 'success');
        } else {
            Components.showToast(`Received ${successCount} item(s), ${failCount} failed`, 'warning');
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        // Refresh the display based on source view
        console.log('🎨 [executeReceiveAction] Refreshing display for source view:', sourceView);
        
        if (sourceView === 'serialized' || sourceView === 'receive-serialized') {
            refreshInventoryDisplay();
        } else if (sourceView === 'bulk' || sourceView === 'receive-bulk') {
            // Re-render the receive-bulk view to refresh the table and reset the form
            Views.render('receive-bulk');
        } else {
            console.log('⚠️ [executeReceiveAction] Unknown source view, re-rendering:', state.currentView);
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing receive action:', error);
        Components.showToast('Error receiving items', 'error');
    }
}

// Execute Issue Action
async function executeIssueAction(items, assignments, action) {
    const state = Store.getState();
    const { crew, area, issueQuantities, sourceView } = assignments;
    
    console.log('📍 [executeIssueAction] Source view:', sourceView);
    
    try {
        // Process each item
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const isBulkItem = itemType && itemType.inventory_type_id === 2;
            const issueQty = issueQuantities ? issueQuantities[item.id] : item.quantity;
            const isPartialIssue = isBulkItem && issueQty < item.quantity;
            
            if (isPartialIssue) {
                // Partial issue: reduce original quantity and create new issued record
                const remainingQty = item.quantity - issueQty;
                
                // Update original record with reduced quantity
                await Database.update('inventory', item.id, {
                    quantity: remainingQty
                });
                
                // Get 'With Crew' location
                const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
                
                // Create new record with issued quantity, crew, and area at 'With Crew' location
                const issuedStatus = state.statuses.find(s => s.name === 'Issued');
                const newInventory = {
                    location_id: withCrewLocation?.id || item.location_id,
                    assigned_crew_id: crew?.id,
                    area_id: area?.id,
                    item_type_id: item.item_type_id,
                    quantity: issueQty,
                    status_id: issuedStatus?.id || item.status_id,
                    sloc_id: item.sloc_id
                };
                
                const insertResult = await Database.insert('inventory', newInventory);
                
                // Create transaction for the issued portion
                await Queries.createTransaction({
                    inventory_id: insertResult.isOk ? insertResult.value[0].id : null,
                    transaction_type: 'Issue',
                    action: action.name,
                    quantity: issueQty,
                    status_name: 'Issued',
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    notes: `Partial issue (${issueQty} of ${item.quantity}) to ${crew?.name || 'Crew'} - ${area?.name || 'Area'}`,
                    user_name: state.user?.email || 'system'
                });
            } else {
                // Full issue: update existing record with 'With Crew' location
                const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
                const updates = {
                    location_id: withCrewLocation?.id || item.location_id,
                    assigned_crew_id: crew?.id || item.assigned_crew_id,
                    area_id: area?.id || item.area_id,
                    status_id: state.statuses.find(s => s.name === 'Issued')?.id || item.status_id
                };
                
                await Database.update('inventory', item.id, updates);
                
                // Create transaction record
                await Queries.createTransaction({
                    inventory_id: item.id,
                    transaction_type: 'Issue',
                    action: action.name,
                    quantity: item.quantity || 1,
                    status_name: 'Issued',
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    notes: `Issued to ${crew?.name || 'Crew'} - ${area?.name || 'Area'}`,
                    user_name: state.user?.email || 'system'
                });
            }
        }
        
        // Refresh inventory from database (inventory is not cached, must be re-queried)
        console.log('🔄 [executeIssueAction] About to refresh inventory for SLOC:', state.selectedSloc?.id);
        if (state.selectedSloc) {
            // First, consolidate any duplicate records
            console.log('🔀 [executeIssueAction] Running auto-consolidation...');
            const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
            if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                console.log(`✅ [executeIssueAction] Consolidated ${consolidationResult.value.consolidated} groups, deleted ${consolidationResult.value.deleted} duplicate records`);
            }
            
            // Then re-query inventory
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            console.log('🔄 [executeIssueAction] Inventory query result:', inventoryResult.isOk ? `Success (${inventoryResult.value.length} items)` : `Failed: ${inventoryResult.error}`);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
                console.log('✅ [executeIssueAction] State updated with', inventoryResult.value.length, 'inventory items');
            } else {
                console.error('Failed to get inventory:', inventoryResult.error);
                Components.showToast('Error refreshing inventory', 'error');
                return;
            }
        } else {
            console.warn('No selectedSloc, cannot refresh inventory');
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Issued ${items.length} item(s) successfully`, 'success');
        
        // Refresh the display based on source view
        console.log('🎨 [executeIssueAction] Refreshing display for source view:', sourceView);
        
        if (sourceView === 'serialized' || sourceView === 'receive-serialized') {
            // Serialized inventory view - refresh hierarchy
            console.log('✅ [executeIssueAction] Refreshing serialized inventory display');
            
            // Reset the issue form if we're in the serialized view
            if (isSelectingForIssue) {
                cancelIssueProcess(false); // false = don't show "cancelled" message
            } else {
                refreshInventoryDisplay();
            }
        } else if (sourceView === 'bulk' || sourceView === 'receive-bulk') {
            // Bulk inventory view - rebuild table
            console.log('✅ [executeIssueAction] Refreshing bulk inventory table');
            const bulkTableContainer = byId('bulk-items-table-container');
            if (bulkTableContainer) {
                const freshState = Store.getState();
                let bulkItemTypes = freshState.itemTypes.filter(it => it.inventory_type_id === 2);
                
                // Filter by market if selected
                if (freshState.selectedMarket && freshState.itemTypeMarkets) {
                    const marketItemTypeIds = freshState.itemTypeMarkets
                        .filter(itm => itm.market_id === freshState.selectedMarket.id)
                        .map(itm => itm.item_type_id);
                    bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
                }
                
                const tableData = buildBulkTableData(bulkItemTypes, freshState);
                bulkTableContainer.innerHTML = '';
                bulkTableContainer.appendChild(renderBulkItemsTable(tableData, false, false));
                console.log('✅ [executeIssueAction] Bulk table refreshed');
            } else {
                console.warn('⚠️ [executeIssueAction] Could not find bulk table container');
            }
        } else {
            // Unknown view - re-render current view
            console.log('⚠️ [executeIssueAction] Unknown source view, re-rendering:', state.currentView);
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing issue action:', error);
        Components.showToast('Error issuing items', 'error');
    }
}

// Show Return Material Modal
function showReturnMaterialModal(items, action) {
    const state = Store.getState();
    
    // Determine source view
    const sourceView = (() => {
        if (document.querySelector('.hierarchy-container')) return 'serialized';
        if (byId('bulk-items-table-container')) return 'bulk';
        return state.currentView;
    })();
    
    // Check if this is a single bulk item
    const isSingleBulkItem = items.length === 1 && (() => {
        const item = items[0];
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        return itemType && itemType.inventory_type_id === 2;
    })();
    
    // Store for quantity adjustments
    let returnQuantities = {};
    if (isSingleBulkItem) {
        returnQuantities[items[0].id] = items[0].quantity;
    }
    
    // Signature pad variables
    let signaturePad = null;
    let signatureCanvas = null;
    
    // Get receiving location from preferences
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return;
    }
    
    // Build table header based on item type
    const tableHeaders = [
        createElement('th', {}, ['Item']),
        createElement('th', {}, ['Current Location']),
        createElement('th', {}, ['Crew']),
        createElement('th', {}, ['Area'])
    ];
    
    if (isSingleBulkItem) {
        tableHeaders.push(createElement('th', {}, ['Quantity']));
    }
    
    // Build items table rows
    const tableRows = items.map(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const crew = state.crews.find(c => c.id === item.assigned_crew_id);
        const area = state.areas?.find(a => a.id === item.area_id);
        
        const rowCells = [
            createElement('td', {}, [itemType?.name || 'Unknown']),
            createElement('td', {}, [location?.name || 'Unknown']),
            createElement('td', {}, [crew?.name || 'Unassigned']),
            createElement('td', {}, [area?.name || 'Unassigned'])
        ];
        
        if (isSingleBulkItem) {
            const qtyInput = createElement('input', {
                type: 'text',
                className: 'return-qty-input',
                'data-item-id': String(item.id),
                value: String(item.quantity),
                style: { width: '200px', fontSize: '18px', padding: '8px' },
                oninput: (e) => {
                    // Only allow 0-9 digits
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                },
                onpaste: (e) => {
                    // Handle paste events
                    e.preventDefault();
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    const numericOnly = pastedText.replace(/[^0-9]/g, '');
                    e.target.value = numericOnly;
                }
            });
            
            const qtyCell = createElement('td', {}, [
                qtyInput,
                createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity}`])
            ]);
            rowCells.push(qtyCell);
        }
        
        return createElement('tr', {}, rowCells);
    });
    
    // Build items table
    const itemsTable = createElement('table', { 
        className: 'inventory-table', 
        style: { width: '100%', marginBottom: '15px' } 
    }, [
        createElement('thead', {}, [
            createElement('tr', {}, tableHeaders)
        ]),
        createElement('tbody', {}, tableRows)
    ]);
    
    // Build signature section if action allows PDF
    let signatureSection = null;
    if (action.allow_pdf) {
        signatureSection = div({ style: { marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Signature (Optional):']),
            createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem' } }, [
                'Sign below to include signature on receipt'
            ]),
            createElement('div', { style: { border: '2px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff' } }, [
                signatureCanvas = createElement('canvas', {
                    id: 'signature-canvas',
                    style: { display: 'block', width: '100%', height: '150px', touchAction: 'none' }
                })
            ]),
            div({ style: { marginTop: '0.5rem', display: 'flex', gap: '0.5rem' } }, [
                button('Clear Signature', {
                    className: 'btn btn-secondary',
                    style: { fontSize: '0.875rem' },
                    onclick: () => { if (signaturePad) signaturePad.clear(); }
                })
            ])
        ]);
    }
    
    // Build modal content
    const modalContent = [
        itemsTable,
        signatureSection
    ].filter(Boolean);
    
    const actions = [
        {
            label: 'Return Material',
            type: 'primary',
            handler: async () => {
                // Collect return quantities for bulk items
                if (isSingleBulkItem) {
                    const qtyInput = document.querySelector('.return-qty-input');
                    if (qtyInput) {
                        const itemId = parseInt(qtyInput.getAttribute('data-item-id'));
                        const qtyValue = parseInt(qtyInput.value);
                        if (isNaN(qtyValue) || qtyValue < 1) {
                            returnQuantities[itemId] = items[0].quantity;
                        } else {
                            returnQuantities[itemId] = qtyValue;
                        }
                    }
                }
                
                await executeReturnMaterialAction(items, { returnQuantities, sourceView });
                
                // Auto-generate PDF if signature is present
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                    // Get current crew and area from items
                    const crew = items[0]?.assigned_crew_id ? state.crews.find(c => c.id === items[0].assigned_crew_id) : null;
                    const area = items[0]?.area_id ? state.areas.find(a => a.id === items[0].area_id) : null;
                    await generateReturnPDF(items, { crew, area, receivingLocation }, signaturePad);
                }
                
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: `Return Material to ${receivingLocation.name}`,
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-select quantity input and initialize signature pad
    setTimeout(() => {
        // Select quantity input if present
        if (isSingleBulkItem) {
            const qtyInput = document.querySelector('.return-qty-input');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        }
        
        // Initialize signature pad if present
        if (signatureCanvas && action.allow_pdf) {
            // Function to properly resize canvas
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = signatureCanvas.getBoundingClientRect();
                
                signatureCanvas.width = rect.width * ratio;
                signatureCanvas.height = rect.height * ratio;
                signatureCanvas.getContext('2d').scale(ratio, ratio);
            }
            
            resizeCanvas();
            signaturePad = new SignaturePad(signatureCanvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 0)'
            });
            
            window.addEventListener('resize', resizeCanvas);
        }
    }, 150);
}

// Execute Return Material Action
async function executeReturnMaterialAction(items, options = {}) {
    const state = Store.getState();
    const { returnQuantities = {}, sourceView } = options;
    
    // Get receiving location from preferences
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return;
    }
    
    // Get Available status
    const availableStatus = state.statuses.find(s => s.name === 'Available');
    
    if (!availableStatus) {
        Components.showToast('Available status not found', 'error');
        return;
    }
    
    try {
        // Process each item
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const isBulkItem = itemType && itemType.inventory_type_id === 2;
            const returnQty = returnQuantities[item.id] || item.quantity || 1;
            const isPartialReturn = isBulkItem && returnQty < item.quantity;
            
            if (isPartialReturn) {
                // Partial return: reduce issued quantity and add to available inventory
                const remainingQty = item.quantity - returnQty;
                
                // Update original record with reduced quantity
                await Database.update('inventory', item.id, {
                    quantity: remainingQty
                });
                
                // Add to available inventory at receiving location
                const returnData = {
                    location_id: receivingLocation.id,
                    assigned_crew_id: null,
                    area_id: null,
                    item_type_id: item.item_type_id,
                    quantity: returnQty,
                    status_id: availableStatus.id,
                    sloc_id: item.sloc_id
                };
                
                await Queries.upsertBulkInventory(returnData, 'add');
                
                // Create transaction
                await Queries.createTransaction({
                    inventory_id: item.id,
                    transaction_type: 'Return',
                    action: 'Return Material',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: returnQty,
                    from_location_name: state.locations.find(l => l.id === item.location_id)?.name || 'Unknown',
                    to_location_name: receivingLocation.name,
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    status_name: 'Available',
                    notes: `Partial return (${returnQty} of ${item.quantity}) to ${receivingLocation.name}`
                });
            } else {
                // Full return: update existing record
                const updates = {
                    location_id: receivingLocation.id,
                    assigned_crew_id: null,
                    area_id: null,
                    status_id: availableStatus.id
                };
                
                await Database.update('inventory', item.id, updates);
                
                // Create transaction
                await Queries.createTransaction({
                    inventory_id: item.id,
                    transaction_type: 'Return',
                    action: 'Return Material',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: item.quantity || 1,
                    from_location_name: state.locations.find(l => l.id === item.location_id)?.name || 'Unknown',
                    to_location_name: receivingLocation.name,
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    status_name: 'Available',
                    notes: `Returned to ${receivingLocation.name}`
                });
            }
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            // Consolidate duplicates
            const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
            if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                console.log(`Consolidated ${consolidationResult.value.consolidated} groups`);
            }
            
            // Re-query inventory
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Returned ${items.length} item(s) successfully`, 'success');
        
        // Refresh display based on source view
        if (sourceView === 'serialized') {
            refreshInventoryDisplay();
        } else if (sourceView === 'bulk') {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing return material action:', error);
        Components.showToast('Error returning items', 'error');
    }
}

// Generate Return Material Receipt PDF
async function generateReturnPDF(items, assignments, signaturePad) {
    const state = Store.getState();
    const { crew, area, receivingLocation } = assignments;
    
    try {
        // Get and increment receipt number
        const configResult = await Queries.getConfig('lastReceiptNumber');
        let receiptNumber = 1;
        if (configResult.isOk) {
            receiptNumber = parseInt(configResult.value) + 1;
        }
        await Queries.setConfig('lastReceiptNumber', receiptNumber);
        
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]); // Letter size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let yPosition = 750;
        
        // Header
        page.drawText('MATERIAL RETURN RECEIPT', {
            x: 50,
            y: yPosition,
            size: 18,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        // Receipt Number
        yPosition -= 25;
        page.drawText(`Receipt #: ${String(receiptNumber).padStart(6, '0')}`, {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 30;
        page.drawText(`Date: ${new Date().toLocaleString()}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`SLOC: ${state.selectedSloc?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Returned From Crew: ${crew?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Returned From Area: ${area?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Returned To: ${receivingLocation?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 40;
        
        // Items header
        page.drawText('Items Returned:', {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont
        });
        
        yPosition -= 25;
        
        // Table headers - removed Status column
        page.drawText('Item Type', { x: 50, y: yPosition, size: 9, font: boldFont });
        page.drawText('Serial/ID', { x: 300, y: yPosition, size: 9, font: boldFont });
        page.drawText('Qty', { x: 500, y: yPosition, size: 9, font: boldFont });
        
        yPosition -= 5;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 15;
        
        // Items
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Helper function to wrap text
        const wrapText = (text, maxWidth) => {
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
        
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const serialId = item.tilsonsn || item.mfgrsn || '-';
            const itemTypeName = itemType?.name || 'Unknown';
            
            // Wrap item type name if needed (max width ~230px for 250px column)
            const wrappedLines = wrapText(itemTypeName, 230);
            const startY = yPosition;
            
            // Draw wrapped item type lines
            for (let i = 0; i < wrappedLines.length; i++) {
                page.drawText(wrappedLines[i], { x: 50, y: yPosition - (i * 12), size: 9, font: font });
            }
            
            // Draw other columns aligned with first line
            page.drawText(serialId, { x: 300, y: startY, size: 9, font: font });
            page.drawText(String(item.quantity || 1), { x: 500, y: startY, size: 9, font: font });
            
            // Advance position based on number of wrapped lines
            yPosition -= Math.max(15, wrappedLines.length * 12 + 3);
            
            if (yPosition < 150) break; // Leave space for signature
        }
        
        // Total
        yPosition -= 10;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 20;
        page.drawText(`Total Items: ${items.length}`, { x: 50, y: yPosition, size: 10, font: boldFont });
        page.drawText(`Total Quantity: ${totalQuantity}`, { x: 200, y: yPosition, size: 10, font: boldFont });
        
        // Signature
        if (signaturePad && !signaturePad.isEmpty()) {
            yPosition -= 60;
            page.drawText('Returned By:', { x: 50, y: yPosition + 50, size: 10, font: boldFont });
            
            const signatureDataUrl = signaturePad.toDataURL();
            const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            
            page.drawImage(signatureImage, {
                x: 50,
                y: yPosition - 30,
                width: 200,
                height: 60
            });
        }
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = `Return_Receipt_${getLocalTimestamp().split('T')[0]}.pdf`;
        a.click();
        
        Components.showToast('PDF generated successfully', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        Components.showToast('Error generating PDF', 'error');
    }
}

// Show Field Install Modal
async function showFieldInstallModal(items, action) {
    const state = Store.getState();
    
    // Determine source view
    const sourceView = (() => {
        if (document.querySelector('.hierarchy-container')) return 'serialized';
        if (byId('bulk-items-table-container')) return 'bulk';
        return state.currentView;
    })();
    
    // Store for quantity adjustments (supports partial quantities for ALL items)
    let installQuantities = {};
    items.forEach(item => {
        installQuantities[item.id] = item.quantity || 1;
    });
    
    // Store for area selections per item
    let areaSelections = {};
    items.forEach(item => {
        areaSelections[item.id] = item.area_id || null;
    });
    
    // Store for sequential data (only for serialized items)
    let sequentialData = {};
    
    // Check if item is serialized and fetch sequentials
    if (items.length === 1) {
        const item = items[0];
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const inventoryType = state.inventoryTypes?.find(it => it.id === itemType?.inventory_type_id);
        const isSerialized = inventoryType?.name?.toLowerCase() === 'serialized';
        
        if (isSerialized) {
            const sequentialsResult = await Queries.getSequentialsByInventory(item.id);
            if (sequentialsResult.isOk) {
                sequentialData[item.id] = {
                    history: sequentialsResult.value || [],
                    currentSequential: '',
                    calculatedFootage: null,
                    inputMethod: null // 'footage' or 'sequential'
                };
            }
        }
    }
    
    // Signature pad variables
    let signaturePad = null;
    let signatureCanvas = null;
    
    // Get Field Installed location
    const fieldInstalledLocation = state.locations.find(l => l.name === 'Field Installed');
    
    if (!fieldInstalledLocation) {
        Components.showToast('Field Installed location not found', 'error');
        return;
    }
    
    // Get Installed status
    const installedStatus = state.statuses.find(s => s.name === 'Installed');
    
    if (!installedStatus) {
        Components.showToast('Installed status not found', 'error');
        return;
    }
    
    // Build table header - always include quantity column and area dropdown for partial install support
    const tableHeaders = [
        createElement('th', {}, ['Item']),
        createElement('th', {}, ['Current Location']),
        createElement('th', {}, ['Crew']),
        createElement('th', {}, ['Install To Area']),
        createElement('th', {}, ['Quantity'])
    ];
    
    // Build items table rows - all items get quantity input and area dropdown
    const tableRows = items.map(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const crew = state.crews.find(c => c.id === item.assigned_crew_id);
        
        // Area dropdown options - filter by current SLOC
        const areaOptions = [createElement('option', { value: '' }, ['Select Area'])];
        (state.areas || [])
            .filter(a => a.sloc_id === state.selectedSloc?.id)
            .forEach(a => {
                const optionAttrs = { value: String(a.id) };
                if (a.id === item.area_id) {
                    optionAttrs.selected = 'selected';
                }
                areaOptions.push(createElement('option', optionAttrs, [a.name]));
            });
        
        const areaDropdown = createElement('select', {
            className: 'install-area-select',
            'data-item-id': String(item.id),
            style: { width: '100%', fontSize: '18px', padding: '8px' },
            onchange: (e) => {
                areaSelections[item.id] = e.target.value ? parseInt(e.target.value) : null;
            }
        }, areaOptions);
        
        // Check if this item has sequential data
        const hasSequentials = sequentialData[item.id]?.history?.length > 0;
        const lastSequential = hasSequentials ? sequentialData[item.id].history[0] : null;
        
        // Footage input handler with sequential estimation
        const handleFootageInput = (e) => {
            const footage = parseFloat(e.target.value) || 0;
            installQuantities[item.id] = footage;
            
            if (hasSequentials && footage > 0) {
                sequentialData[item.id].inputMethod = 'footage';
                // Estimate new sequential: last sequential MINUS footage (sequentials decrease)
                const estimatedSequential = lastSequential.sequential_number - footage;
                sequentialData[item.id].currentSequential = estimatedSequential;
                sequentialData[item.id].calculatedFootage = footage;
                
                // Update sequential input display
                const seqInput = document.querySelector(`.install-sequential-input[data-item-id="${item.id}"]`);
                if (seqInput) {
                    seqInput.value = String(estimatedSequential);
                }
                
                // Update remaining footage display
                const remainingDisplay = document.getElementById(`remaining-footage-${item.id}`);
                if (remainingDisplay) {
                    remainingDisplay.textContent = ` (Installed: ${footage} ft)`;
                    remainingDisplay.style.color = '#059669';
                    remainingDisplay.style.fontWeight = 'bold';
                }
            }
        };
        
        // Sequential input handler with footage calculation
        const handleSequentialInput = (e) => {
            const currentSeq = parseFloat(e.target.value);
            
            if (hasSequentials && !isNaN(currentSeq) && currentSeq >= 0) {
                sequentialData[item.id].inputMethod = 'sequential';
                sequentialData[item.id].currentSequential = currentSeq;
                // Calculate footage: last sequential MINUS current sequential (sequentials decrease)
                const footage = lastSequential.sequential_number - currentSeq;
                sequentialData[item.id].calculatedFootage = Math.max(0, footage);
                installQuantities[item.id] = Math.max(0, footage);
                
                // Update footage input display
                const footageInput = document.querySelector(`.install-qty-input[data-item-id="${item.id}"]`);
                if (footageInput) {
                    footageInput.value = String(Math.max(0, footage));
                }
                
                // Update remaining footage display
                const remainingDisplay = document.getElementById(`remaining-footage-${item.id}`);
                if (remainingDisplay) {
                    if (footage >= 0) {
                        remainingDisplay.textContent = ` (Installed: ${Math.round(footage)} ft)`;
                        remainingDisplay.style.color = '#059669';
                    } else {
                        remainingDisplay.textContent = ` (Invalid: sequential increased)`;
                        remainingDisplay.style.color = '#dc2626';
                    }
                    remainingDisplay.style.fontWeight = 'bold';
                }
            }
        };
        
        const qtyInput = createElement('input', {
            type: 'text',
            className: 'install-qty-input',
            'data-item-id': String(item.id),
            value: String(item.quantity || 1),
            style: { width: hasSequentials ? '120px' : '200px', fontSize: '18px', padding: '8px' },
            oninput: (e) => {
                // Only allow 0-9 and decimal point
                e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                handleFootageInput(e);
            },
            onpaste: (e) => {
                // Handle paste events
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9.]/g, '');
                e.target.value = numericOnly;
            }
        });
        
        // Build quantity cell with optional sequential input
        let quantityCell;
        if (hasSequentials) {
            const sequentialInput = createElement('input', {
                type: 'text',
                className: 'install-sequential-input',
                'data-item-id': String(item.id),
                placeholder: 'Sequential',
                style: { width: '120px', fontSize: '18px', padding: '8px', marginLeft: '8px' },
                oninput: (e) => {
                    e.target.value = e.target.value.replace(/[^0-9.]/g, '');
                    handleSequentialInput(e);
                }
            });
            
            quantityCell = createElement('td', {}, [
                div({ style: { display: 'flex', flexDirection: 'column', gap: '8px' } }, [
                    div({ style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
                        createElement('label', { style: { fontSize: '14px', fontWeight: '600', minWidth: '70px' } }, ['Footage:']),
                        qtyInput,
                        createElement('span', { style: { marginLeft: '5px', fontSize: '14px' } }, [` of ${item.quantity || 1}`])
                    ]),
                    div({ style: { display: 'flex', alignItems: 'center', gap: '4px' } }, [
                        createElement('label', { style: { fontSize: '14px', fontWeight: '600', minWidth: '70px' } }, ['Sequential:']),
                        sequentialInput,
                        createElement('span', { 
                            id: `remaining-footage-${item.id}`,
                            style: { marginLeft: '5px', fontSize: '14px', color: '#6b7280' } 
                        }, [''])
                    ])
                ])
            ]);
        } else {
            quantityCell = createElement('td', {}, [
                qtyInput,
                createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity || 1}`])
            ]);
        }
        
        const rowCells = [
            createElement('td', {}, [itemType?.name || 'Unknown']),
            createElement('td', {}, [location?.name || 'Unknown']),
            createElement('td', {}, [crew?.name || 'Unassigned']),
            createElement('td', {}, [areaDropdown]),
            quantityCell
        ];
        
        return createElement('tr', {}, rowCells);
    });
    
    // Build sequential history section if exists
    let sequentialHistorySection = null;
    if (items.length === 1 && sequentialData[items[0].id]?.history?.length > 0) {
        const history = sequentialData[items[0].id].history;
        
        sequentialHistorySection = div({ 
            style: { 
                marginBottom: '20px', 
                padding: '12px', 
                backgroundColor: '#f0f9ff', 
                border: '1px solid #bae6fd', 
                borderRadius: '6px' 
            } 
        }, [
            createElement('h4', { 
                style: { 
                    margin: '0 0 10px 0', 
                    fontSize: '16px', 
                    fontWeight: '600',
                    color: '#0369a1' 
                } 
            }, ['Sequential History']),
            createElement('div', { style: { maxHeight: '150px', overflowY: 'auto' } }, [
                createElement('table', { 
                    style: { 
                        width: '100%', 
                        fontSize: '14px',
                        borderCollapse: 'collapse'
                    } 
                }, [
                    createElement('thead', {}, [
                        createElement('tr', {}, [
                            createElement('th', { 
                                style: { 
                                    textAlign: 'left', 
                                    padding: '6px', 
                                    borderBottom: '2px solid #0284c7',
                                    color: '#0369a1',
                                    fontWeight: '600'
                                } 
                            }, ['Sequential']),
                            createElement('th', { 
                                style: { 
                                    textAlign: 'left', 
                                    padding: '6px', 
                                    borderBottom: '2px solid #0284c7',
                                    color: '#0369a1',
                                    fontWeight: '600'
                                } 
                            }, ['Recorded At'])
                        ])
                    ]),
                    createElement('tbody', {}, 
                        history.map((seq, idx) => 
                            createElement('tr', { 
                                style: { 
                                    backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f0f9ff' 
                                } 
                            }, [
                                createElement('td', { 
                                    style: { 
                                        padding: '6px', 
                                        fontFamily: 'monospace',
                                        fontWeight: '600'
                                    } 
                                }, [String(seq.sequential_number)]),
                                createElement('td', { 
                                    style: { padding: '6px' } 
                                }, [formatTimestampWithTimezone(seq.recorded_at, seq.created_timezone)])
                            ])
                        )
                    )
                ])
            ]),
            createElement('div', { 
                style: { 
                    marginTop: '8px', 
                    fontSize: '13px', 
                    color: '#0369a1',
                    fontStyle: 'italic'
                } 
            }, [`Last recorded: ${history[0].sequential_number} on ${formatTimestampWithTimezone(history[0].recorded_at, history[0].created_timezone)}`])
        ]);
    }
    
    // Build items table
    const itemsTable = createElement('table', { 
        className: 'inventory-table', 
        style: { width: '100%', marginBottom: '15px' } 
    }, [
        createElement('thead', {}, [
            createElement('tr', {}, tableHeaders)
        ]),
        createElement('tbody', {}, tableRows)
    ]);
    
    // Build signature section if action allows PDF
    let signatureSection = null;
    if (action.allow_pdf) {
        signatureSection = div({ style: { marginTop: '0.75rem', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } }, [
            createElement('h4', { style: { margin: '0 0 0.25rem 0', fontSize: '1rem' } }, ['Signature (Optional):']),
            createElement('p', { style: { fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' } }, [
                'Sign below to include signature on receipt'
            ]),
            createElement('div', { style: { border: '2px solid #d1d5db', borderRadius: '0.375rem', backgroundColor: '#fff' } }, [
                signatureCanvas = createElement('canvas', {
                    id: 'signature-canvas',
                    style: { display: 'block', width: '100%', height: '120px', touchAction: 'none' }
                })
            ]),
            div({ style: { marginTop: '0.5rem', display: 'flex', gap: '0.5rem' } }, [
                button('Clear Signature', {
                    className: 'btn btn-secondary',
                    style: { fontSize: '0.875rem' },
                    onclick: () => { if (signaturePad) signaturePad.clear(); }
                })
            ])
        ]);
    }
    
    // Build modal content
    const modalContent = [
        sequentialHistorySection,
        itemsTable,
        signatureSection
    ].filter(Boolean);
    
    const actions = [
        {
            label: 'Complete Field Install',
            type: 'primary',
            handler: async () => {
                // Collect install quantities and area selections for all items
                const qtyInputs = document.querySelectorAll('.install-qty-input');
                qtyInputs.forEach(input => {
                    const itemId = parseInt(input.getAttribute('data-item-id'));
                    const qtyValue = parseFloat(input.value);
                    if (isNaN(qtyValue) || qtyValue < 1) {
                        installQuantities[itemId] = items.find(i => i.id === itemId)?.quantity || 1;
                    } else {
                        installQuantities[itemId] = qtyValue;
                    }
                });
                
                const areaSelects = document.querySelectorAll('.install-area-select');
                areaSelects.forEach(select => {
                    const itemId = parseInt(select.getAttribute('data-item-id'));
                    areaSelections[itemId] = select.value ? parseInt(select.value) : null;
                });
                
                // Collect sequential inputs for serialized items
                const sequentialInputs = document.querySelectorAll('.install-sequential-input');
                sequentialInputs.forEach(input => {
                    const itemId = parseInt(input.getAttribute('data-item-id'));
                    const seqValue = parseFloat(input.value);
                    if (!isNaN(seqValue) && seqValue > 0 && sequentialData[itemId]) {
                        sequentialData[itemId].currentSequential = seqValue;
                    }
                });
                
                await executeFieldInstallAction(items, { 
                    installQuantities, 
                    areaSelections, 
                    sequentialData,
                    sourceView 
                });
                
                // Auto-generate PDF if signature is present
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                    // Get crew and area from first item's selections
                    const crew = items[0]?.assigned_crew_id ? state.crews.find(c => c.id === items[0].assigned_crew_id) : null;
                    const area = areaSelections[items[0].id] ? state.areas.find(a => a.id === areaSelections[items[0].id]) : null;
                    await generateFieldInstallPDF(items, { crew, area, fieldInstalledLocation }, signaturePad);
                }
                
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: 'Field Install',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-select quantity inputs and initialize signature pad
    setTimeout(() => {
        // Select first quantity input
        const firstQtyInput = document.querySelector('.install-qty-input');
        if (firstQtyInput) {
            firstQtyInput.focus();
            firstQtyInput.select();
        }
        
        // Initialize signature pad if present
        if (signatureCanvas && action.allow_pdf) {
            // Function to properly resize canvas
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = signatureCanvas.getBoundingClientRect();
                
                signatureCanvas.width = rect.width * ratio;
                signatureCanvas.height = rect.height * ratio;
                signatureCanvas.getContext('2d').scale(ratio, ratio);
            }
            
            resizeCanvas();
            signaturePad = new SignaturePad(signatureCanvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 0)'
            });
            
            window.addEventListener('resize', resizeCanvas);
        }
    }, 150);
}

// Execute Field Install Action
async function executeFieldInstallAction(items, options = {}) {
    const state = Store.getState();
    const { installQuantities = {}, areaSelections = {}, sequentialData = {}, sourceView } = options;
    
    // Get Field Installed location
    const fieldInstalledLocation = state.locations.find(l => l.name === 'Field Installed');
    
    if (!fieldInstalledLocation) {
        Components.showToast('Field Installed location not found', 'error');
        return;
    }
    
    // Get Installed status
    const installedStatus = state.statuses.find(s => s.name === 'Installed');
    
    if (!installedStatus) {
        Components.showToast('Installed status not found', 'error');
        return;
    }
    
    try {
        // Process each item
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const installQty = installQuantities[item.id] || item.quantity || 1;
            const isPartialInstall = installQty < (item.quantity || 1);
            
            if (isPartialInstall) {
                // Partial install: reduce original quantity and create new installed record
                const remainingQty = (item.quantity || 1) - installQty;
                
                // Update original record with reduced quantity
                await Database.update('inventory', item.id, {
                    quantity: remainingQty
                });
                
                // Create new record with installed quantity at Field Installed location
                const installData = {
                    location_id: fieldInstalledLocation.id,
                    assigned_crew_id: item.assigned_crew_id, // Preserve crew
                    area_id: areaSelections[item.id] || item.area_id, // Use selected area
                    item_type_id: item.item_type_id,
                    quantity: installQty,
                    status_id: installedStatus.id,
                    sloc_id: item.sloc_id,
                    mfgrsn: item.mfgrsn,
                    tilsonsn: item.tilsonsn
                };
                
                const insertResult = await Database.insert('inventory', installData);
                
                // Create transaction
                await Queries.createTransaction({
                    inventory_id: insertResult.isOk ? insertResult.value[0].id : item.id,
                    transaction_type: 'Install',
                    action: 'Field Install',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: installQty,
                    from_location_name: state.locations.find(l => l.id === item.location_id)?.name || 'Unknown',
                    to_location_name: fieldInstalledLocation.name,
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    status_name: 'Installed',
                    notes: `Partial install (${installQty} of ${item.quantity || 1}) to field`
                });
                
                // Record sequential if exists and item is serialized
                if (sequentialData[item.id] && sequentialData[item.id].currentSequential) {
                    const seqData = sequentialData[item.id];
                    const isVerified = seqData.inputMethod === 'sequential';
                    
                    await Queries.createSequential({
                        inventory_id: item.id,
                        sequential_number: seqData.currentSequential,
                        notes: isVerified 
                            ? 'Verified - manually entered during field install' 
                            : 'Estimated - calculated from footage during field install'
                    });
                }
            } else {
                // Full install: update existing record
                const updates = {
                    location_id: fieldInstalledLocation.id,
                    status_id: installedStatus.id,
                    area_id: areaSelections[item.id] || item.area_id // Use selected area or keep original
                };
                
                await Database.update('inventory', item.id, updates);
                
                // Create transaction
                await Queries.createTransaction({
                    inventory_id: item.id,
                    transaction_type: 'Install',
                    action: 'Field Install',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: item.quantity || 1,
                    from_location_name: state.locations.find(l => l.id === item.location_id)?.name || 'Unknown',
                    to_location_name: fieldInstalledLocation.name,
                    old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
                    status_name: 'Installed',
                    notes: `Installed in field`
                });
                
                // Record sequential if exists and item is serialized
                if (sequentialData[item.id] && sequentialData[item.id].currentSequential) {
                    const seqData = sequentialData[item.id];
                    const isVerified = seqData.inputMethod === 'sequential';
                    
                    await Queries.createSequential({
                        inventory_id: item.id,
                        sequential_number: seqData.currentSequential,
                        notes: isVerified 
                            ? 'Verified - manually entered during field install' 
                            : 'Estimated - calculated from footage during field install'
                    });
                }
            }
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            // Re-query inventory (no consolidation needed for Field Install)
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Installed ${items.length} item(s) successfully`, 'success');
        
        // Refresh display based on source view
        if (sourceView === 'serialized') {
            refreshInventoryDisplay();
        } else if (sourceView === 'bulk') {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing field install action:', error);
        Components.showToast('Error installing items', 'error');
    }
}

// Generate Field Install Receipt PDF
async function generateFieldInstallPDF(items, assignments, signaturePad) {
    const state = Store.getState();
    const { crew, area, fieldInstalledLocation } = assignments;
    
    try {
        // Get and increment receipt number
        const configResult = await Queries.getConfig('lastReceiptNumber');
        let receiptNumber = 1;
        if (configResult.isOk) {
            receiptNumber = parseInt(configResult.value) + 1;
        }
        await Queries.setConfig('lastReceiptNumber', receiptNumber);
        
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]); // Letter size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let yPosition = 750;
        
        // Header
        page.drawText('FIELD INSTALLATION RECEIPT', {
            x: 50,
            y: yPosition,
            size: 18,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        // Receipt Number
        yPosition -= 25;
        page.drawText(`Receipt #: ${String(receiptNumber).padStart(6, '0')}`, {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 30;
        page.drawText(`Date: ${new Date().toLocaleString()}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`SLOC: ${state.selectedSloc?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Crew: ${crew?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Area: ${area?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Installed To: ${fieldInstalledLocation?.name || 'Field Installed'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 40;
        
        // Items header
        page.drawText('Items Installed:', {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont
        });
        
        yPosition -= 25;
        
        // Table headers
        page.drawText('Item Type', { x: 50, y: yPosition, size: 9, font: boldFont });
        page.drawText('Serial/ID', { x: 300, y: yPosition, size: 9, font: boldFont });
        page.drawText('Qty', { x: 500, y: yPosition, size: 9, font: boldFont });
        
        yPosition -= 5;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 15;
        
        // Items
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        // Helper function to wrap text
        const wrapText = (text, maxWidth) => {
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
        
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const serialId = item.tilsonsn || item.mfgrsn || '-';
            const itemTypeName = itemType?.name || 'Unknown';
            
            // Wrap item type name if needed (max width ~230px for 250px column)
            const wrappedLines = wrapText(itemTypeName, 230);
            const startY = yPosition;
            
            // Draw wrapped item type lines
            for (let i = 0; i < wrappedLines.length; i++) {
                page.drawText(wrappedLines[i], { x: 50, y: yPosition - (i * 12), size: 9, font: font });
            }
            
            // Draw other columns aligned with first line
            page.drawText(serialId, { x: 300, y: startY, size: 9, font: font });
            page.drawText(String(item.quantity || 1), { x: 500, y: startY, size: 9, font: font });
            
            // Advance position based on number of wrapped lines
            yPosition -= Math.max(15, wrappedLines.length * 12 + 3);
            
            if (yPosition < 150) break; // Leave space for signature
        }
        
        // Total
        yPosition -= 10;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 20;
        page.drawText(`Total Items: ${items.length}`, { x: 50, y: yPosition, size: 10, font: boldFont });
        page.drawText(`Total Quantity: ${totalQuantity}`, { x: 200, y: yPosition, size: 10, font: boldFont });
        
        // Signature
        if (signaturePad && !signaturePad.isEmpty()) {
            yPosition -= 60;
            page.drawText('Installed By:', { x: 50, y: yPosition + 50, size: 10, font: boldFont });
            
            const signatureDataUrl = signaturePad.toDataURL();
            const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            
            page.drawImage(signatureImage, {
                x: 50,
                y: yPosition - 30,
                width: 200,
                height: 60
            });
        }
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = `Field_Install_Receipt_${getLocalTimestamp().split('T')[0]}.pdf`;
        a.click();
        
        Components.showToast('PDF generated successfully', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        Components.showToast('Error generating PDF', 'error');
    }
}

// Show Adjust Modal
function showAdjustModal(items, action) {
    const state = Store.getState();
    
    if (items.length !== 1) {
        Components.showToast('Adjust action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const status = state.statuses.find(s => s.id === item.status_id);
    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
    const area = state.areas?.find(a => a.id === item.area_id);
    
    let newQuantity = item.quantity || 1;
    let comment = '';
    
    // Build item details section
    const itemDetails = div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
        createElement('h4', { style: { margin: '0 0 0.75rem 0' } }, ['Item Details']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            createElement('div', {}, [
                createElement('strong', {}, ['Item Type: ']),
                createElement('span', {}, [itemType?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Current Quantity: ']),
                createElement('span', {}, [String(item.quantity || 1)])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Location: ']),
                createElement('span', {}, [location?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Status: ']),
                createElement('span', {}, [status?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Crew: ']),
                createElement('span', {}, [crew?.name || 'Unassigned'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Area: ']),
                createElement('span', {}, [area?.name || 'Unassigned'])
            ])
        ])
    ]);
    
    // Quantity adjustment section
    const quantityInput = createElement('input', {
        type: 'text',
        id: 'adjust-quantity-input',
        className: 'form-control',
        value: String(item.quantity || 1),
        style: { fontSize: '18px', padding: '8px', width: '200px' },
        oninput: (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            newQuantity = parseInt(e.target.value) || item.quantity || 1;
        },
        onpaste: (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/[^0-9]/g, '');
            e.target.value = numericOnly;
            newQuantity = parseInt(numericOnly) || item.quantity || 1;
        }
    });
    
    const commentInput = createElement('textarea', {
        id: 'adjust-comment-input',
        className: 'form-control',
        placeholder: 'Enter reason for adjustment (minimum 5 characters required)',
        rows: 2,
        style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' },
        oninput: (e) => {
            comment = e.target.value;
        }
    });
    
    const adjustmentSection = div({ style: { marginBottom: '0.5rem' } }, [
        div({ style: { marginBottom: '0.75rem' } }, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['New Quantity:']),
            quantityInput
        ]),
        div({}, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Comment (required, min 5 characters):']),
            commentInput
        ])
    ]);
    
    // Build modal content
    const modalContent = [
        itemDetails,
        adjustmentSection
    ];
    
    const actions = [
        {
            label: 'Complete Adjustment',
            type: 'primary',
            handler: async () => {
                const qtyInput = document.getElementById('adjust-quantity-input');
                const commentTextarea = document.getElementById('adjust-comment-input');
                
                const finalQuantity = parseInt(qtyInput.value);
                const finalComment = commentTextarea.value.trim();
                
                if (isNaN(finalQuantity) || finalQuantity < 0) {
                    Components.showToast('Please enter a valid quantity (0 or greater)', 'error');
                    return;
                }
                
                if (finalComment.length < 5) {
                    Components.showToast('Comment must be at least 5 characters long', 'error');
                    return;
                }
                
                await executeAdjustAction(item, finalQuantity, finalComment);
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: 'Adjust Quantity',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-select quantity input
    setTimeout(() => {
        const qtyInput = document.getElementById('adjust-quantity-input');
        if (qtyInput) {
            qtyInput.focus();
            qtyInput.select();
        }
    }, 150);
}

// Execute Adjust Action
async function executeAdjustAction(item, newQuantity, comment) {
    const state = Store.getState();
    
    try {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const oldQuantity = item.quantity || 1;
        
        // Capture before state
        const beforeState = { ...item };
        
        // Update inventory quantity
        await Database.update('inventory', item.id, {
            quantity: newQuantity,
            updated_at: getLocalTimestamp()
        });
        
        // Capture after state
        const afterState = { ...item, quantity: newQuantity };
        
        // Create transaction
        await Queries.createTransaction({
            inventory_id: item.id,
            transaction_type: 'Adjust',
            action: 'Adjust',
            item_type_name: itemType?.name || 'Unknown',
            old_quantity: oldQuantity,
            quantity: newQuantity,
            notes: comment,
            before_state: JSON.stringify(beforeState),
            after_state: JSON.stringify(afterState)
        });
        
        // Refresh inventory
        if (state.selectedSloc) {
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Quantity adjusted from ${oldQuantity} to ${newQuantity}`, 'success');
        
        // Refresh display
        if (document.querySelector('.hierarchy-container')) {
            refreshInventoryDisplay();
        } else if (byId('bulk-items-table-container')) {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing adjust action:', error);
        Components.showToast('Error adjusting quantity', 'error');
    }
}

// Show Reject Modal
function showRejectModal(items, action) {
    const state = Store.getState();
    
    if (items.length !== 1) {
        Components.showToast('Reject action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const status = state.statuses.find(s => s.id === item.status_id);
    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
    const area = state.areas?.find(a => a.id === item.area_id);
    
    // Check if this is a bulk item
    const isBulkItem = itemType && itemType.inventory_type_id === 2;
    
    let rejectQuantity = item.quantity || 1;
    let comment = '';
    
    // Get Rejected status
    const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
    
    if (!rejectedStatus) {
        Components.showToast('Rejected status not found', 'error');
        return;
    }
    
    // Build item details section
    const itemDetails = div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            createElement('div', {}, [
                createElement('strong', {}, ['Item Type: ']),
                createElement('span', {}, [itemType?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Current Quantity: ']),
                createElement('span', {}, [String(item.quantity || 1)])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Location: ']),
                createElement('span', {}, [location?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Status: ']),
                createElement('span', {}, [status?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Crew: ']),
                createElement('span', {}, [crew?.name || 'Unassigned'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Area: ']),
                createElement('span', {}, [area?.name || 'Unassigned'])
            ])
        ])
    ]);
    
    // Quantity input section (only for bulk items)
    let quantitySection = null;
    if (isBulkItem) {
        const quantityInput = createElement('input', {
            type: 'text',
            id: 'reject-quantity-input',
            className: 'form-control',
            value: String(item.quantity || 1),
            style: { fontSize: '18px', padding: '8px', width: '200px' },
            oninput: (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                rejectQuantity = parseInt(e.target.value) || item.quantity || 1;
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9]/g, '');
                e.target.value = numericOnly;
                rejectQuantity = parseInt(numericOnly) || item.quantity || 1;
            }
        });
        
        quantitySection = div({ style: { marginBottom: '0.75rem' } }, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Reject Quantity:']),
            quantityInput,
            createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity || 1}`])
        ]);
    }
    
    const commentInput = createElement('textarea', {
        id: 'reject-comment-input',
        className: 'form-control',
        placeholder: 'Enter reason for rejection (minimum 5 characters required)',
        rows: 2,
        style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' },
        oninput: (e) => {
            comment = e.target.value;
        }
    });
    
    const rejectionSection = div({ style: { marginBottom: '0.5rem' } }, [
        quantitySection,
        div({}, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Rejection Reason (required, min 5 characters):']),
            commentInput
        ])
    ].filter(Boolean));
    
    // Build modal content
    const modalContent = [
        itemDetails,
        rejectionSection
    ];
    
    const actions = [
        {
            label: 'Complete Rejection',
            type: 'primary',
            handler: async () => {
                const commentTextarea = document.getElementById('reject-comment-input');
                const finalComment = commentTextarea.value.trim();
                
                if (finalComment.length < 5) {
                    Components.showToast('Rejection reason must be at least 5 characters long', 'error');
                    return;
                }
                
                let finalQuantity = item.quantity || 1;
                if (isBulkItem) {
                    const qtyInput = document.getElementById('reject-quantity-input');
                    finalQuantity = parseInt(qtyInput.value);
                    
                    if (isNaN(finalQuantity) || finalQuantity < 1) {
                        Components.showToast('Please enter a valid quantity (1 or greater)', 'error');
                        return;
                    }
                    
                    if (finalQuantity > item.quantity) {
                        Components.showToast(`Reject quantity cannot exceed available quantity (${item.quantity})`, 'error');
                        return;
                    }
                }
                
                await executeRejectAction(item, finalQuantity, finalComment, isBulkItem);
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: 'Reject Material',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-select quantity input or focus comment
    setTimeout(() => {
        if (isBulkItem) {
            const qtyInput = document.getElementById('reject-quantity-input');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        } else {
            const commentInput = document.getElementById('reject-comment-input');
            if (commentInput) {
                commentInput.focus();
            }
        }
    }, 150);
}

// Execute Reject Action
async function executeRejectAction(item, rejectQuantity, comment, isBulkItem) {
    const state = Store.getState();
    
    try {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
        const oldStatus = state.statuses.find(s => s.id === item.status_id);
        
        if (!rejectedStatus) {
            Components.showToast('Rejected status not found', 'error');
            return;
        }
        
        const isPartialRejection = isBulkItem && rejectQuantity < item.quantity;
        
        if (isPartialRejection) {
            // Partial rejection: reduce original quantity and create new rejected record
            const remainingQty = item.quantity - rejectQuantity;
            
            // Update original record with reduced quantity
            await Database.update('inventory', item.id, {
                quantity: remainingQty,
                updated_at: getLocalTimestamp()
            });
            
            // Create new record with rejected quantity at Rejected status
            const rejectedData = {
                location_id: item.location_id,
                assigned_crew_id: item.assigned_crew_id,
                area_id: item.area_id,
                item_type_id: item.item_type_id,
                quantity: rejectQuantity,
                status_id: rejectedStatus.id,
                sloc_id: item.sloc_id
            };
            
            const insertResult = await Database.insert('inventory', rejectedData);
            
            // Create transaction
            await Queries.createTransaction({
                inventory_id: insertResult.isOk ? insertResult.value[0].id : item.id,
                transaction_type: 'Reject',
                action: 'Reject',
                item_type_name: itemType?.name || 'Unknown',
                quantity: rejectQuantity,
                old_status_name: oldStatus?.name || 'Unknown',
                status_name: 'Rejected',
                notes: `Partial rejection (${rejectQuantity} of ${item.quantity}): ${comment}`
            });
        } else {
            // Full rejection: update existing record status
            await Database.update('inventory', item.id, {
                status_id: rejectedStatus.id,
                updated_at: getLocalTimestamp()
            });
            
            // Create transaction
            await Queries.createTransaction({
                inventory_id: item.id,
                transaction_type: 'Reject',
                action: 'Reject',
                item_type_name: itemType?.name || 'Unknown',
                quantity: item.quantity || 1,
                old_status_name: oldStatus?.name || 'Unknown',
                status_name: 'Rejected',
                notes: comment
            });
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            // Consolidate for bulk items at receiving location
            if (isBulkItem && isPartialRejection) {
                const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
                if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                    console.log(`Consolidated ${consolidationResult.value.consolidated} groups`);
                }
            }
            
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Rejected ${rejectQuantity} item(s) successfully`, 'success');
        
        // Refresh display
        if (document.querySelector('.hierarchy-container')) {
            refreshInventoryDisplay();
        } else if (byId('bulk-items-table-container')) {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing reject action:', error);
        Components.showToast('Error rejecting material', 'error');
    }
}

// Show Inspect Modal
function showInspectModal(items, action) {
    const state = Store.getState();
    
    if (items.length !== 1) {
        Components.showToast('Inspect action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const status = state.statuses.find(s => s.id === item.status_id);
    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
    const area = state.areas?.find(a => a.id === item.area_id);
    
    // Check if this is a bulk item
    const isBulkItem = itemType && itemType.inventory_type_id === 2;
    
    const totalAvailable = item.quantity || 1;
    let passedUnits = 0;
    let rejectedUnits = 0;
    
    // Get Available and Rejected statuses
    const availableStatus = state.statuses.find(s => s.name === 'Available');
    const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
    
    if (!availableStatus || !rejectedStatus) {
        Components.showToast('Required statuses not found', 'error');
        return;
    }
    
    // Build item details section
    const itemDetails = div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            createElement('div', {}, [
                createElement('strong', {}, ['Item Type: ']),
                createElement('span', {}, [itemType?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, [isBulkItem ? 'Total Available: ' : 'Quantity: ']),
                createElement('span', {}, [String(totalAvailable)])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Location: ']),
                createElement('span', {}, [location?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Status: ']),
                createElement('span', {}, [status?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Crew: ']),
                createElement('span', {}, [crew?.name || 'Unassigned'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Area: ']),
                createElement('span', {}, [area?.name || 'Unassigned'])
            ])
        ])
    ]);
    
    let inspectionSection = null;
    
    if (isBulkItem) {
        // Bulk item: show input fields for passed/rejected units
        // Function to update totals and validation
        const updateTotals = () => {
            const passed = parseInt(document.getElementById('inspect-passed-input')?.value) || 0;
            const rejected = parseInt(document.getElementById('inspect-rejected-input')?.value) || 0;
            
            const inspected = passed + rejected;
            const uninspected = totalAvailable - inspected;
            const hasError = inspected > totalAvailable;
        
        // Update display
        const inspectedSpan = document.getElementById('inspect-total-inspected');
        const uninspectedSpan = document.getElementById('inspect-total-uninspected');
        const errorMsg = document.getElementById('inspect-error-message');
        const completeBtn = document.querySelector('.btn-primary');
        
        if (inspectedSpan) inspectedSpan.textContent = String(inspected);
        if (uninspectedSpan) uninspectedSpan.textContent = String(uninspected);
        
        if (errorMsg) {
            if (hasError) {
                errorMsg.textContent = `Error: Total inspected (${inspected}) exceeds total available (${totalAvailable})`;
                errorMsg.style.display = 'block';
            } else {
                errorMsg.style.display = 'none';
            }
        }
        
        if (completeBtn) {
            completeBtn.disabled = hasError;
            completeBtn.style.opacity = hasError ? '0.5' : '1';
            completeBtn.style.cursor = hasError ? 'not-allowed' : 'pointer';
        }
    };
    
    // Inspection inputs section
    const passedInput = createElement('input', {
        type: 'text',
        id: 'inspect-passed-input',
        className: 'form-control',
        value: '0',
        style: { fontSize: '18px', padding: '8px', width: '200px' },
        oninput: (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            passedUnits = parseInt(e.target.value) || 0;
            updateTotals();
        },
        onpaste: (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/[^0-9]/g, '');
            e.target.value = numericOnly;
            passedUnits = parseInt(numericOnly) || 0;
            updateTotals();
        }
    });
    
    const rejectedInput = createElement('input', {
        type: 'text',
        id: 'inspect-rejected-input',
        className: 'form-control',
        value: '0',
        style: { fontSize: '18px', padding: '8px', width: '200px' },
        oninput: (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, '');
            rejectedUnits = parseInt(e.target.value) || 0;
            updateTotals();
        },
        onpaste: (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            const numericOnly = pastedText.replace(/[^0-9]/g, '');
            e.target.value = numericOnly;
            rejectedUnits = parseInt(numericOnly) || 0;
            updateTotals();
        }
    });
    
    inspectionSection = div({ style: { marginBottom: '0.5rem' } }, [
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' } }, [
            div({}, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Passed Units:']),
                passedInput
            ]),
            div({}, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Rejected Units:']),
                rejectedInput
            ])
        ]),
        div({ style: { padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', border: '1px solid #3b82f6' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Inspection Summary:']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.875rem' } }, [
                div({}, [
                    createElement('strong', {}, ['Total Available: ']),
                    createElement('span', {}, [String(totalAvailable)])
                ]),
                div({}, [
                    createElement('strong', {}, ['Inspected: ']),
                    createElement('span', { id: 'inspect-total-inspected' }, ['0'])
                ]),
                div({}, [
                    createElement('strong', {}, ['Uninspected: ']),
                    createElement('span', { id: 'inspect-total-uninspected' }, [String(totalAvailable)])
                ])
            ])
        ]),
        createElement('div', {
            id: 'inspect-error-message',
            style: {
                display: 'none',
                marginTop: '0.5rem',
                padding: '0.5rem',
                backgroundColor: '#fee2e2',
                color: '#991b1b',
                borderRadius: '0.375rem',
                fontSize: '0.875rem',
                fontWeight: '500'
            }
        }, [])
    ]);
    } else {
        // Serialized item: simple confirmation message
        inspectionSection = div({ style: { marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', border: '1px solid #3b82f6' } }, [
            createElement('p', { style: { margin: 0, fontSize: '1rem' } }, [
                'This serialized item will be marked as ',
                createElement('strong', {}, ['Available']),
                ' after inspection confirmation.'
            ])
        ]);
    }
    
    // Build modal content
    const modalContent = [
        itemDetails,
        inspectionSection
    ];
    
    const actions = [
        {
            label: 'Complete Inspection',
            type: 'primary',
            handler: async () => {
                if (isBulkItem) {
                    const passed = parseInt(document.getElementById('inspect-passed-input')?.value) || 0;
                    const rejected = parseInt(document.getElementById('inspect-rejected-input')?.value) || 0;
                    
                    const inspected = passed + rejected;
                    
                    if (inspected === 0) {
                        Components.showToast('Please enter passed and/or rejected units', 'error');
                        return;
                    }
                    
                    if (inspected > totalAvailable) {
                        Components.showToast(`Total inspected (${inspected}) exceeds total available (${totalAvailable})`, 'error');
                        return;
                    }
                    
                    await executeInspectAction(item, passed, rejected, true);
                } else {
                    await executeInspectAction(item, 1, 0, false);
                }
                
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: 'Inspect Material',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-select passed input for bulk items only
    if (isBulkItem) {
        setTimeout(() => {
            const passedInput = document.getElementById('inspect-passed-input');
            if (passedInput) {
                passedInput.focus();
                passedInput.select();
            }
        }, 150);
    }
}

// Execute Inspect Action
async function executeInspectAction(item, passedUnits, rejectedUnits, isBulkItem) {
    const state = Store.getState();
    
    try {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const availableStatus = state.statuses.find(s => s.name === 'Available');
        const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
        const oldStatus = state.statuses.find(s => s.id === item.status_id);
        
        if (!availableStatus || !rejectedStatus) {
            Components.showToast('Required statuses not found', 'error');
            return;
        }
        
        if (!isBulkItem) {
            // Serialized item: simply update status to Available
            await Database.update('inventory', item.id, {
                status_id: availableStatus.id,
                updated_at: getLocalTimestamp()
            });
            
            // Create transaction
            await Queries.createTransaction({
                inventory_id: item.id,
                transaction_type: 'Inspect',
                action: 'Inspect',
                item_type_name: itemType?.name || 'Unknown',
                quantity: 1,
                old_status_name: oldStatus?.name || 'Unknown',
                status_name: 'Available',
                notes: 'Serialized item inspected and marked as Available'
            });
        } else {
            // Bulk item: split into passed/rejected
            const totalInspected = passedUnits + rejectedUnits;
            const uninspected = item.quantity - totalInspected;
            
            // Delete original item if fully inspected, otherwise update quantity
            if (uninspected === 0) {
                await Database.deleteRecord('inventory', item.id);
            } else {
                await Database.update('inventory', item.id, {
                    quantity: uninspected,
                    updated_at: getLocalTimestamp()
                });
            }
            
            // Create passed units record if any
            if (passedUnits > 0) {
                const passedData = {
                    location_id: item.location_id,
                    assigned_crew_id: item.assigned_crew_id,
                    area_id: item.area_id,
                    item_type_id: item.item_type_id,
                    quantity: passedUnits,
                    status_id: availableStatus.id,
                    sloc_id: item.sloc_id
                };
                
                const passedResult = await Database.insert('inventory', passedData);
                
                // Create transaction for passed units
                await Queries.createTransaction({
                    inventory_id: passedResult.isOk ? passedResult.value[0].id : null,
                    transaction_type: 'Inspect',
                    action: 'Inspect',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: passedUnits,
                    old_status_name: oldStatus?.name || 'Unknown',
                    status_name: 'Available',
                    notes: `Inspection passed: ${passedUnits} units`
                });
            }
            
            // Create rejected units record if any
            if (rejectedUnits > 0) {
                const rejectedData = {
                    location_id: item.location_id,
                    assigned_crew_id: item.assigned_crew_id,
                    area_id: item.area_id,
                    item_type_id: item.item_type_id,
                    quantity: rejectedUnits,
                    status_id: rejectedStatus.id,
                    sloc_id: item.sloc_id
                };
                
                const rejectedResult = await Database.insert('inventory', rejectedData);
                
                // Create transaction for rejected units
                await Queries.createTransaction({
                    inventory_id: rejectedResult.isOk ? rejectedResult.value[0].id : null,
                    transaction_type: 'Inspect',
                    action: 'Inspect',
                    item_type_name: itemType?.name || 'Unknown',
                    quantity: rejectedUnits,
                    old_status_name: oldStatus?.name || 'Unknown',
                    status_name: 'Rejected',
                    notes: `Inspection rejected: ${rejectedUnits} units`
                });
            }
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            // Consolidate bulk items only
            if (isBulkItem) {
                const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
                if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                    console.log(`Consolidated ${consolidationResult.value.consolidated} groups`);
                }
            }
            
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        const totalInspected = passedUnits + rejectedUnits;
        Components.showToast(
            isBulkItem 
                ? `Inspected ${totalInspected} unit(s): ${passedUnits} passed, ${rejectedUnits} rejected`
                : 'Item inspected and marked as Available',
            'success'
        );
        
        // Refresh display
        if (document.querySelector('.hierarchy-container')) {
            refreshInventoryDisplay();
        } else if (byId('bulk-items-table-container')) {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing inspect action:', error);
        Components.showToast('Error inspecting material', 'error');
    }
}

// Show Remove Modal
function showRemoveModal(items, action) {
    const state = Store.getState();
    
    if (items.length !== 1) {
        Components.showToast('Remove action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const status = state.statuses.find(s => s.id === item.status_id);
    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
    const area = state.areas?.find(a => a.id === item.area_id);
    
    let selectedLocationId = null;
    let comment = '';
    
    // Get Outgoing location type
    const outgoingLocationType = state.locationTypes.find(lt => lt.name === 'Outgoing');
    
    if (!outgoingLocationType) {
        Components.showToast('Outgoing location type not found', 'error');
        return;
    }
    
    // Filter locations by Outgoing type (using loc_type_id from database schema)
    const outgoingLocations = (state.locations || []).filter(l => l.loc_type_id === outgoingLocationType.id);
    
    if (outgoingLocations.length === 0) {
        Components.showToast('No Outgoing locations available', 'error');
        return;
    }
    
    // Build item details section
    const itemDetails = div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            createElement('div', {}, [
                createElement('strong', {}, ['Item Type: ']),
                createElement('span', {}, [itemType?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Quantity: ']),
                createElement('span', {}, [String(item.quantity || 1)])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Current Location: ']),
                createElement('span', {}, [location?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Status: ']),
                createElement('span', {}, [status?.name || 'Unknown'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Crew: ']),
                createElement('span', {}, [crew?.name || 'Unassigned'])
            ]),
            createElement('div', {}, [
                createElement('strong', {}, ['Area: ']),
                createElement('span', {}, [area?.name || 'Unassigned'])
            ])
        ])
    ]);
    
    // Location dropdown
    const locationOptions = [
        createElement('option', { value: '' }, ['-- Select Outgoing Location --'])
    ];
    outgoingLocations.forEach(loc => {
        locationOptions.push(createElement('option', { value: String(loc.id) }, [loc.name]));
    });
    
    const locationDropdown = createElement('select', {
        id: 'remove-location-select',
        className: 'form-control',
        style: { fontSize: '18px', padding: '8px', width: '100%' },
        onchange: (e) => {
            selectedLocationId = e.target.value ? parseInt(e.target.value) : null;
        }
    }, locationOptions);
    
    const commentInput = createElement('textarea', {
        id: 'remove-comment-input',
        className: 'form-control',
        placeholder: 'Enter reason for removal (minimum 10 characters required)',
        rows: 2,
        style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' },
        oninput: (e) => {
            comment = e.target.value;
        }
    });
    
    const removalSection = div({ style: { marginBottom: '0.5rem' } }, [
        div({ style: { marginBottom: '0.75rem' } }, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Move To (Outgoing Location):']),
            locationDropdown
        ]),
        div({}, [
            createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Removal Reason (required, min 10 characters):']),
            commentInput
        ])
    ]);
    
    // Build modal content
    const modalContent = [
        itemDetails,
        removalSection
    ];
    
    const actions = [
        {
            label: 'Complete Removal',
            type: 'primary',
            handler: async () => {
                const locationSelect = document.getElementById('remove-location-select');
                const commentTextarea = document.getElementById('remove-comment-input');
                
                const finalLocationId = locationSelect.value ? parseInt(locationSelect.value) : null;
                const finalComment = commentTextarea.value.trim();
                
                if (!finalLocationId) {
                    Components.showToast('Please select an outgoing location', 'error');
                    return;
                }
                
                if (finalComment.length < 10) {
                    Components.showToast('Removal reason must be at least 10 characters long', 'error');
                    return;
                }
                
                await executeRemoveAction(item, finalLocationId, finalComment);
                Modals.close();
            }
        },
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        }
    ];
    
    const modal = Modals.create({
        title: 'Remove Material',
        content: modalContent,
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-focus location dropdown
    setTimeout(() => {
        const locationSelect = document.getElementById('remove-location-select');
        if (locationSelect) {
            locationSelect.focus();
        }
    }, 150);
}

// Execute Remove Action
async function executeRemoveAction(item, outgoingLocationId, comment) {
    const state = Store.getState();
    
    try {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const oldLocation = state.locations.find(l => l.id === item.location_id);
        const newLocation = state.locations.find(l => l.id === outgoingLocationId);
        
        if (!newLocation) {
            Components.showToast('Outgoing location not found', 'error');
            return;
        }
        
        // Get 'Removed' status
        const removedStatus = state.statuses.find(s => s.name === 'Removed');
        if (!removedStatus) {
            Components.showToast('Removed status not found', 'error');
            return;
        }
        
        // Update inventory location to outgoing location and status to 'Removed'
        await Database.update('inventory', item.id, {
            location_id: outgoingLocationId,
            status_id: removedStatus.id,
            updated_at: getLocalTimestamp()
        });
        
        // Create transaction
        await Queries.createTransaction({
            inventory_id: item.id,
            transaction_type: 'Remove',
            action: 'Remove',
            item_type_name: itemType?.name || 'Unknown',
            quantity: item.quantity || 1,
            from_location_name: oldLocation?.name || 'Unknown',
            to_location_name: newLocation.name,
            notes: comment
        });
        
        // Refresh inventory
        if (state.selectedSloc) {
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        Components.showToast(`Removed ${item.quantity || 1} item(s) to ${newLocation.name}`, 'success');
        
        // Refresh display
        if (document.querySelector('.hierarchy-container')) {
            refreshInventoryDisplay();
        } else if (byId('bulk-items-table-container')) {
            Views.render('receive-bulk');
        } else {
            Views.render(state.currentView);
        }
        
    } catch (error) {
        console.error('Error executing remove action:', error);
        Components.showToast('Error removing material', 'error');
    }
}

// Generate Issue Receipt PDF
async function generateIssuePDF(items, assignments, signaturePad) {
    const state = Store.getState();
    const { crew, area } = assignments;
    
    try {
        // Get and increment receipt number
        const configResult = await Queries.getConfig('lastReceiptNumber');
        let receiptNumber = 1;
        if (configResult.isOk) {
            receiptNumber = parseInt(configResult.value) + 1;
        }
        await Queries.setConfig('lastReceiptNumber', receiptNumber);
        
        const { PDFDocument, rgb, StandardFonts } = PDFLib;
        
        // Create PDF
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([612, 792]); // Letter size
        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        
        let yPosition = 750;
        
        // Header
        page.drawText('INVENTORY ISSUE RECEIPT', {
            x: 50,
            y: yPosition,
            size: 18,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        // Receipt Number
        yPosition -= 25;
        page.drawText(`Receipt #: ${String(receiptNumber).padStart(6, '0')}`, {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 30;
        page.drawText(`Date: ${new Date().toLocaleString()}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Crew: ${crew?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 20;
        page.drawText(`Area: ${area?.name || 'N/A'}`, {
            x: 50,
            y: yPosition,
            size: 10,
            font: font
        });
        
        yPosition -= 40;
        
        // Items header
        page.drawText('Items Issued:', {
            x: 50,
            y: yPosition,
            size: 12,
            font: boldFont
        });
        
        yPosition -= 25;
        
        // Table headers - removed Status column, more room for Item Type
        page.drawText('Item Type', { x: 50, y: yPosition, size: 9, font: boldFont });
        page.drawText('Serial/ID', { x: 300, y: yPosition, size: 9, font: boldFont });
        page.drawText('Qty', { x: 500, y: yPosition, size: 9, font: boldFont });
        
        yPosition -= 5;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 15;
        
        // Items
        const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const serialId = item.tilsonsn || item.mfgrsn || '-';
            
            // Truncate long item type names if needed
            const itemTypeName = itemType?.name || 'Unknown';
            const maxLength = 40;
            const displayName = itemTypeName.length > maxLength ? itemTypeName.substring(0, maxLength) + '...' : itemTypeName;
            
            page.drawText(displayName, { x: 50, y: yPosition, size: 9, font: font });
            page.drawText(serialId, { x: 300, y: yPosition, size: 9, font: font });
            page.drawText(String(item.quantity || 1), { x: 500, y: yPosition, size: 9, font: font });
            
            yPosition -= 15;
            
            if (yPosition < 150) break; // Leave space for signature
        }
        
        // Total
        yPosition -= 10;
        page.drawLine({
            start: { x: 50, y: yPosition },
            end: { x: 550, y: yPosition },
            thickness: 1,
            color: rgb(0, 0, 0)
        });
        
        yPosition -= 20;
        page.drawText(`Total Items: ${items.length}`, { x: 50, y: yPosition, size: 10, font: boldFont });
        page.drawText(`Total Quantity: ${totalQuantity}`, { x: 200, y: yPosition, size: 10, font: boldFont });
        
        // Signature
        if (signaturePad && !signaturePad.isEmpty()) {
            yPosition -= 60;
            page.drawText('Received By:', { x: 50, y: yPosition + 50, size: 10, font: boldFont });
            
            const signatureDataUrl = signaturePad.toDataURL();
            const signatureImageBytes = await fetch(signatureDataUrl).then(res => res.arrayBuffer());
            const signatureImage = await pdfDoc.embedPng(signatureImageBytes);
            
            page.drawImage(signatureImage, {
                x: 50,
                y: yPosition - 30,
                width: 200,
                height: 60
            });
        }
        
        // Save PDF
        const pdfBytes = await pdfDoc.save();
        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        
        // Download
        const a = document.createElement('a');
        a.href = url;
        a.download = `Issue_Receipt_${getLocalTimestamp().split('T')[0]}.pdf`;
        a.click();
        
        Components.showToast('PDF generated successfully', 'success');
        
    } catch (error) {
        console.error('Error generating PDF:', error);
        Components.showToast('Error generating PDF', 'error');
    }
}

function buildHierarchyFromData(hierarchicalInventory, state) {
    const categories = Object.keys(hierarchicalInventory).sort();
    
    if (categories.length === 0) {
        return Components.emptyState('No serialized inventory found', '🔢');
    }
    
    return div({ className: 'hierarchy-container' }, categories.map((categoryName, catIndex) => {
        const categoryId = `category-${catIndex}`;
        return div({ className: 'category-group' }, [
            // Collapsible category header
            div({ 
                className: 'category-header',
                onclick: (e) => {
                    const content = byId(categoryId);
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    e.target.querySelector('.collapse-icon').textContent = isHidden ? '▼' : '▶';
                }
            }, [
                createElement('span', {}, [categoryName]),
                createElement('span', { className: 'collapse-icon' }, ['▼'])
            ]),
            div({ id: categoryId, className: 'category-content' }, 
                Object.keys(hierarchicalInventory[categoryName]).sort().map(itemTypeName => {
                    const items = hierarchicalInventory[categoryName][itemTypeName];
                    
                    // Filter visible items for display
                    const visibleItems = items.filter(item => {
                        const status = state.statuses.find(s => s.id === item.status_id);
                        const savedVisibility = JSON.parse(localStorage.getItem('statusVisibility') || '{}');
                        const defaultVisible = ['Available', 'Issued', 'Rejected'].includes(status ? status.name : '');
                        const isVisible = savedVisibility[status ? status.name : ''] !== undefined 
                            ? savedVisibility[status.name] 
                            : defaultVisible;
                        return isVisible;
                    });
                    
                    // Skip this item type group if no visible items
                    if (visibleItems.length === 0) return null;
                    
                    return div({ className: 'item-type-group' }, [
                        div({ className: 'item-type-header' }, [
                            createElement('span', {}, [itemTypeName]),
                            createElement('span', { className: 'item-count-badge' }, [`${visibleItems.length} items`])
                        ]),
                        // Items table
                        createElement('table', { className: 'inventory-table' }, [
                            createElement('thead', {}, [
                                createElement('tr', {}, [
                                    createElement('th', {}, ['Location']),
                                    createElement('th', {}, ['Crew']),
                                    createElement('th', {}, ['Area']),
                                    createElement('th', {}, ['Mfgr. SN']),
                                    createElement('th', {}, ['Tilson SN']),
                                    createElement('th', {}, ['Quantity']),
                                    createElement('th', {}, ['Status'])
                                ])
                            ]),
                            createElement('tbody', {}, 
                                visibleItems.map(item => {
                                    const status = state.statuses.find(s => s.id === item.status_id);
                                    const location = state.locations.find(l => l.id === item.location_id);
                                    const crew = state.crews.find(c => c.id === item.assigned_crew_id);
                                    const area = item.area_id ? (state.areas || []).find(a => a.id === item.area_id) : null;
                                    
                                    // Get status colors from localStorage
                                    const getStatusColors = (statusName) => {
                                        const defaultColors = {
                                            'Available': { background: '#75c283', text: '#000000' },
                                            'Issued': { background: '#4099dd', text: '#ffffff' },
                                            'Rejected': { background: '#ed4545', text: '#000000' }
                                        };
                                        const colors = JSON.parse(localStorage.getItem('statusColors') || '{}');
                                        return colors[statusName] || defaultColors[statusName] || { background: '#ffffff', text: '#000000' };
                                    };
                                    const statusColors = getStatusColors(status ? status.name : 'Unknown');
                                    
                                    const isSelected = isSelectingForIssue && selectedItemsForIssue.some(i => i.id === item.id);
                                    
                                    const rowAttrs = {
                                        className: isSelectingForIssue ? 'selectable-row' : 'clickable-row',
                                        style: isSelected 
                                            ? { backgroundColor: '#bfdbfe', color: '#1e40af' } 
                                            : { backgroundColor: statusColors.background, color: statusColors.text }
                                    };
                                    
                                    if (isSelectingForIssue) {
                                        rowAttrs.onclick = () => toggleItemSelection(item);
                                    } else {
                                        rowAttrs.onclick = () => showInventoryActionsModal(item);
                                    }
                                    
                                    return createElement('tr', rowAttrs, [
                                        createElement('td', {}, [location ? location.name : '-']),
                                        createElement('td', {}, [crew ? crew.name : '-']),
                                        createElement('td', {}, [area ? area.name : '-']),
                                        createElement('td', { className: 'serial-number' }, [item.mfgrsn || '-']),
                                        createElement('td', { className: 'serial-number' }, [item.tilsonsn || '-']),
                                        createElement('td', {}, [String(item.quantity || 1)]),
                                        createElement('td', {}, [
                                            createElement('span', { className: 'status-badge' }, [status ? status.name : 'Unknown'])
                                        ])
                                    ]);
                                })
                            )
                        ])
                    ]);
                }).filter(item => item !== null)
            )
        ]);
    }));
}

// Generate SN prefix based on client, market, SLOC
function generateSNPrefix() {
    const state = Store.getState();
    
    let prefix = '';
    
    // Get first letter of client
    if (state.selectedClient) {
        prefix += state.selectedClient.name.charAt(0).toUpperCase();
    } else {
        prefix += 'X';
    }
    
    // Get first letter of market
    if (state.selectedMarket) {
        prefix += state.selectedMarket.name.charAt(0).toUpperCase();
    } else {
        prefix += 'X';
    }
    
    // Get first letter of SLOC
    if (state.selectedSloc) {
        prefix += state.selectedSloc.name.charAt(0).toUpperCase();
    } else {
        prefix += 'X';
    }
    
    return prefix;
}

// Generate full SN with sequence number
function generateSN(sequence) {
    const prefix = generateSNPrefix();
    const paddedSequence = String(sequence).padStart(6, '0');
    return `${prefix}-${paddedSequence}`;
}

// Handle batch count change
function handleBatchCountChange(value) {
    const count = parseInt(value) || 0;
    
    if (isManualEntryMode) {
        Components.showToast('Batch count disabled during manual entry', 'info');
        byId('batch_count').value = '';
        return;
    }
    
    if (count === 0) {
        // Reset to single empty row
        const state = Store.getState();
        const itemTypeId = byId('receive_item_type_id')?.value;
        if (itemTypeId) {
            const itemType = state.itemTypes.find(it => it.id === parseInt(itemTypeId));
            if (itemType) {
                batchEntries = [{
                    sn: generateSN(currentSNSequence + 1),
                    mfgrSn: '',
                    units: itemType.units_per_package
                }];
                renderBatchTable();
            }
        }
        return;
    }
    
    const state = Store.getState();
    const itemTypeId = byId('receive_item_type_id')?.value;
    if (!itemTypeId) {
        Components.showToast('Please select an item type first', 'warning');
        byId('batch_count').value = '';
        return;
    }
    
    const itemType = state.itemTypes.find(it => it.id === parseInt(itemTypeId));
    if (!itemType) return;
    
    // Generate batch entries
    batchEntries = [];
    for (let i = 0; i < count; i++) {
        batchEntries.push({
            sn: generateSN(currentSNSequence + i + 1),
            mfgrSn: '',
            units: itemType.units_per_package
        });
    }
    
    renderBatchTable();
}

// Clear batch table
function clearBatchTable() {
    const container = byId('batch-entry-container');
    if (container) {
        container.innerHTML = '';
        container.style.display = 'none';
    }
    batchEntries = [];
}

// Render batch entry table
function renderBatchTable(preserveFocus = false) {
    const container = byId('batch-entry-container');
    if (!container) return;
    
    if (batchEntries.length === 0) {
        container.innerHTML = '';
        container.style.display = 'none';
        return;
    }
    
    // Save focus information before re-rendering
    let focusedIndex = -1;
    let cursorPosition = 0;
    if (preserveFocus && document.activeElement && document.activeElement.classList.contains('mfgr-sn-input')) {
        const inputs = container.querySelectorAll('.mfgr-sn-input');
        inputs.forEach((input, idx) => {
            if (input === document.activeElement) {
                focusedIndex = idx;
                cursorPosition = input.selectionStart;
            }
        });
    }
    
    const table = createElement('table', { className: 'batch-entry-table' }, [
        createElement('thead', {}, [
            createElement('tr', {}, [
                createElement('th', {}, ['SN']),
                createElement('th', {}, ['Mfgr. SN']),
                createElement('th', {}, ['Units'])
            ])
        ]),
        createElement('tbody', {}, 
            batchEntries.map((entry, index) => createBatchRow(entry, index))
        )
    ]);
    
    container.innerHTML = '';
    container.appendChild(table);
    container.style.display = 'block';
    
    // Restore focus after rendering
    if (preserveFocus && focusedIndex >= 0) {
        const inputs = container.querySelectorAll('.mfgr-sn-input');
        if (inputs[focusedIndex]) {
            inputs[focusedIndex].focus();
            inputs[focusedIndex].setSelectionRange(cursorPosition, cursorPosition);
        }
    }
}

// Create a batch entry row
function createBatchRow(entry, index) {
    const row = createElement('tr', {
        onclick: (e) => {
            // Focus on Mfgr. SN input when row is clicked
            const mfgrInput = e.currentTarget.querySelector('.mfgr-sn-input');
            if (mfgrInput && document.activeElement !== mfgrInput) {
                mfgrInput.focus();
                // Place cursor at end
                const len = mfgrInput.value.length;
                mfgrInput.setSelectionRange(len, len);
            }
        }
    }, [
        createElement('td', { className: 'sn-cell' }, [entry.sn]),
        createElement('td', {}, [
            createElement('input', {
                type: 'text',
                className: 'mfgr-sn-input',
                value: entry.mfgrSn,
                placeholder: 'Enter Mfgr. SN',
                oninput: (e) => {
                    batchEntries[index].mfgrSn = e.target.value;
                    
                    // Enable manual entry mode and disable batch count
                    if (!isManualEntryMode && e.target.value.trim() !== '') {
                        isManualEntryMode = true;
                        const batchCountInput = byId('batch_count');
                        if (batchCountInput) {
                            batchCountInput.disabled = true;
                            batchCountInput.value = '';
                        }
                    }
                    
                    // Auto-create new row if this is the last row and user entered data
                    if (index === batchEntries.length - 1 && e.target.value.trim() !== '') {
                        const state = Store.getState();
                        const itemTypeId = byId('receive_item_type_id')?.value;
                        const itemType = state.itemTypes.find(it => it.id === parseInt(itemTypeId));
                        
                        if (itemType) {
                            const nextSequence = currentSNSequence + batchEntries.length + 1;
                            batchEntries.push({
                                sn: generateSN(nextSequence),
                                mfgrSn: '',
                                units: itemType.units_per_package
                            });
                            renderBatchTable(true); // Preserve focus
                        }
                    }
                },
                onclick: (e) => {
                    e.stopPropagation();
                }
            })
        ]),
        createElement('td', { className: 'units-cell' }, [
            createElement('span', {
                className: 'editable-units',
                ondblclick: (e) => {
                    e.stopPropagation();
                    const span = e.target;
                    const td = span.parentElement;
                    const currentValue = batchEntries[index].units;
                    
                    // Create input for editing
                    const input = createElement('input', {
                        type: 'text',
                        value: currentValue,
                        style: { width: '60px', textAlign: 'center' },
                        onkeypress: (e) => {
                            // Only allow digits 0-9
                            if (!/[0-9]/.test(e.key) && e.key !== 'Enter' && e.key !== 'Escape') {
                                e.preventDefault();
                            }
                        },
                        onblur: (e) => {
                            const newValue = parseInt(e.target.value) || currentValue;
                            batchEntries[index].units = Math.max(1, newValue);
                            renderBatchTable();
                        },
                        onkeydown: (e) => {
                            if (e.key === 'Enter') {
                                e.target.blur();
                            } else if (e.key === 'Escape') {
                                renderBatchTable();
                            }
                        }
                    });
                    
                    // Replace span with input
                    td.innerHTML = '';
                    td.appendChild(input);
                    input.focus();
                    input.select();
                }
            }, [String(entry.units)])
        ])
    ]);
    
    return row;
}

function resetReceiveForm() {
    const itemTypeSelect = byId('receive_item_type_id');
    const batchCountInput = byId('batch_count');
    const noteContainer = byId('units-per-package-note');
    
    if (itemTypeSelect) itemTypeSelect.value = '';
    if (batchCountInput) {
        batchCountInput.value = '';
        batchCountInput.disabled = false;
    }
    if (noteContainer) noteContainer.style.display = 'none';
    
    clearBatchTable();
    batchEntries = [];
    isManualEntryMode = false;
}

function resetIssueForm() {
    // Clear the old form fields (if they exist)
    const itemTypeSelect = byId('issue_item_type_id');
    const crewSelect = byId('issue_to_crew');
    const serialNumbersTextarea = byId('issue_serial_numbers');
    
    if (itemTypeSelect) itemTypeSelect.value = '';
    if (crewSelect) crewSelect.value = '';
    if (serialNumbersTextarea) serialNumbersTextarea.value = '';
    
    // Reset the issue process state
    isSelectingForIssue = false;
    selectedItemsForIssue = [];
    
    // Toggle UI states
    const initialState = byId('issue-initial-state');
    const selectionState = byId('issue-selection-state');
    
    if (initialState) initialState.style.display = 'block';
    if (selectionState) selectionState.style.display = 'none';
    
    // Clear crew/area selectors
    const selectorsDiv = byId('issue-crew-area-selectors');
    if (selectorsDiv) selectorsDiv.innerHTML = '';
    
    // Remove visual indicator from inventory section
    const rightColumn = document.querySelector('.right-column');
    if (rightColumn) {
        rightColumn.classList.remove('selection-mode');
    }
    
    // Close the accordion
    const issueContent = byId('issue-accordion-content');
    if (issueContent) {
        issueContent.style.display = 'none';
    }
}

function processBulkReceive() {
    Components.showToast('Bulk receive functionality coming soon', 'info');
}

function clearReceiveForm() {
    const form = byId('receive-serialized-form') || byId('receive-bulk-form');
    if (form) {
        const formEl = form.querySelector('form') || form;
        if (formEl.tagName === 'FORM') {
            formEl.reset();
        }
    }
}

// Helper function to refresh transactions list
async function refreshTransactionsList() {
    const transactionsResult = await Queries.getAllTransactions();
    if (transactionsResult.isOk) {
        Store.setState({ transactions: transactionsResult.value });
    }
}

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

// Enable inline editing for item type row
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

// Save crew inline edit
async function saveCrewInlineEdit(row, crewId, editCells, originalHTML) {
    try {
        const updatedCrew = {
            name: editCells[0].value.trim(),
            market_id: parseInt(editCells[1].value) || null,
            information: editCells[2].value.trim() || null,
            updated_at: getLocalTimestamp()
        };
        
        // Validate required fields
        if (!updatedCrew.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        if (!updatedCrew.market_id) {
            Components.showToast('Market is required', 'error');
            editCells[1].focus();
            return;
        }
        
        // Update the crew (DB wrapper auto-refreshes cached tables)
        const result = await DB.update('crews', crewId, updatedCrew);
        
        if (!result.isOk) {
            Components.showToast('Error updating crew', 'error');
            return;
        }
        
        // Explicitly wait for cache refresh to complete
        await refreshCachedTable('crews');
        
        Components.showToast('Crew updated successfully', 'success');
        
        // Re-enable Add button
        const addBtn = byId('add-crew-btn');
        if (addBtn) addBtn.disabled = false;
        
        // Refresh the view
        Views.render('manage-crews');
        
    } catch (error) {
        console.error('Error updating crew:', error);
        Components.showToast('Error updating crew', 'error');
    }
}

// Delete crew record
async function deleteCrewRecord(crew) {
    // Check if crew is in use
    if (crew.useCount > 0) {
        Components.showToast(
            `Cannot delete crew "${crew.name}" - it has ${crew.useCount} inventory item(s) assigned to it.`,
            'error'
        );
        return;
    }
    
    // Confirm deletion
    const confirmed = confirm(`Are you sure you want to delete crew "${crew.name}"?`);
    if (!confirmed) return;
    
    try {
        const result = await DB.delete('crews', crew.id);
        
        if (!result.isOk) {
            Components.showToast('Error deleting crew', 'error');
            return;
        }
        
        // Explicitly wait for cache refresh to complete
        await refreshCachedTable('crews');
        
        Components.showToast('Crew deleted successfully', 'success');
        
        // Refresh the view
        Views.render('manage-crews');
        
    } catch (error) {
        console.error('Error deleting crew:', error);
        Components.showToast('Error deleting crew', 'error');
    }
}

function showAddCrewModal() {
    Components.showToast('Add crew functionality coming soon', 'info');
}

function showEditCrewModal(crew) {
    console.log('Edit crew:', crew);
}

// ============ HIERARCHY MANAGEMENT FUNCTIONS (Clients/Markets/SLOCs/Areas) ============

// Render Clients Section
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

// Generic hierarchy row selection handler
function handleHierarchyRowSelection(row, type) {
    const isCurrentlySelected = row.classList.contains('selected');
    
    // Deselect all rows of this type
    document.querySelectorAll(`.${type}-row`).forEach(r => r.classList.remove('selected'));
    
    // Toggle selection
    if (!isCurrentlySelected) {
        row.classList.add('selected');
    }
    
    // Update button states
    const editBtn = byId(`edit-${type}-btn`);
    const deleteBtn = byId(`delete-${type}-btn`);
    
    if (!isCurrentlySelected) {
        if (editBtn) editBtn.disabled = false;
        if (deleteBtn) deleteBtn.disabled = false;
    } else {
        if (editBtn) editBtn.disabled = true;
        if (deleteBtn) deleteBtn.disabled = true;
    }
}

// ============ CLIENTS CRUD FUNCTIONS ============

function showAddClientRow() {
    const state = Store.getState();
    const table = byId('clients-table');
    
    if (!table) {
        Components.showToast('Table not found', 'error');
        return;
    }
    
    const existingAddRow = document.querySelector('.client-add-row');
    if (existingAddRow) {
        Components.showToast('Already adding a new client', 'warning');
        return;
    }
    
    const tbody = table.querySelector('tbody');
    if (!tbody) return;
    
    const editCells = [
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            placeholder: 'Client name',
            style: { width: '100%' }
        }),
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            placeholder: 'Address (optional)',
            style: { width: '100%' }
        }),
        createElement('div', { style: { textAlign: 'center', color: '#999' } }, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' } }, ['-'])
    ];
    
    const addRow = createElement('tr', {
        className: 'client-row hierarchy-row client-add-row editing',
        style: { cursor: 'default' }
    }, editCells.map(cell => createElement('td', {}, [cell])));
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' } }, [
            createElement('button', {
                className: 'btn btn-sm btn-secondary',
                style: { marginRight: '0.5rem' },
                onclick: () => {
                    addRow.remove();
                    actionRow.remove();
                    const addBtn = byId('add-client-btn');
                    if (addBtn) addBtn.disabled = false;
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveNewClient(editCells, addRow, actionRow)
            }, ['Create Client'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    
    const addBtn = byId('add-client-btn');
    if (addBtn) addBtn.disabled = true;
    
    editCells[0].focus();
    addRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function saveNewClient(editCells, addRow, actionRow) {
    try {
        const newClient = {
            name: editCells[0].value.trim(),
            address: editCells[1].value.trim() || null
        };
        
        if (!newClient.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        
        newClient.created_at = getLocalTimestamp();
        newClient.updated_at = getLocalTimestamp();
        
        const result = await DB.insert('clients', newClient);
        
        if (!result.isOk) {
            Components.showToast('Error creating client', 'error');
            return;
        }
        
        await refreshCachedTable('clients');
        
        // Refresh hierarchy dropdowns
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('Client created successfully', 'success');
        
        addRow.remove();
        actionRow.remove();
        
        Views.render('manage-areas');
        
    } catch (error) {
        console.error('Error creating client:', error);
        Components.showToast('Error creating client', 'error');
    }
}

function enableClientInlineEdit(row, client, state) {
    if (row.classList.contains('editing')) return;
    
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    
    const editCells = [
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input required-field',
            value: client.name || '',
            style: { width: '100%' }
        }),
        createElement('input', {
            type: 'text',
            className: 'inline-edit-input',
            value: client.address || '',
            style: { width: '100%' }
        }),
        createElement('div', { style: { textAlign: 'center', color: '#666' } }, [String(client.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' } }, [
            new Date(client.created_at).toLocaleDateString()
        ])
    ];
    
    cells.forEach((cell, index) => {
        cell.innerHTML = '';
        cell.appendChild(editCells[index]);
    });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' } }, [
            createElement('button', {
                className: 'btn btn-sm btn-secondary',
                style: { marginRight: '0.5rem' },
                onclick: () => {
                    row.classList.remove('editing');
                    row.classList.remove('selected');
                    row.innerHTML = originalHTML;
                    actionRow.remove();
                    row.onclick = function() {
                        handleHierarchyRowSelection(this, 'client');
                    };
                    const editBtn = byId('edit-client-btn');
                    const deleteBtn = byId('delete-client-btn');
                    const addBtn = byId('add-client-btn');
                    if (editBtn) editBtn.disabled = true;
                    if (deleteBtn) deleteBtn.disabled = true;
                    if (addBtn) addBtn.disabled = false;
                }
            }, ['Cancel']),
            createElement('button', {
                className: 'btn btn-sm btn-primary',
                onclick: () => saveClientInlineEdit(row, client.id, editCells, originalHTML)
            }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    
    const editBtn = byId('edit-client-btn');
    const deleteBtn = byId('delete-client-btn');
    const addBtn = byId('add-client-btn');
    if (editBtn) editBtn.disabled = true;
    if (deleteBtn) deleteBtn.disabled = true;
    if (addBtn) addBtn.disabled = true;
}

async function saveClientInlineEdit(row, clientId, editCells, originalHTML) {
    try {
        const updatedClient = {
            name: editCells[0].value.trim(),
            address: editCells[1].value.trim() || null,
            updated_at: getLocalTimestamp()
        };
        
        if (!updatedClient.name) {
            Components.showToast('Name is required', 'error');
            editCells[0].focus();
            return;
        }
        
        const result = await DB.update('clients', clientId, updatedClient);
        
        if (!result.isOk) {
            Components.showToast('Error updating client', 'error');
            return;
        }
        
        await refreshCachedTable('clients');
        
        Components.showToast('Client updated successfully', 'success');
        
        const addBtn = byId('add-client-btn');
        if (addBtn) addBtn.disabled = false;
        
        Views.render('manage-areas');
        
    } catch (error) {
        console.error('Error updating client:', error);
        Components.showToast('Error updating client', 'error');
    }
}

async function deleteClientRecord(client) {
    if (client.useCount > 0) {
        Components.showToast(
            `Cannot delete client "${client.name}" - it has ${client.useCount} market(s) associated with it.`,
            'error'
        );
        return;
    }
    
    const confirmed = confirm(`Are you sure you want to delete client "${client.name}"?`);
    if (!confirmed) return;
    
    try {
        const result = await DB.delete('clients', client.id);
        
        if (!result.isOk) {
            Components.showToast('Error deleting client', 'error');
            return;
        }
        
        await refreshCachedTable('clients');
        
        Components.showToast('Client deleted successfully', 'success');
        
        Views.render('manage-areas');
        
    } catch (error) {
        console.error('Error deleting client:', error);
        Components.showToast('Error deleting client', 'error');
    }
}

// ============ MARKETS CRUD FUNCTIONS ============

function showAddMarketRow() {
    const state = Store.getState();
    const table = byId('markets-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.market-add-row')) return Components.showToast('Already adding a new market', 'warning');
    
    const tbody = table.querySelector('tbody');
    const clients = state.clients || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'Market name', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Client --']),
            ...clients.map(c => createElement('option', { value: c.id }, [c.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'market-row hierarchy-row market-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-market-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewMarket(editCells, addRow, actionRow) }, ['Create Market'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-market-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewMarket(editCells, addRow, actionRow) {
    try {
        const newMarket = {
            name: editCells[0].value.trim(),
            client_id: parseInt(editCells[1].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newMarket.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newMarket.client_id) return Components.showToast('Client is required', 'error'), editCells[1].focus();
        
        const result = await DB.insert('markets', newMarket);
        if (!result.isOk) return Components.showToast('Error creating market', 'error');
        
        await refreshCachedTable('markets');
        
        // Refresh hierarchy dropdowns
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('Market created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating market:', error);
        Components.showToast('Error creating market', 'error');
    }
}

function enableMarketInlineEdit(row, market, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const clients = state.clients || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: market.name || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Client --']),
            ...clients.map(c => createElement('option', { value: c.id, selected: c.id === market.client_id }, [c.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(market.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(market.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'market'); };
                ['edit-market-btn', 'delete-market-btn'].forEach(id => byId(id).disabled = true);
                byId('add-market-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveMarketInlineEdit(row, market.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-market-btn', 'delete-market-btn', 'add-market-btn'].forEach(id => byId(id).disabled = true);
}

async function saveMarketInlineEdit(row, marketId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), client_id: parseInt(editCells[1].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.client_id) return Components.showToast('Client is required', 'error'), editCells[1].focus();
        
        const result = await DB.update('markets', marketId, updated);
        if (!result.isOk) return Components.showToast('Error updating market', 'error');
        
        await refreshCachedTable('markets');
        Components.showToast('Market updated successfully', 'success');
        byId('add-market-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating market:', error);
        Components.showToast('Error updating market', 'error');
    }
}

async function deleteMarketRecord(market) {
    // Check for SLOC associations
    if (market.useCount > 0) {
        return Components.showToast(
            `Cannot delete market "${market.name}" - it has ${market.useCount} SLOC(s).`,
            'error'
        );
    }
    
    // Check for crew associations
    const crewsResult = await Queries.getCrewsByMarket(market.id);
    if (crewsResult.isOk && crewsResult.value.length > 0) {
        const crewNames = crewsResult.value.map(c => c.name).join(', ');
        return Components.showToast(
            `Cannot delete market "${market.name}" - it has ${crewsResult.value.length} crew(s): ${crewNames}`,
            'error'
        );
    }
    
    if (!confirm(`Delete market "${market.name}"?`)) return;
    
    try {
        const result = await DB.delete('markets', market.id);
        if (!result.isOk) return Components.showToast('Error deleting market', 'error');
        
        await refreshCachedTable('markets');
        Components.showToast('Market deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'markets' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting market:', error);
        Components.showToast('Error deleting market', 'error');
    }
}

// ============ SLOCS CRUD FUNCTIONS ============

function showAddSlocRow() {
    const state = Store.getState();
    const table = byId('slocs-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.sloc-add-row')) return Components.showToast('Already adding a new SLOC', 'warning');
    
    const tbody = table.querySelector('tbody');
    const markets = state.markets || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'SLOC name', style: { width: '100%' }}),
        createElement('input', { type: 'text', className: 'inline-edit-input', placeholder: 'Address (optional)', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => createElement('option', { value: m.id }, [m.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'sloc-row hierarchy-row sloc-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-sloc-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewSloc(editCells, addRow, actionRow) }, ['Create SLOC'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-sloc-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewSloc(editCells, addRow, actionRow) {
    try {
        const newSloc = {
            name: editCells[0].value.trim(),
            address: editCells[1].value.trim() || null,
            market_id: parseInt(editCells[2].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newSloc.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newSloc.market_id) return Components.showToast('Market is required', 'error'), editCells[2].focus();
        
        const result = await DB.insert('slocs', newSloc);
        if (!result.isOk) return Components.showToast('Error creating SLOC', 'error');
        
        await refreshCachedTable('slocs');
        
        // Refresh hierarchy dropdowns
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('SLOC created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating SLOC:', error);
        Components.showToast('Error creating SLOC', 'error');
    }
}

function enableSlocInlineEdit(row, sloc, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const markets = state.markets || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: sloc.name || '', style: { width: '100%' }}),
        createElement('input', { type: 'text', className: 'inline-edit-input', value: sloc.address || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select Market --']),
            ...markets.map(m => createElement('option', { value: m.id, selected: m.id === sloc.market_id }, [m.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(sloc.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(sloc.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '5', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'sloc'); };
                ['edit-sloc-btn', 'delete-sloc-btn'].forEach(id => byId(id).disabled = true);
                byId('add-sloc-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveSlocInlineEdit(row, sloc.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-sloc-btn', 'delete-sloc-btn', 'add-sloc-btn'].forEach(id => byId(id).disabled = true);
}

async function saveSlocInlineEdit(row, slocId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), address: editCells[1].value.trim() || null, market_id: parseInt(editCells[2].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.market_id) return Components.showToast('Market is required', 'error'), editCells[2].focus();
        
        const result = await DB.update('slocs', slocId, updated);
        if (!result.isOk) return Components.showToast('Error updating SLOC', 'error');
        
        await refreshCachedTable('slocs');
        Components.showToast('SLOC updated successfully', 'success');
        byId('add-sloc-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating SLOC:', error);
        Components.showToast('Error updating SLOC', 'error');
    }
}

async function deleteSlocRecord(sloc) {
    if (sloc.useCount > 0) return Components.showToast(`Cannot delete SLOC "${sloc.name}" - it has ${sloc.useCount} area(s).`, 'error');
    if (!confirm(`Delete SLOC "${sloc.name}"?`)) return;
    
    try {
        const result = await DB.delete('slocs', sloc.id);
        if (!result.isOk) return Components.showToast('Error deleting SLOC', 'error');
        
        await refreshCachedTable('slocs');
        Components.showToast('SLOC deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'slocs' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting SLOC:', error);
        Components.showToast('Error deleting SLOC', 'error');
    }
}

// ============ AREAS CRUD FUNCTIONS ============

function showAddAreaRow() {
    const state = Store.getState();
    const table = byId('areas-table');
    if (!table) return Components.showToast('Table not found', 'error');
    if (document.querySelector('.area-add-row')) return Components.showToast('Already adding a new area', 'warning');
    
    const tbody = table.querySelector('tbody');
    const slocs = state.slocs || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', placeholder: 'Area name', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select SLOC --']),
            ...slocs.map(s => createElement('option', { value: s.id }, [s.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-']),
        createElement('div', { style: { textAlign: 'center', color: '#999' }}, ['-'])
    ];
    
    const addRow = createElement('tr', { className: 'area-row hierarchy-row area-add-row editing' }, editCells.map(cell => createElement('td', {}, [cell])));
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => { addRow.remove(); actionRow.remove(); byId('add-area-btn').disabled = false; }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveNewArea(editCells, addRow, actionRow) }, ['Create Area'])
        ])
    ]);
    
    tbody.appendChild(addRow);
    tbody.appendChild(actionRow);
    byId('add-area-btn').disabled = true;
    editCells[0].focus();
}

async function saveNewArea(editCells, addRow, actionRow) {
    try {
        const newArea = {
            name: editCells[0].value.trim(),
            sloc_id: parseInt(editCells[1].value) || null,
            created_at: getLocalTimestamp(),
            updated_at: getLocalTimestamp()
        };
        
        if (!newArea.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!newArea.sloc_id) return Components.showToast('SLOC is required', 'error'), editCells[1].focus();
        
        const result = await DB.insert('areas', newArea);
        if (!result.isOk) return Components.showToast('Error creating area', 'error');
        
        await refreshCachedTable('areas');
        
        // Refresh hierarchy dropdowns (areas don't appear in nav but good to be consistent)
        if (typeof refreshHierarchyDropdowns === 'function') {
            await refreshHierarchyDropdowns();
        }
        
        Components.showToast('Area created successfully', 'success');
        addRow.remove();
        actionRow.remove();
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error creating area:', error);
        Components.showToast('Error creating area', 'error');
    }
}

function enableAreaInlineEdit(row, area, state) {
    if (row.classList.contains('editing')) return;
    row.classList.add('editing');
    const originalHTML = row.innerHTML;
    const cells = row.querySelectorAll('td');
    const slocs = state.slocs || [];
    
    const editCells = [
        createElement('input', { type: 'text', className: 'inline-edit-input required-field', value: area.name || '', style: { width: '100%' }}),
        createElement('select', { className: 'inline-edit-select required-field', style: { width: '100%' }}, [
            createElement('option', { value: '' }, ['-- Select SLOC --']),
            ...slocs.map(s => createElement('option', { value: s.id, selected: s.id === area.sloc_id }, [s.name]))
        ]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [String(area.useCount)]),
        createElement('div', { style: { textAlign: 'center', color: '#666' }}, [new Date(area.created_at).toLocaleDateString()])
    ];
    
    cells.forEach((cell, index) => { cell.innerHTML = ''; cell.appendChild(editCells[index]); });
    
    const actionRow = createElement('tr', { className: 'edit-actions-row' }, [
        createElement('td', { colspan: '4', style: { textAlign: 'right', padding: '0.5rem', backgroundColor: '#f9fafb' }}, [
            createElement('button', { className: 'btn btn-sm btn-secondary', style: { marginRight: '0.5rem' }, onclick: () => {
                row.classList.remove('editing', 'selected');
                row.innerHTML = originalHTML;
                actionRow.remove();
                row.onclick = function() { handleHierarchyRowSelection(this, 'area'); };
                ['edit-area-btn', 'delete-area-btn'].forEach(id => byId(id).disabled = true);
                byId('add-area-btn').disabled = false;
            }}, ['Cancel']),
            createElement('button', { className: 'btn btn-sm btn-primary', onclick: () => saveAreaInlineEdit(row, area.id, editCells) }, ['Save Changes'])
        ])
    ]);
    
    row.parentNode.insertBefore(actionRow, row.nextSibling);
    row.onclick = null;
    ['edit-area-btn', 'delete-area-btn', 'add-area-btn'].forEach(id => byId(id).disabled = true);
}

async function saveAreaInlineEdit(row, areaId, editCells) {
    try {
        const updated = { name: editCells[0].value.trim(), sloc_id: parseInt(editCells[1].value) || null, updated_at: getLocalTimestamp() };
        if (!updated.name) return Components.showToast('Name is required', 'error'), editCells[0].focus();
        if (!updated.sloc_id) return Components.showToast('SLOC is required', 'error'), editCells[1].focus();
        
        const result = await DB.update('areas', areaId, updated);
        if (!result.isOk) return Components.showToast('Error updating area', 'error');
        
        await refreshCachedTable('areas');
        Components.showToast('Area updated successfully', 'success');
        byId('add-area-btn').disabled = false;
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error updating area:', error);
        Components.showToast('Error updating area', 'error');
    }
}

async function deleteAreaRecord(area) {
    if (area.useCount > 0) return Components.showToast(`Cannot delete area "${area.name}" - it is in use.`, 'error');
    if (!confirm(`Delete area "${area.name}"?`)) return;
    
    try {
        const result = await DB.delete('areas', area.id);
        if (!result.isOk) return Components.showToast('Error deleting area', 'error');
        
        await refreshCachedTable('areas');
        Components.showToast('Area deleted successfully', 'success');
        Store.setState({ hierarchyTableSelection: 'areas' });
        Views.render('manage-areas');
    } catch (error) {
        console.error('Error deleting area:', error);
        Components.showToast('Error deleting area', 'error');
    }
}

// Export Views module public API
return {
    render
};

})();

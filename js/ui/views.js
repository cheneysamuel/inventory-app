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
        
        // Use service to process inventory data
        const bulkInventory = InventoryProcessing.getBulkInventory(state.inventory, state.itemTypes);
        const consolidatedRows = InventoryProcessing.consolidateBulkRows(bulkInventory, state);
        const visibleRows = InventoryProcessing.filterVisibleRows(consolidatedRows);
        
        const content = div({}, [
            Components.pageHeader(
                'Manage Bulk Items', 
                'View and manage bulk inventory items'
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
                ? (() => {
                    // Create table from template
                    const tableClone = cloneTemplate('data-table-template');
                    if (!tableClone) {
                        throw new Error('Failed to load data-table-template. Check that templates are defined in index.html');
                    }
                    
                    const table = tableClone.querySelector('table');
                    if (!table) {
                        throw new Error('Table element not found in data-table-template');
                    }
                    
                    table.id = 'manage-bulk-table';
                    table.style.width = '100%';
                    
                    // Build header
                    const headerRow = table.querySelector('[data-bind="header-row"]');
                    if (!headerRow) {
                        throw new Error('Header row element not found in data-table-template');
                    }
                    
                    ['Location', 'Crew', 'Area', 'Item', 'Category', 'Quantity', 'Status'].forEach(header => {
                        headerRow.appendChild(createElement('th', {}, [header]));
                    });
                    
                    // Build body
                    const tbody = table.querySelector('[data-bind="table-body"]');
                    if (!tbody) {
                        throw new Error('Table body element not found in data-table-template');
                    }
                    
                    visibleRows.forEach(row => {
                        const statusColors = InventoryProcessing.getStatusColors(row.status ? row.status.name : 'Unknown');
                        
                        const tr = createElement('tr', {
                            className: 'clickable-row',
                            style: {
                                backgroundColor: statusColors.background,
                                color: statusColors.text
                            },
                            onclick: () => {
                                // If multiple items, show list; otherwise show single item
                                if (row.items.length === 1) {
                                    InventoryModals.showInventoryActions(row.items[0]);
                                } else {
                                    InventoryModals.showConsolidatedItems(row);
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
                        tbody.appendChild(tr);
                    });
                    
                    return table;
                })()
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
        
        // Use service to get and organize serialized inventory
        const serializedInventory = InventoryProcessing.getSerializedInventory(state.inventory, state.itemTypes);
        const hierarchicalInventory = InventoryProcessing.buildHierarchicalInventory(
            serializedInventory, 
            state.itemTypes, 
            state.categories
        );
        const visibleHierarchy = InventoryProcessing.filterHierarchicalByVisibility(
            hierarchicalInventory,
            state.statuses
        );
        
        // Use ReceiveSerializedHelpers for hierarchy building and filtering
        const buildHierarchy = () => ReceiveSerializedHelpers.buildHierarchy(visibleHierarchy, state);
        const filterSerializedHierarchy = (searchTerm) => ReceiveSerializedHelpers.filterSerializedHierarchy(searchTerm);
        
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
    
    
    // Receive bulk items view
    /**
     * Receive Bulk View
     * Refactored to use helper modules for improved maintainability:
     * - BulkReceiveHelpers: Data filtering, transformation, table rendering
     * - BulkReceiveProcess: Receive/issue workflow logic
     * - BulkIssueUI: Issue modal and PDF generation
     */
    const receiveBulk = () => {
        const state = Store.getState();
        
        // Use helper to get filtered bulk item types
        const bulkItemTypes = BulkReceiveHelpers.getFilteredBulkItemTypes(state.itemTypes, state);
        
        // Use helper to build table data with aggregated quantities
        const tableData = BulkReceiveHelpers.buildBulkTableData(bulkItemTypes, state);
        
        const content = div({}, [
            Components.pageHeader('Manage Bulk Items', 'Receive, issue, and view bulk inventory'),
            
            // Process buttons (horizontal layout)
            div({ style: { display: 'flex', gap: '1rem', marginBottom: '1.5rem' } }, [
                BulkReceiveHelpers.createReceiveSection(),
                BulkReceiveHelpers.createIssueSection()
            ]),
            
            // Search and table section
            div({ style: { marginTop: '1.5rem' } }, [
                BulkReceiveHelpers.createSearchBar(BulkReceiveHelpers.filterBulkTable),
                
                // Bulk items table container
                div({ id: 'bulk-items-table-container' }, [
                    BulkReceiveHelpers.renderBulkItemsTable(tableData, false, false)
                ])
            ])
        ]);
        
        return content;
    };
    
    // Export Data view
    const exportData = () => {
        const state = Store.getState();
        
        // Use ExportDataHelpers for all handler functions
        const buildExportForm = () => ExportDataHelpers.buildExportForm(state);
        const handleReset = () => ExportDataHelpers.handleReset(state);
        const handleExport = () => ExportDataHelpers.handleExport(state);
        
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
        
        // Use TransactionsHelpers for all functionality
        const searchInputId = 'transaction-search-input';
        const tableContainerId = 'transaction-table-container';
        
        const handleSearch = () => TransactionsHelpers.handleSearch(searchInputId, tableContainerId, filteredTransactions, state);
        
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
                        columns: TransactionsHelpers.getTableColumns(state),
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
        
        // Use service to build enhanced item types data
        const enhancedData = InventoryProcessing.buildEnhancedItemTypes(state.itemTypes, state);
        
        const hasItems = state.itemTypes.length > 0;
        
        // Use ManageItemsHelpers for all handler functions
        const toggleDuplicateHighlighting = () => ManageItemsHelpers.toggleDuplicateHighlighting();
        const toggleUniqueRows = () => ManageItemsHelpers.toggleUniqueRows();
        const setMoveFromItem = () => ManageItemsHelpers.setMoveFromItem();
        const setMoveToItem = () => ManageItemsHelpers.setMoveToItem();
        const clearMoveSelection = () => ManageItemsHelpers.clearMoveSelection();
        const executeMoveInventory = () => ManageItemsHelpers.executeMoveInventory();
        const filterItemTypes = (searchTerm) => ManageItemsHelpers.filterItemTypes(searchTerm);
        const handleItemTypeRowSelection = (itemId, useCount) => ManageItemsHelpers.handleItemTypeRowSelection(itemId, useCount);
        const confirmDeleteItemType = (item) => ManageItemsHelpers.confirmDeleteItemType(item);
        const enterBulkMarketAssignMode = () => ManageItemsHelpers.enterBulkMarketAssignMode();
        const handleBulkMarketSelection = (marketId) => ManageItemsHelpers.handleBulkMarketSelection(marketId);
        const applyBulkMarketAssignments = () => ManageItemsHelpers.applyBulkMarketAssignments();
        const exitBulkMarketAssignMode = () => ManageItemsHelpers.exitBulkMarketAssignMode();
        
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
                        (() => {
                            // Create table from template
                            const tableClone = cloneTemplate('item-types-table-template');
                            if (!tableClone) {
                                throw new Error('Failed to load item-types-table-template');
                            }
                            
                            const table = tableClone.querySelector('table');
                            if (!table) {
                                throw new Error('Table element not found in item-types-table-template');
                            }
                            
                            const tbody = table.querySelector('[data-bind="table-body"]');
                            if (!tbody) {
                                throw new Error('Table body not found in item-types-table-template');
                            }
                            
                            // Populate rows
                            enhancedData.forEach(item => {
                                const tr = createElement('tr', {
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
                                ]);
                                tbody.appendChild(tr);
                            });
                            
                            return table;
                        })()
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
        
        // Use PreferencesHelpers for all handler functions
        const showPreferenceSection = (sectionId) => PreferencesHelpers.showPreferenceSection(sectionId, isAdmin);
        const handleClearItemTypes = () => PreferencesHelpers.handleClearItemTypes();
        const handleClearInventory = () => PreferencesHelpers.handleClearInventory();
        const handleClearTransactions = () => PreferencesHelpers.handleClearTransactions();
        const handleClearSequentials = () => PreferencesHelpers.handleClearSequentials();
        const handleEditConfigValue = (key, value) => PreferencesHelpers.handleEditConfigValue(key, value);
        const handleDeleteConfigKey = (key) => PreferencesHelpers.handleDeleteConfigKey(key);
        const handleOpenSupabaseDashboard = () => PreferencesHelpers.handleOpenSupabaseDashboard();
        const handleBulkExport = () => PreferencesHelpers.handleBulkExport();
        
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

// Export Views module public API
return {
    render,
    generateSN,
    generateSNPrefix
};

})();

// Expose globally for cross-module access
window.generateSN = Views.generateSN;
window.generateSNPrefix = Views.generateSNPrefix;

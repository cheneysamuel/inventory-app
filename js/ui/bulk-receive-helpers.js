/**
 * Bulk Receive Helper Functions
 * Extracted from receiveBulk view to improve maintainability
 * 
 * This module contains pure functions for filtering, transforming, and rendering
 * bulk inventory data. Functions are organized into logical groups:
 * - Data Filtering: getFilteredBulkItemTypes, filterDataByMode
 * - Data Transformation: buildBulkTableData
 * - Table Rendering: renderBulkItemsTable, createTableRow
 * - UI Sections: createReceiveSection, createIssueSection, createSearchBar
 * - Table Filtering: filterBulkTable
 */

const BulkReceiveHelpers = (() => {
    
    // ==================== DATA FILTERING ====================
    
    /**
     * Filter bulk item types by selected market
     * @param {Array} itemTypes - All item types
     * @param {Object} state - Application state
     * @returns {Array} Filtered bulk item types
     */
    const getFilteredBulkItemTypes = (itemTypes, state) => {
        let bulkItemTypes = itemTypes.filter(it => it.inventory_type_id === 2);
        
        if (state.selectedMarket && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === state.selectedMarket.id)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        return bulkItemTypes;
    };
    
    /**
     * Filter table data based on mode
     * @param {Array} tableData - Table data
     * @param {boolean} issueMode - Whether in issue mode
     * @returns {Array} Filtered data
     */
    const filterDataByMode = (tableData, issueMode) => {
        if (issueMode) {
            return tableData.filter(item => item.availableQty > 0);
        }
        return tableData;
    };
    
    // ==================== DATA TRANSFORMATION ====================
    
    /**
     * Aggregate inventory quantities by status for a single item type
     * @param {Array} itemInventory - Inventory records for item type
     * @param {Object} statuses - Status lookup { available, issued, installed, rejected }
     * @returns {Object} Quantity totals by status
     */
    const aggregateQuantitiesByStatus = (itemInventory, statuses) => {
        return {
            availableQty: itemInventory
                .filter(inv => inv.status_id === statuses.available?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            issuedQty: itemInventory
                .filter(inv => inv.status_id === statuses.issued?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            installedQty: itemInventory
                .filter(inv => inv.status_id === statuses.installed?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            rejectedQty: itemInventory
                .filter(inv => inv.status_id === statuses.rejected?.id)
                .reduce((sum, inv) => sum + (inv.quantity || 0), 0)
        };
    };
    
    /**
     * Enrich item type with related entity names
     * @param {Object} itemType - Item type object
     * @param {Object} state - Application state
     * @returns {Object} Enriched item type
     */
    const enrichItemTypeWithRelations = (itemType, state) => {
        const category = state.categories?.find(c => c.id === itemType.category_id);
        const uom = state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id);
        const provider = state.providers?.find(p => p.id === itemType.provider_id);
        
        return {
            categoryName: category?.name || '-',
            uomName: uom?.name || '-',
            providerName: provider?.name || '-'
        };
    };
    
    /**
     * Build bulk table data with aggregated quantities by status
     * @param {Array} itemTypes - Bulk item types
     * @param {Object} state - Application state
     * @returns {Array} Enhanced item data with quantities
     */
    const buildBulkTableData = (itemTypes, state) => {
        const inventory = state.inventory || [];
        const sloc = state.selectedSloc;
        
        if (!sloc) {
            return itemTypes.map(itemType => ({
                ...itemType,
                availableQty: 0,
                issuedQty: 0,
                installedQty: 0,
                rejectedQty: 0,
                ...enrichItemTypeWithRelations(itemType, state)
            }));
        }
        
        // Filter bulk inventory for current SLOC
        const bulkInventory = inventory.filter(inv => {
            const invItemType = state.itemTypes.find(it => it.id === inv.item_type_id);
            return invItemType && invItemType.inventory_type_id === 2 && inv.sloc_id === sloc.id;
        });
        
        // Cache status lookups
        const statuses = {
            available: state.statuses?.find(s => s.name === 'Available'),
            issued: state.statuses?.find(s => s.name === 'Issued'),
            installed: state.statuses?.find(s => s.name === 'Installed'),
            rejected: state.statuses?.find(s => s.name === 'Rejected')
        };
        
        return itemTypes.map(itemType => {
            const itemInventory = bulkInventory.filter(inv => inv.item_type_id === itemType.id);
            const quantities = aggregateQuantitiesByStatus(itemInventory, statuses);
            const relations = enrichItemTypeWithRelations(itemType, state);
            
            return {
                ...itemType,
                ...quantities,
                ...relations
            };
        });
    };
    
    // ==================== TABLE RENDERING ====================
    
    /**
     * Create quantity input element for bulk table
     * @param {Object} item - Item data
     * @param {boolean} receiveMode - Receive mode enabled
     * @param {boolean} issueMode - Issue mode enabled
     * @param {Function} validateReceive - Validation callback for receive
     * @param {Function} validateIssue - Validation callback for issue
     * @returns {HTMLElement}
     */
    const createQuantityInput = (item, receiveMode, issueMode, validateReceive, validateIssue) => {
        const inputAttrs = {
            type: 'text',
            className: 'bulk-qty-input',
            'data-item-type-id': item.id,
            'data-available-qty': item.availableQty || 0,
            onkeypress: (e) => {
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9]/g, '');
                e.target.value = numericOnly;
                
                if (receiveMode) validateReceive();
                if (issueMode) validateIssue();
            },
            onkeyup: (e) => {
                if (receiveMode) validateReceive();
                if (issueMode) validateIssue();
            }
        };
        
        if (!receiveMode && !issueMode) {
            inputAttrs.disabled = true;
        }
        
        return createElement('input', inputAttrs);
    };
    
    /**
     * Create a single table row for bulk items table
     * @param {Object} item - Item data
     * @param {boolean} receiveMode - Receive mode enabled
     * @param {boolean} issueMode - Issue mode enabled
     * @param {Function} validateReceive - Validation callback for receive
     * @param {Function} validateIssue - Validation callback for issue
     * @returns {HTMLElement}
     */
    const createTableRow = (item, receiveMode, issueMode, validateReceive, validateIssue) => {
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
                createQuantityInput(item, receiveMode, issueMode, validateReceive, validateIssue)
            ]),
            createElement('td', {}, [item.name || '-']),
            createElement('td', { className: 'bulk-description-cell' }, [item.description || '-']),
            createElement('td', {}, [item.part_number || '-']),
            createElement('td', {}, [item.categoryName]),
            createElement('td', {}, [item.uomName]),
            createElement('td', {}, [item.providerName])
        ]);
    };
    
    /**
     * Render bulk items table
     * @param {Array} tableData - Table data
     * @param {boolean} receiveMode - Receive mode enabled
     * @param {boolean} issueMode - Issue mode enabled
     * @returns {HTMLElement}
     */
    const renderBulkItemsTable = (tableData, receiveMode, issueMode) => {
        const filteredData = filterDataByMode(tableData, issueMode);
        
        // These will be resolved from the global scope when called
        const validateReceive = window.validateBulkReceiveForm || (() => {});
        const validateIssue = window.validateBulkIssueForm || (() => {});
        
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
                filteredData.map(item => createTableRow(item, receiveMode, issueMode, validateReceive, validateIssue))
            )
        ]);
    };
    
    // ==================== UI SECTIONS ====================
    
    /**
     * Create receive process section UI
     * @returns {HTMLElement}
     */
    const createReceiveSection = () => {
        return div({ 
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
            
            div({ id: 'bulk-receive-initial', style: { display: 'block' } }, [
                createElement('button', {
                    id: 'begin-bulk-receive-btn',
                    className: 'btn btn-primary',
                    style: { width: '100%' },
                    onclick: () => window.beginBulkReceiveProcess()
                }, ['Begin Receive Process'])
            ]),
            
            div({ id: 'bulk-receive-active', style: { display: 'none' } })
        ]);
    };
    
    /**
     * Create issue process section UI
     * @returns {HTMLElement}
     */
    const createIssueSection = () => {
        return div({ 
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
            
            div({ id: 'bulk-issue-initial', style: { display: 'block' } }, [
                createElement('button', {
                    id: 'begin-bulk-issue-btn',
                    className: 'btn btn-primary',
                    style: { width: '100%' },
                    onclick: () => window.beginBulkIssueProcess()
                }, ['Begin Issue Process'])
            ]),
            
            div({ id: 'bulk-issue-active', style: { display: 'none' } })
        ]);
    };
    
    /**
     * Create search bar UI
     * @param {Function} filterCallback - Callback for filtering table
     * @returns {HTMLElement}
     */
    const createSearchBar = (filterCallback) => {
        return div({ style: { marginBottom: '1rem' } }, [
            Components.formField({
                type: 'text',
                id: 'bulk-items-search',
                name: 'bulk_items_search',
                label: 'Search Items',
                placeholder: 'Search by name, description, part number, category...',
                onkeyup: (e) => filterCallback(e.target.value)
            })
        ]);
    };
    
    // ==================== TABLE FILTERING ====================
    
    /**
     * Filter bulk table rows by search text
     * @param {string} searchText - Search query
     */
    const filterBulkTable = (searchText) => {
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
    };
    
    // ==================== PUBLIC API ====================
    
    return {
        // Data filtering
        getFilteredBulkItemTypes,
        filterDataByMode,
        
        // Data transformation
        buildBulkTableData,
        
        // Table rendering
        renderBulkItemsTable,
        
        // UI sections
        createReceiveSection,
        createIssueSection,
        createSearchBar,
        
        // Table filtering
        filterBulkTable
    };
})();

// Make available globally
window.BulkReceiveHelpers = BulkReceiveHelpers;

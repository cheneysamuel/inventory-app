/**
 * Inventory Data Processing Service
 * Extracts business logic for data transformations from views
 */

const InventoryProcessing = (() => {
    
    /**
     * Check if a status is visible based on saved preferences
     * @param {string} statusName - Name of the status
     * @returns {boolean}
     */
    const isStatusVisible = (statusName) => {
        const savedVisibility = JSON.parse(localStorage.getItem('statusVisibility') || '{}');
        const defaultVisible = ['Available', 'Issued', 'Rejected'].includes(statusName);
        return savedVisibility[statusName] !== undefined ? savedVisibility[statusName] : defaultVisible;
    };
    
    /**
     * Get status colors from localStorage
     * @param {string} statusName - Name of the status
     * @returns {{background: string, text: string}}
     */
    const getStatusColors = (statusName) => {
        const defaultColors = {
            'Available': { background: '#75c283', text: '#000000' },
            'Issued': { background: '#4099dd', text: '#ffffff' },
            'Rejected': { background: '#ed4545', text: '#000000' }
        };
        const colors = JSON.parse(localStorage.getItem('statusColors') || '{}');
        return colors[statusName] || defaultColors[statusName] || { background: '#ffffff', text: '#000000' };
    };
    
    /**
     * Filter inventory to bulk items only
     * @param {Array} inventory - Array of inventory items
     * @param {Array} itemTypes - Array of item types
     * @returns {Array}
     */
    const getBulkInventory = (inventory, itemTypes) => {
        return inventory.filter(item => {
            const itemType = itemTypes.find(it => it.id === item.item_type_id);
            return itemType && itemType.inventory_type_id === 2;
        });
    };
    
    /**
     * Filter inventory to serialized items only
     * @param {Array} inventory - Array of inventory items
     * @param {Array} itemTypes - Array of item types
     * @returns {Array}
     */
    const getSerializedInventory = (inventory, itemTypes) => {
        return inventory.filter(item => {
            const itemType = itemTypes.find(it => it.id === item.item_type_id);
            return itemType && itemType.inventory_type_id === 1;
        });
    };
    
    /**
     * Consolidate bulk inventory rows by location, crew, area, item, status
     * @param {Array} bulkInventory - Array of bulk inventory items
     * @param {Object} state - Application state containing lookups
     * @returns {Array} Consolidated rows
     */
    const consolidateBulkRows = (bulkInventory, state) => {
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
                    items: [item]
                });
            }
        });
        
        return consolidatedRows;
    };
    
    /**
     * Filter consolidated rows by visibility preferences
     * @param {Array} consolidatedRows - Array of consolidated rows
     * @returns {Array}
     */
    const filterVisibleRows = (consolidatedRows) => {
        return consolidatedRows.filter(row => {
            return row.status && isStatusVisible(row.status.name);
        });
    };
    
    /**
     * Build hierarchical inventory structure (category -> item type -> items)
     * @param {Array} serializedInventory - Array of serialized inventory items
     * @param {Array} itemTypes - Array of item types
     * @param {Array} categories - Array of categories
     * @returns {Object} Hierarchical structure
     */
    const buildHierarchicalInventory = (serializedInventory, itemTypes, categories) => {
        const hierarchicalInventory = {};
        
        serializedInventory.forEach(item => {
            const itemType = itemTypes.find(it => it.id === item.item_type_id);
            if (!itemType) return;
            
            const category = categories.find(c => c.id === itemType.category_id);
            const categoryName = category ? category.name : 'Uncategorized';
            
            if (!hierarchicalInventory[categoryName]) {
                hierarchicalInventory[categoryName] = {};
            }
            
            if (!hierarchicalInventory[categoryName][itemType.name]) {
                hierarchicalInventory[categoryName][itemType.name] = [];
            }
            
            hierarchicalInventory[categoryName][itemType.name].push(item);
        });
        
        return hierarchicalInventory;
    };
    
    /**
     * Filter hierarchical inventory by visible statuses
     * @param {Object} hierarchicalInventory - Hierarchical inventory structure
     * @param {Array} statuses - Array of status objects
     * @returns {Object} Filtered hierarchical structure
     */
    const filterHierarchicalByVisibility = (hierarchicalInventory, statuses) => {
        const filtered = {};
        
        Object.keys(hierarchicalInventory).forEach(categoryName => {
            filtered[categoryName] = {};
            
            Object.keys(hierarchicalInventory[categoryName]).forEach(itemTypeName => {
                const items = hierarchicalInventory[categoryName][itemTypeName];
                
                const visibleItems = items.filter(item => {
                    const status = statuses.find(s => s.id === item.status_id);
                    return status && isStatusVisible(status.name);
                });
                
                if (visibleItems.length > 0) {
                    filtered[categoryName][itemTypeName] = visibleItems;
                }
            });
            
            // Remove empty categories
            if (Object.keys(filtered[categoryName]).length === 0) {
                delete filtered[categoryName];
            }
        });
        
        return filtered;
    };
    
    /**
     * Build enhanced item types data with usage counts and market associations
     * @param {Array} itemTypes - Array of item types
     * @param {Object} state - Application state
     * @returns {Array} Enhanced item types data
     */
    const buildEnhancedItemTypes = (itemTypes, state) => {
        // Calculate use count for each item type
        const inventoryUsage = {};
        (state.inventory || []).forEach(inv => {
            if (inv.item_type_id) {
                inventoryUsage[inv.item_type_id] = (inventoryUsage[inv.item_type_id] || 0) + 1;
            }
        });
        
        return itemTypes.map(item => {
            const inventoryType = state.inventoryTypes.find(it => it.id === item.inventory_type_id);
            const category = state.categories.find(c => c.id === item.category_id);
            const uom = state.unitsOfMeasure.find(u => u.id === item.unit_of_measure_id);
            const provider = state.providers.find(p => p.id === item.provider_id);
            
            // Get associated markets
            const itemMarkets = (state.itemTypeMarkets || [])
                .filter(itm => itm.item_type_id === item.id);
            const marketNames = itemMarkets
                .map(itm => {
                    const market = state.markets.find(m => m.id === itm.market_id);
                    return market ? market.name : null;
                })
                .filter(name => name !== null);
            
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
    };
    
    // Public API
    return {
        isStatusVisible,
        getStatusColors,
        getBulkInventory,
        getSerializedInventory,
        consolidateBulkRows,
        filterVisibleRows,
        buildHierarchicalInventory,
        filterHierarchicalByVisibility,
        buildEnhancedItemTypes
    };
})();

// Make available globally
window.InventoryProcessing = InventoryProcessing;

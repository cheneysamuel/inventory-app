/**
 * Receive Serialized Helpers
 * 
 * Extracted helper functions for the Receive Serialized view.
 * Handles filtering and searching within the hierarchical inventory display.
 */

const ReceiveSerializedHelpers = (function() {
    'use strict';
    
    // ========================================
    // HIERARCHY FILTERING
    // ========================================
    
    /**
     * Filter the serialized inventory hierarchy based on search term
     * Searches across categories, item types, serial numbers, locations, crews, and areas
     */
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
    
    /**
     * Build hierarchical inventory display from data structure
     * Creates collapsible category and item type groups with inventory tables
     * @param {Object} hierarchicalInventory - Nested object: {category: {itemType: [items]}}
     * @param {Object} state - Application state
     * @returns {HTMLElement} DOM hierarchy container
     */
    function buildHierarchyFromData(hierarchicalInventory, state) {
        const container = createElement('div', { className: 'hierarchy-container' });
        
        Object.keys(hierarchicalInventory).forEach(categoryName => {
            const categoryGroup = createElement('div', { className: 'category-group' });
            
            const categoryHeader = createElement('div', { 
                className: 'category-header',
                onclick: function() {
                    const content = this.nextElementSibling;
                    const icon = this.querySelector('.collapse-icon');
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        icon.textContent = '▼';
                    } else {
                        content.style.display = 'none';
                        icon.textContent = '►';
                    }
                }
            }, [
                createElement('span', {}, [categoryName]),
                createElement('span', { className: 'collapse-icon' }, ['▼'])
            ]);
            
            const categoryContent = createElement('div', { className: 'category-content' });
            
            Object.keys(hierarchicalInventory[categoryName]).forEach(itemTypeName => {
                const items = hierarchicalInventory[categoryName][itemTypeName];
                
                const itemTypeGroup = createElement('div', { className: 'item-type-group' });
                
                const itemTypeHeader = createElement('div', { className: 'item-type-header' }, [
                    createElement('span', { 'data-bind': 'item-type-name' }, [itemTypeName]),
                    createElement('span', { className: 'item-count-badge', 'data-bind': 'item-count' }, [String(items.length)])
                ]);
                
                const table = createElement('table', { className: 'inventory-table' });
                
                const thead = createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', {}, ['Location']),
                        createElement('th', {}, ['Crew']),
                        createElement('th', {}, ['Area']),
                        createElement('th', {}, ['Mfgr. SN']),
                        createElement('th', {}, ['Tilson SN']),
                        createElement('th', {}, ['Quantity']),
                        createElement('th', {}, ['Status'])
                    ])
                ]);
                
                const tbody = createElement('tbody', { 'data-bind': 'items-body' });
                
                items.forEach(item => {
                    const location = state.locations?.find(l => l.id === item.location_id);
                    const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
                    const area = state.areas?.find(a => a.id === item.area_id);
                    const status = state.statuses?.find(s => s.id === item.status_id);
                    
                    const statusColors = InventoryProcessing.getStatusColors(status?.name);
                    
                    // Check if this item is selected
                    const isSelected = window.FormUtilitiesState.selectedItemsForIssue?.some(i => i.id === item.id);
                    
                    const row = createElement('tr', {
                        'data-item-id': item.id,
                        className: isSelected ? 'selected-row' : '',
                        onclick: () => {
                            // If in issue selection mode, toggle selection
                            if (window.FormUtilitiesState.isSelectingForIssue) {
                                window.toggleItemSelection(item);
                                // Toggle row styling
                                row.classList.toggle('selected-row');
                                // Update form validation
                                if (window.validateIssueForm) {
                                    window.validateIssueForm();
                                }
                                // Update selected items list
                                if (window.updateSelectedItemsList) {
                                    window.updateSelectedItemsList();
                                }
                            } else {
                                // Normal mode - show actions modal
                                showInventoryActionsModal(item);
                            }
                        }
                    }, [
                        createElement('td', {}, [location?.name || '-']),
                        createElement('td', {}, [crew?.name || '-']),
                        createElement('td', {}, [area?.name || '-']),
                        createElement('td', {}, [item.mfgrsn || '-']),
                        createElement('td', {}, [item.tilsonsn || '-']),
                        createElement('td', {}, [String(item.quantity || 1)]),
                        createElement('td', { 
                            style: { 
                                backgroundColor: statusColors.background, 
                                color: statusColors.text 
                            } 
                        }, [status?.name || '-'])
                    ]);
                    
                    tbody.appendChild(row);
                });
                
                table.appendChild(thead);
                table.appendChild(tbody);
                itemTypeGroup.appendChild(itemTypeHeader);
                itemTypeGroup.appendChild(table);
                categoryContent.appendChild(itemTypeGroup);
            });
            
            categoryGroup.appendChild(categoryHeader);
            categoryGroup.appendChild(categoryContent);
            container.appendChild(categoryGroup);
        });
        
        return container;
    }
    
    /**
     * Build hierarchical inventory display from data
     * Public wrapper for buildHierarchyFromData
     */
    function buildHierarchy(visibleHierarchy, state) {
        return buildHierarchyFromData(visibleHierarchy, state);
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    return {
        filterSerializedHierarchy,
        buildHierarchy,
        buildHierarchyFromData
    };
})();

// Expose to global scope
window.ReceiveSerializedHelpers = ReceiveSerializedHelpers;
window.buildHierarchyFromData = ReceiveSerializedHelpers.buildHierarchyFromData;

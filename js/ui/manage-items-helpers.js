/**
 * Manage Items Helpers
 * 
 * Extracted helper functions for the Manage Items view.
 * Handles duplicate detection, inventory moving, bulk market assignments,
 * filtering, row selection, and item type management.
 */

const ManageItemsHelpers = (function() {
    'use strict';
    
    // Module state for move operations
    let moveFromItemId = null;
    let moveToItemId = null;
    
    // ========================================
    // DUPLICATE DETECTION HANDLERS
    // ========================================
    
    /**
     * Toggle duplicate highlighting for item types
     */
    function toggleDuplicateHighlighting() {
        const btn = byId('identify-duplicates-btn');
        const allRows = document.querySelectorAll('.item-type-row');
        const moveControls = byId('duplicate-move-controls');
        
        const isHighlighted = btn.classList.contains('active');
        
        if (isHighlighted) {
            // Remove highlighting and filtering
            allRows.forEach(row => {
                row.classList.remove('duplicate-name', 'duplicate-part', 'hidden-non-duplicate');
            });
            btn.classList.remove('active');
            btn.textContent = 'Identify Duplicates';
            
            if (moveControls) {
                moveControls.classList.remove('active');
            }
            
            const toggleBtn = byId('toggle-unique-rows-btn');
            if (toggleBtn) {
                toggleBtn.textContent = 'Show All Rows';
                toggleBtn.classList.remove('active');
            }
            
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
            
            // Highlight rows with duplicate names
            Object.values(nameGroups).forEach(group => {
                if (group.length > 1) {
                    group.forEach(({ row, itemId }) => {
                        row.classList.add('duplicate-name');
                        duplicateIds.add(itemId);
                    });
                }
            });
            
            // Highlight rows with duplicate part numbers
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
    
    /**
     * Toggle visibility of unique (non-duplicate) rows
     */
    function toggleUniqueRows() {
        const toggleBtn = byId('toggle-unique-rows-btn');
        const allRows = document.querySelectorAll('.item-type-row');
        
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
    
    // ========================================
    // MOVE INVENTORY HANDLERS
    // ========================================
    
    /**
     * Set the "move from" item for inventory transfer
     */
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
        
        updateExecuteButton();
    }
    
    /**
     * Set the "move to" item for inventory transfer
     */
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
        
        updateExecuteButton();
    }
    
    /**
     * Update the execute button enabled state
     */
    function updateExecuteButton() {
        const executeBtn = byId('execute-move-btn');
        if (executeBtn) {
            executeBtn.disabled = !(moveFromItemId && moveToItemId && moveFromItemId !== moveToItemId);
        }
    }
    
    /**
     * Clear move selection state
     */
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
    
    /**
     * Execute the inventory move operation
     */
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
            
            clearMoveSelection();
            
            // Reload data and re-render
            await window.loadInitialData();
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error moving inventory records:', error);
            Components.showToast('Error moving inventory records', 'error');
        }
    }
    
    // ========================================
    // FILTERING AND SEARCH
    // ========================================
    
    /**
     * Filter item types based on search input
     */
    function filterItemTypes(searchTerm) {
        const rows = document.querySelectorAll('.item-type-row');
        const term = searchTerm.toLowerCase().trim();
        let visibleCount = 0;
        
        rows.forEach(row => {
            if (!term) {
                row.style.display = '';
                visibleCount++;
            } else {
                // Get searchable content
                const name = row.getAttribute('data-item-name') || '';
                const partNumber = row.getAttribute('data-item-part-number') || '';
                
                const cells = row.querySelectorAll('td');
                const manufacturer = cells[2]?.textContent.toLowerCase() || '';
                const description = cells[4]?.textContent.toLowerCase() || '';
                const category = cells[7]?.textContent.toLowerCase() || '';
                const markets = cells[10]?.textContent.toLowerCase() || '';
                
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
        
        // Disable edit/delete buttons if no visible selection
        const selectedRow = document.querySelector('.item-type-row.selected:not([style*="display: none"])');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        
        if (!selectedRow) {
            if (editBtn) editBtn.disabled = true;
            if (deleteBtn) deleteBtn.disabled = true;
        }
    }
    
    // ========================================
    // ROW SELECTION
    // ========================================
    
    /**
     * Handle item type row selection
     */
    function handleItemTypeRowSelection(itemId, useCount) {
        const clickedRow = document.querySelector(`.item-type-row[data-item-id="${itemId}"]`);
        
        // Check if in duplicate mode
        const duplicateMode = byId('identify-duplicates-btn')?.classList.contains('active');
        if (duplicateMode) {
            const wasSelected = clickedRow && clickedRow.classList.contains('selected');
            
            document.querySelectorAll('.item-type-row.selected').forEach(row => {
                row.classList.remove('selected');
            });
            
            if (!wasSelected && clickedRow) {
                clickedRow.classList.add('selected');
                
                if (!moveFromItemId) {
                    byId('move-from-btn').disabled = false;
                } else if (moveFromItemId && !moveToItemId) {
                    byId('move-to-btn').disabled = false;
                }
                
                byId('edit-item-type-btn').disabled = false;
                byId('delete-item-type-btn').disabled = false;
            } else {
                if (!moveFromItemId) {
                    byId('move-from-btn').disabled = true;
                }
                if (!moveToItemId) {
                    byId('move-to-btn').disabled = true;
                }
                
                byId('edit-item-type-btn').disabled = true;
                byId('delete-item-type-btn').disabled = true;
            }
            return;
        }
        
        // Check if in bulk market assign mode
        if (window.bulkMarketAssignMode) {
            if (clickedRow) {
                const isLocked = clickedRow.getAttribute('data-locked') === 'true';
                if (isLocked) {
                    Components.showToast('Cannot remove market from items in use', 'warning');
                    return;
                }
                
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
        
        const wasSelected = clickedRow && clickedRow.classList.contains('selected');
        
        // Remove previous selection
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => row.classList.remove('selected'));
        
        if (wasSelected) {
            // Deselect - reset button states
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
    
    // ========================================
    // ITEM TYPE MANAGEMENT
    // ========================================
    
    /**
     * Confirm and delete an item type
     */
    function confirmDeleteItemType(item) {
        const confirmed = confirm(
            `Are you sure you want to delete the item type "${item.name}"?\n\n` +
            `This action cannot be undone.`
        );
        
        if (confirmed) {
            deleteItemType(item.id);
        }
    }
    
    /**
     * Delete an item type
     */
    async function deleteItemType(itemTypeId) {
        try {
            const deleteResult = await Database.deleteRecord('item_types', itemTypeId);
            
            if (!deleteResult.isOk) {
                Components.showToast('Error deleting item type', 'error');
                return;
            }
            
            await refreshCachedTable('item_types');
            
            Components.showToast('Item type deleted successfully', 'success');
            
            // Check if in duplicate mode and exit it
            const duplicateBtn = byId('identify-duplicates-btn');
            if (duplicateBtn && duplicateBtn.classList.contains('active')) {
                toggleDuplicateHighlighting();
            }
            
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error deleting item type:', error);
            Components.showToast('Error deleting item type', 'error');
        }
    }
    
    // ========================================
    // BULK MARKET ASSIGNMENT
    // ========================================
    
    /**
     * Enter bulk market assignment mode
     */
    function enterBulkMarketAssignMode() {
        window.bulkMarketAssignMode = true;
        window.bulkMarketSelectedMarketId = null;
        window.bulkMarketInitialAssignments = {};
        
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
        
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => {
            row.classList.remove('selected', 'bulk-selected');
        });
        
        Components.showToast('Select a market to manage assignments', 'info');
    }
    
    /**
     * Handle bulk market selection change
     */
    function handleBulkMarketSelection(marketId) {
        if (!marketId) {
            const applyBtn = byId('bulk-market-apply-btn');
            if (applyBtn) applyBtn.disabled = true;
            return;
        }
        
        window.bulkMarketSelectedMarketId = parseInt(marketId);
        const state = Store.getState();
        
        const marketSlocs = (state.slocs || []).filter(sloc => sloc.market_id === parseInt(marketId));
        const marketSlocIds = marketSlocs.map(sloc => sloc.id);
        
        window.bulkMarketInitialAssignments = {};
        const allRows = document.querySelectorAll('.item-type-row');
        
        allRows.forEach(row => {
            const itemId = parseInt(row.getAttribute('data-item-id'));
            
            const marketUseCount = (state.inventory || []).filter(inv => 
                inv.item_type_id === itemId && marketSlocIds.includes(inv.sloc_id)
            ).length;
            
            const useCountCell = row.cells[row.cells.length - 1];
            if (useCountCell) {
                useCountCell.textContent = String(marketUseCount);
                useCountCell.style.fontWeight = 'bold';
                useCountCell.style.color = marketUseCount > 0 ? '#28a745' : '#999';
            }
            
            const hasAssociation = (state.itemTypeMarkets || []).some(itm => 
                itm.item_type_id === itemId && itm.market_id === window.bulkMarketSelectedMarketId
            );
            
            window.bulkMarketInitialAssignments[itemId] = hasAssociation;
            
            if (hasAssociation) {
                row.classList.add('bulk-selected');
            } else {
                row.classList.remove('bulk-selected');
            }
            
            if (hasAssociation && marketUseCount > 0) {
                row.style.backgroundColor = '#e0e0e0';
                row.style.color = '#666';
                row.style.cursor = 'not-allowed';
                row.setAttribute('data-locked', 'true');
                
                for (let i = 0; i < row.cells.length; i++) {
                    row.cells[i].style.backgroundColor = '#e0e0e0';
                    row.cells[i].style.color = '#666';
                }
            } else {
                row.style.backgroundColor = '';
                row.style.color = '';
                row.style.cursor = 'pointer';
                row.removeAttribute('data-locked');
                
                for (let i = 0; i < row.cells.length; i++) {
                    row.cells[i].style.backgroundColor = '';
                    row.cells[i].style.color = '';
                }
            }
        });
        
        const applyBtn = byId('bulk-market-apply-btn');
        if (applyBtn) applyBtn.disabled = false;
    }
    
    /**
     * Apply bulk market assignments
     */
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
            
            if (isLocked) return;
            
            if (isSelected && !wasInitiallyAssociated) {
                toAdd.push(itemId);
            } else if (!isSelected && wasInitiallyAssociated) {
                toRemove.push(itemId);
            }
        });
        
        if (toAdd.length === 0 && toRemove.length === 0) {
            Components.showToast('No changes to apply', 'info');
            return;
        }
        
        const market = state.markets.find(m => m.id === marketId);
        const marketName = market ? market.name : `ID ${marketId}`;
        
        const confirmed = confirm(
            `Apply changes for market "${marketName}"?\n\n` +
            `Add ${toAdd.length} item type(s)\n` +
            `Remove ${toRemove.length} item type(s)\n\n` +
            `Continue?`
        );
        
        if (!confirmed) return;
        
        try {
            let addCount = 0;
            let removeCount = 0;
            let errorCount = 0;
            
            // Add associations
            for (const itemId of toAdd) {
                const result = await Database.insert('item_type_markets', {
                    item_type_id: itemId,
                    market_id: marketId,
                    created_at: getLocalTimestamp()
                });
                
                if (result.isOk) {
                    addCount++;
                } else {
                    errorCount++;
                }
            }
            
            // Remove associations
            for (const itemId of toRemove) {
                const existing = state.itemTypeMarkets.find(itm => 
                    itm.item_type_id === itemId && itm.market_id === marketId
                );
                
                if (existing) {
                    const result = await Database.deleteRecord('item_type_markets', existing.id);
                    if (result.isOk) {
                        removeCount++;
                    } else {
                        errorCount++;
                    }
                }
            }
            
            if (errorCount > 0) {
                Components.showToast(
                    `Added ${addCount}, removed ${removeCount}, ${errorCount} error(s)`,
                    'warning'
                );
            } else {
                Components.showToast(
                    `Successfully added ${addCount} and removed ${removeCount} market assignment(s)`,
                    'success'
                );
            }
            
            // Exit bulk mode
            exitBulkMarketAssignMode();
            
            // Reload and re-render
            await window.loadInitialData();
            Views.render('manage-items');
            
        } catch (error) {
            console.error('Error applying bulk market assignments:', error);
            Components.showToast('Error applying market assignments', 'error');
        }
    }
    
    /**
     * Exit bulk market assignment mode
     */
    function exitBulkMarketAssignMode() {
        window.bulkMarketAssignMode = false;
        window.bulkMarketSelectedMarketId = null;
        window.bulkMarketInitialAssignments = {};
        
        const controls = byId('bulk-market-controls');
        const addBtn = byId('add-item-type-btn');
        const editBtn = byId('edit-item-type-btn');
        const deleteBtn = byId('delete-item-type-btn');
        const bulkBtn = byId('bulk-market-assign-btn');
        const select = byId('bulk-market-select');
        const applyBtn = byId('bulk-market-apply-btn');
        
        if (controls) controls.style.display = 'none';
        if (addBtn) addBtn.style.display = '';
        if (editBtn) editBtn.style.display = '';
        if (deleteBtn) deleteBtn.style.display = '';
        if (bulkBtn) bulkBtn.style.display = '';
        if (select) select.value = '';
        if (applyBtn) applyBtn.disabled = true;
        
        const allRows = document.querySelectorAll('.item-type-row');
        allRows.forEach(row => {
            row.classList.remove('bulk-selected');
            row.style.backgroundColor = '';
            row.style.color = '';
            row.style.cursor = '';
            row.removeAttribute('data-locked');
            
            for (let i = 0; i < row.cells.length; i++) {
                row.cells[i].style.backgroundColor = '';
                row.cells[i].style.color = '';
            }
        });
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    return {
        // Duplicate detection
        toggleDuplicateHighlighting,
        toggleUniqueRows,
        
        // Move inventory
        setMoveFromItem,
        setMoveToItem,
        clearMoveSelection,
        executeMoveInventory,
        
        // Filtering
        filterItemTypes,
        
        // Row selection
        handleItemTypeRowSelection,
        
        // Item management
        confirmDeleteItemType,
        
        // Bulk market assignment
        enterBulkMarketAssignMode,
        handleBulkMarketSelection,
        applyBulkMarketAssignments,
        exitBulkMarketAssignMode
    };
})();

// Expose to global scope
window.ManageItemsHelpers = ManageItemsHelpers;

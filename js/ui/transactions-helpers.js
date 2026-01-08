/**
 * Transactions Helpers
 * 
 * Extracted helper functions for the Transactions view.
 * Handles transaction change text generation, search filtering, and table rendering.
 */

const TransactionsHelpers = (function() {
    'use strict';
    
    // ========================================
    // CHANGE TEXT GENERATION
    // ========================================
    
    /**
     * Generate human-readable changes text from transaction before/after state
     */
    function getChangesText(tx, state) {
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
    }
    
    // ========================================
    // QUANTITY RENDERING
    // ========================================
    
    /**
     * Render quantity with change indicator (old → new (diff))
     */
    function renderQuantity(val, row) {
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
    
    /**
     * Render user name from transaction data (handles JSON format)
     */
    function renderUserName(val, row) {
        try {
            const userInfo = JSON.parse(row.user_name);
            return userInfo.email || userInfo.name || 'Unknown';
        } catch {
            return row.user_name || 'Unknown';
        }
    }
    
    // ========================================
    // SEARCH AND FILTERING
    // ========================================
    
    /**
     * Handle transaction search and re-render table
     */
    function handleSearch(searchInputId, tableContainerId, filteredTransactions, state) {
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
                getChangesText(tx, state)
            ].filter(Boolean).join(' ').toLowerCase();
            
            return searchableText.includes(searchTerm);
        });
        
        // Re-render table
        renderTransactionTable(tableContainerId, searchFiltered, state);
    }
    
    // ========================================
    // TABLE RENDERING
    // ========================================
    
    /**
     * Get table columns configuration
     */
    function getTableColumns(state) {
        return [
            { field: 'action', label: 'Action' },
            { field: 'item_type_name', label: 'Item' },
            { 
                field: 'quantity', 
                label: 'Qty', 
                render: renderQuantity
            },
            { 
                field: 'user_name', 
                label: 'User',
                render: renderUserName
            },
            { 
                field: 'date_time', 
                label: 'Date/Time', 
                render: (val, row) => formatTimestampWithTimezone(val, row.created_timezone)
            },
            { field: 'changes', label: 'Changes', render: (val, row) => getChangesText(row, state) }
        ];
    }
    
    /**
     * Render the transaction table with data
     */
    function renderTransactionTable(tableContainerId, transactions, state) {
        const tableContainer = byId(tableContainerId);
        tableContainer.innerHTML = '';
        
        if (transactions.length > 0) {
            tableContainer.appendChild(Components.dataTable({
                columns: getTableColumns(state),
                data: transactions
            }));
        } else {
            tableContainer.appendChild(Components.emptyState('No matching transactions found', '🔍'));
        }
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    return {
        // Change text generation
        getChangesText,
        
        // Rendering
        renderQuantity,
        renderUserName,
        
        // Search
        handleSearch,
        
        // Table
        getTableColumns,
        renderTransactionTable
    };
})();

// Expose to global scope
window.TransactionsHelpers = TransactionsHelpers;

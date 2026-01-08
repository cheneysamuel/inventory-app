/**
 * Form and UI Utility Functions
 * Batch processing, form resets, client/crew management, hierarchy selection
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // FORM UTILITIES
    // ========================================

// Module-level state variables (shared with serialized-workflows.js)
let batchEntries = [];
let isSelectingForIssue = false;
let selectedItemsForIssue = [];
let isManualEntryMode = false;
let currentSNSequence = 0;

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
                    sn: generateSN(window.FormUtilitiesState.currentSNSequence + 1),
                    mfgrSn: '',
                    units: itemType.units_per_package,
                    interacted: false  // Not yet interacted with
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
            sn: generateSN(window.FormUtilitiesState.currentSNSequence + i + 1),
            mfgrSn: '',
            units: itemType.units_per_package,
            interacted: true  // Batch count = user wants all these rows
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
                    
                    // Mark this entry as interacted
                    batchEntries[index].interacted = true;
                    
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
                            const nextSequence = window.FormUtilitiesState.currentSNSequence + batchEntries.length + 1;
                            batchEntries.push({
                                sn: generateSN(nextSequence),
                                mfgrSn: '',
                                units: itemType.units_per_package,
                                interacted: false  // New row, not yet interacted
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
    // Use Transactions service which automatically uses edge functions when available
    const transactionsResult = await Transactions.getRecent(100);
    if (transactionsResult.isOk) {
        Store.setState({ transactions: transactionsResult.value });
    }
}

async function saveCrewInlineEdit(row, crewId, editCells) {
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


    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    // Batch processing
    window.handleBatchCountChange = handleBatchCountChange;
    window.renderBatchTable = renderBatchTable;
    window.createBatchRow = createBatchRow;
    window.clearBatchTable = clearBatchTable;

    // Form resets
    window.resetReceiveForm = resetReceiveForm;
    window.resetIssueForm = resetIssueForm;
    window.clearReceiveForm = clearReceiveForm;

    // Bulk operations
    window.processBulkReceive = processBulkReceive;

    // Transactions
    window.refreshTransactionsList = refreshTransactionsList;

    // Crew management
    window.deleteCrewRecord = deleteCrewRecord;
    window.showAddCrewModal = showAddCrewModal;
    window.showEditCrewModal = showEditCrewModal;

    // Hierarchy
    window.handleHierarchyRowSelection = handleHierarchyRowSelection;
    
    // Expose state variables and accessors for cross-module access
    window.FormUtilitiesState = {
        get batchEntries() { return batchEntries; },
        set batchEntries(value) { batchEntries = value; },
        get isSelectingForIssue() { return isSelectingForIssue; },
        set isSelectingForIssue(value) { isSelectingForIssue = value; },
        get selectedItemsForIssue() { return selectedItemsForIssue; },
        set selectedItemsForIssue(value) { selectedItemsForIssue = value; },
        get isManualEntryMode() { return isManualEntryMode; },
        set isManualEntryMode(value) { isManualEntryMode = value; },
        get currentSNSequence() { return currentSNSequence; },
        set currentSNSequence(value) { currentSNSequence = value; }
    };

    // Client management
    window.showAddClientRow = showAddClientRow;
    window.saveNewClient = saveNewClient;
    window.enableClientInlineEdit = enableClientInlineEdit;

})();

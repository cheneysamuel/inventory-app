/**
 * Serialized Inventory Workflows
 * Receive/Issue processing, inventory display, and modal builders
 * Extracted from views.js
 */

(function() {
    "use strict";

    // ========================================
    // SERIALIZED WORKFLOWS
    // ========================================

async function processSerializedReceive() {
    const state = Store.getState();
    const itemTypeId = byId('receive_item_type_id')?.value;
    
    if (!itemTypeId) {
        Components.showToast('Please select an item type', 'warning');
        return;
    }
    
    if (window.FormUtilitiesState.batchEntries.length === 0) {
        Components.showToast('Please add items to receive', 'warning');
        return;
    }
    
    // Filter to only entries the user has interacted with
    // (in manual mode, exclude the auto-created "next" row that hasn't been touched)
    const validEntries = window.FormUtilitiesState.batchEntries.filter(entry => entry.interacted === true);
    
    if (validEntries.length === 0) {
        Components.showToast('Please enter at least one serial number', 'warning');
        return;
    }
    
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
        
        let successCount = 0;
        let failCount = 0;
        
        // Try edge function first if available
        if (window.EdgeFunctions && EdgeFunctions.receiveSerializedInventory) {
            console.log('🚀 Using receiveSerializedInventory edge function');
            const edgeResult = await EdgeFunctions.receiveSerializedInventory(inventoryRecords);
            
            if (edgeResult.isOk) {
                console.log('✅ Edge function succeeded:', edgeResult.value);
                successCount = edgeResult.value.successCount || 0;
                failCount = edgeResult.value.failCount || 0;
            } else {
                console.warn('⚠️ Edge function failed, falling back to direct insert:', edgeResult.error);
                // Fallback to direct insert
                const insertPromises = inventoryRecords.map(record => 
                    Queries.insert('inventory', record)
                );
                
                const results = await Promise.all(insertPromises);
                successCount = results.filter(r => r.isOk).length;
                failCount = results.length - successCount;
            }
        } else {
            console.warn('⚠️ EdgeFunctions not available, using direct insert');
            // Fallback to direct insert
            const insertPromises = inventoryRecords.map(record => 
                Queries.insert('inventory', record)
            );
            
            const results = await Promise.all(insertPromises);
            successCount = results.filter(r => r.isOk).length;
            failCount = results.length - successCount;
        }
        
        if (successCount > 0) {
            // Update the currentSN in config
            const lastEntry = validEntries[validEntries.length - 1];
            const lastSequence = parseInt(lastEntry.sn.split('-')[1]) || window.FormUtilitiesState.currentSNSequence;
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
                
                // Get Installed and Removed status IDs to exclude them
                const installedStatus = state.statuses.find(s => s.name === 'Installed');
                const removedStatus = state.statuses.find(s => s.name === 'Removed');
                const excludeStatusIds = [installedStatus?.id, removedStatus?.id].filter(Boolean);
                
                // Filter to serialized items (inventory_type_id === 1) for the selected SLOC, excluding Installed and Removed
                const serializedInventory = state.inventory.filter(item => {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    return itemType && itemType.inventory_type_id === 1 && !excludeStatusIds.includes(item.status_id);
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

// Issue process state (managed by FormUtilitiesState)
// let isSelectingForIssue = false;
// let selectedItemsForIssue = [];

// Start issue process
function startIssueProcess() {
    const state = Store.getState();
    
    if (!state.selectedMarket || !state.selectedSloc) {
        Components.showToast('Please select a Market and SLOC first', 'warning');
        return;
    }
    
    window.FormUtilitiesState.isSelectingForIssue = true;
    window.FormUtilitiesState.selectedItemsForIssue = [];
    
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
    window.FormUtilitiesState.isSelectingForIssue = false;
    window.FormUtilitiesState.selectedItemsForIssue = [];
    
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
        // Remove selected-row class from all rows
        const selectedRows = rightColumn.querySelectorAll('tr.selected-row');
        selectedRows.forEach(row => row.classList.remove('selected-row'));
    }
    
    // Update the selected items list display to show "No items selected"
    updateSelectedItemsList();
    
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
    const hasItemsSelected = window.FormUtilitiesState.selectedItemsForIssue.length > 0;
    
    const isValid = hasCrewSelected && hasAreaSelected && hasItemsSelected;
    completeBtn.disabled = !isValid;
}

// Toggle item selection
function toggleItemSelection(item) {
    const index = window.FormUtilitiesState.selectedItemsForIssue.findIndex(i => i.id === item.id);
    
    if (index >= 0) {
        // Remove from selection
        window.FormUtilitiesState.selectedItemsForIssue.splice(index, 1);
    } else {
        // Add to selection
        window.FormUtilitiesState.selectedItemsForIssue.push(item);
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
    
    if (window.FormUtilitiesState.selectedItemsForIssue.length === 0) {
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
        window.FormUtilitiesState.selectedItemsForIssue.map(item => {
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
    if (window.FormUtilitiesState.selectedItemsForIssue.length === 0) {
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
    showIssueActionModal(window.FormUtilitiesState.selectedItemsForIssue, issueAction, { 
        requireSelections: false,
        preselectedCrew: preselectedCrew,
        preselectedArea: preselectedArea,
        sourceView: 'serialized',
        onSuccess: () => {
            // Clear selections after successful issue
            cancelIssueProcess(false);
        }
    });
}

// Refresh inventory display
function refreshInventoryDisplay() {
    const rightColumn = document.querySelector('.right-column');
    if (!rightColumn) return;
    
    const state = Store.getState();
    
    // Get Installed and Removed status IDs to exclude them
    const installedStatus = state.statuses.find(s => s.name === 'Installed');
    const removedStatus = state.statuses.find(s => s.name === 'Removed');
    const excludeStatusIds = [installedStatus?.id, removedStatus?.id].filter(Boolean);
    
    let serializedInventory = state.inventory.filter(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        // Filter to serialized items, excluding Installed and Removed
        return itemType && itemType.inventory_type_id === 1 && !excludeStatusIds.includes(item.status_id);
    });
    
    // If in issue selection mode, filter to only Available status
    if (window.FormUtilitiesState.isSelectingForIssue) {
        const availableStatus = state.statuses.find(s => s.name === 'Available');
        if (availableStatus) {
            serializedInventory = serializedInventory.filter(item => item.status_id === availableStatus.id);
        }
    }
    
    // Build hierarchy and filter by visibility preferences
    const hierarchicalInventory = InventoryProcessing.buildHierarchicalInventory(
        serializedInventory,
        state.itemTypes,
        state.categories
    );
    const visibleHierarchy = InventoryProcessing.filterHierarchicalByVisibility(
        hierarchicalInventory,
        state.statuses
    );
    
    // Build and update inventory display
    rightColumn.innerHTML = '';
    rightColumn.appendChild(createElement('h2', { className: 'section-header' }, ['Serialized Inventory']));
    rightColumn.appendChild(buildHierarchyFromData(visibleHierarchy, state));
}

// Batch entry state (managed by FormUtilitiesState)
// let batchEntries = [];
// let currentSNSequence = 0;
// let isManualEntryMode = false;

// Handle item type selection change
async function handleItemTypeChange(itemTypeId) {
    const state = Store.getState();
    const noteContainer = byId('units-per-package-note');
    const batchCountInput = byId('batch_count');
    
    if (!itemTypeId) {
        noteContainer.style.display = 'none';
        batchCountInput.value = '';
        batchCountInput.disabled = false;
        window.FormUtilitiesState.isManualEntryMode = false;
        window.clearBatchTable();
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
        window.FormUtilitiesState.currentSNSequence = parseInt(configResult.value) || 0;
    } else {
        window.FormUtilitiesState.currentSNSequence = 0;
    }
    
    // Initialize with one empty row for manual entry
    window.FormUtilitiesState.batchEntries = [{
        sn: generateSN(window.FormUtilitiesState.currentSNSequence + 1),
        mfgrSn: '',
        units: itemType.units_per_package,
        interacted: false  // Not yet interacted with
    }];
    batchCountInput.value = '';
    batchCountInput.disabled = false;
    window.FormUtilitiesState.isManualEntryMode = false;
    window.renderBatchTable();
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

// DEPRECATED: Modal functions moved to js/ui/inventory-modals.js
// Keeping stubs for backwards compatibility

function showConsolidatedItemsModal(row) {
    return InventoryModals.showConsolidatedItems(row);
}

async function showInventoryActionsModal(item) {
    return InventoryModals.showInventoryActions(item);
}

function showSetSequentialPrompt(item) {
    return InventoryModals.showSetSequential(item);
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

// Helper: Build issue modal items table from template
function buildIssueModalItemsTable(items, isSingleBulkItem, issueQuantities, state) {
    const tableClone = cloneTemplate('issue-action-modal-template');
    if (!tableClone) {
        throw new Error('Failed to load issue-action-modal-template. Check that templates are defined in index.html');
    }
    
    // Populate items tbody from template
    const tbody = tableClone.querySelector('[data-bind="items-list"]');
    if (!tbody) {
        throw new Error('Items list tbody not found in issue-action-modal-template');
    }
    
    items.forEach(item => {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const status = state.statuses.find(s => s.id === item.status_id);
        const serialId = item.tilsonsn || item.mfgrsn || '-';
        
        const tr = createElement('tr', {}, [
            createElement('td', {}, [itemType?.name || 'Unknown']),
            createElement('td', {}, [serialId]),
            isSingleBulkItem ? 
                createElement('td', {}, [
                    createElement('input', {
                        type: 'text',
                        id: 'issue-quantity-input',
                        className: 'form-control',
                        value: String(item.quantity),
                        style: { width: '80px', textAlign: 'center' },
                        maxlength: 9,
                        oninput: (e) => {
                            e.target.value = e.target.value.replace(/[^0-9]/g, '');
                            const val = parseInt(e.target.value) || 0;
                            if (val > item.quantity) {
                                e.target.value = String(item.quantity);
                            }
                            issueQuantities[item.id] = parseInt(e.target.value) || 0;
                        }
                    })
                ]) :
                createElement('td', {}, [String(item.quantity || 1)]),
            createElement('td', {}, [status?.name || 'Unknown'])
        ]);
        tbody.appendChild(tr);
    });
    
    return tableClone;
}

    // ========================================
    // GLOBAL EXPOSURE
    // ========================================

    // Receive processing
    window.processSerializedReceive = processSerializedReceive;

    // Issue workflow
    window.processSerializedIssue = processSerializedIssue;
    window.startIssueProcess = startIssueProcess;
    window.cancelIssueProcess = cancelIssueProcess;
    window.validateIssueForm = validateIssueForm;
    window.toggleItemSelection = toggleItemSelection;
    window.updateSelectedItemsList = updateSelectedItemsList;
    window.completeIssueProcess = completeIssueProcess;

    // Inventory display
    window.refreshInventoryDisplay = refreshInventoryDisplay;
    window.handleItemTypeChange = handleItemTypeChange;
    window.updateStatusColor = updateStatusColor;

    // Modal builders
    window.showSetSequentialPrompt = showSetSequentialPrompt;
    window.handleInventoryAction = handleInventoryAction;
    window.showConsolidatedItemsModal = showConsolidatedItemsModal;
    window.showInventoryActionsModal = showInventoryActionsModal;
    window.buildIssueModalItemsTable = buildIssueModalItemsTable;

})();

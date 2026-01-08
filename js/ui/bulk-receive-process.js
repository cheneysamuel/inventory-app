/**
 * Bulk Receive Process Functions
 * Extracted from receiveBulk view to improve maintainability
 * 
 * This module handles the business logic for bulk receive and issue processes:
 * - Receive Process: Begin, validate, complete, cancel, execute
 * - Issue Process: Begin, validate, complete, cancel, execute
 * - UI State Management: Toggle sections, rebuild tables
 */

const BulkReceiveProcess = (() => {
    
    // ==================== RECEIVE PROCESS ====================
    
    /**
     * Begin bulk receive process
     * Activates receive mode and shows input fields
     */
    const beginBulkReceiveProcess = () => {
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
        
        // Build active controls
        buildReceiveActiveControls();
        
        // Rebuild table with receive mode enabled
        rebuildTable(true, false);
        
        Components.showToast('Receive mode activated. Enter quantities to receive.', 'info');
    };
    
    /**
     * Build receive process active controls (notes textarea and buttons)
     */
    const buildReceiveActiveControls = () => {
        const activeDiv = byId('bulk-receive-active');
        if (!activeDiv) return;
        
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
                onclick: () => window.cancelBulkReceiveProcess()
            }, ['Cancel']),
            createElement('button', {
                id: 'complete-bulk-receive-btn',
                className: 'btn btn-primary',
                style: { flex: '1' },
                disabled: true,
                onclick: () => window.completeBulkReceiveProcess()
            }, ['Complete Receive Process'])
        ]);
        activeDiv.appendChild(buttonsDiv);
    };
    
    /**
     * Cancel bulk receive process
     * @param {boolean} silent - Whether to suppress toast message
     */
    const cancelBulkReceiveProcess = (silent = false) => {
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
        rebuildTable(false, false);
        
        if (!silent) {
            Components.showToast('Receive process cancelled', 'info');
        }
    };
    
    /**
     * Validate bulk receive form
     * Enables complete button only if valid quantities entered
     */
    const validateBulkReceiveForm = () => {
        const completeBtn = byId('complete-bulk-receive-btn');
        if (!completeBtn) return;
        
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        let hasValidQuantity = false;
        
        qtyInputs.forEach(input => {
            const value = parseInt(input.value);
            if (value && value > 0) {
                hasValidQuantity = true;
            }
        });
        
        completeBtn.disabled = !hasValidQuantity;
        
        if (hasValidQuantity) {
            completeBtn.classList.remove('btn-disabled');
        } else {
            completeBtn.classList.add('btn-disabled');
        }
    };
    
    /**
     * Complete bulk receive process
     * Collects quantities and shows receive modal
     */
    const completeBulkReceiveProcess = async () => {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('No SLOC selected', 'error');
            return;
        }
        
        const itemsToReceive = collectItemsFromInputs();
        
        if (itemsToReceive.length === 0) {
            Components.showToast('No items to receive', 'warning');
            return;
        }
        
        // Use unified receive modal
        showReceiveActionModal(itemsToReceive, { sourceView: 'receive-bulk' });
    };
    
    /**
     * Execute bulk receive operation
     * @param {Array} itemsToReceive - Items to receive with quantities
     */
    const executeBulkReceive = async (itemsToReceive) => {
        const state = Store.getState();
        
        // Get receiving status from preferences
        const receivingStatusName = (state.config || []).find(c => c.key === 'receivingStatus')?.value || 'Available';
        const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
        
        if (!receivingStatus) {
            Components.showToast('Receiving status not found', 'error');
            return;
        }
        
        // Get warehouse location
        const warehouseLocation = state.locations.find(l => l.name === 'Warehouse');
        
        if (!warehouseLocation) {
            Components.showToast('Warehouse location not found', 'error');
            console.error('Available locations:', state.locations);
            return;
        }
        
        try {
            console.log('📦 [executeBulkReceive] Starting bulk receive for', itemsToReceive.length, 'items');
            Components.showToast(`Receiving ${itemsToReceive.length} item(s)...`, 'info');
            
            const results = await processReceiveItems(itemsToReceive, warehouseLocation, receivingStatus, state);
            
            await refreshInventoryAfterOperation(state);
            
            showOperationResults(results, 'received');
            
            cancelBulkReceiveProcess(true);
            
        } catch (error) {
            console.error('Error completing bulk receive:', error);
            Components.showToast('Error completing receive process', 'error');
        }
    };
    
    /**
     * Process receive items - upsert inventory and create transactions
     * @param {Array} items - Items to receive
     * @param {Object} location - Warehouse location
     * @param {Object} status - Receiving status
     * @param {Object} state - Application state
     * @returns {Promise<Array>} Results array
     */
    const processReceiveItems = async (items, location, status, state) => {
        const results = [];
        
        for (const item of items) {
            console.log('📦 [executeBulkReceive] Receiving item:', item.item_type_name, 'qty:', item.quantity);
            
            const inventoryData = {
                location_id: location.id,
                assigned_crew_id: null,
                area_id: null,
                item_type_id: item.item_type_id,
                quantity: item.quantity,
                status_id: status.id,
                sloc_id: state.selectedSloc.id
            };
            
            const result = await Queries.upsertBulkInventory(inventoryData, 'add');
            console.log('📦 [executeBulkReceive] Upsert result:', result);
            
            if (result.isOk) {
                await Queries.createTransaction({
                    inventory_id: result.value.inventory_id,
                    transaction_type: 'Receive',
                    action: 'Receive from Vendor',
                    item_type_name: item.item_type_name,
                    quantity: item.quantity,
                    to_location_name: 'Warehouse',
                    status_name: status.name,
                    notes: `Bulk receive: ${result.value.operation === 'created' ? 'New record' : 'Updated existing'}`
                });
                
                results.push({ success: true, ...result.value });
            } else {
                console.error('📦 [executeBulkReceive] Failed to receive item:', result.error);
                results.push({ success: false, error: result.error });
            }
        }
        
        return results;
    };
    
    // ==================== ISSUE PROCESS ====================
    
    /**
     * Begin bulk issue process
     * Activates issue mode and shows crew/area selectors
     */
    const beginBulkIssueProcess = () => {
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
        
        // Build active controls
        buildIssueActiveControls(state);
        
        // Rebuild table with issue mode enabled (filtered to available items)
        rebuildTable(false, true);
        
        Components.showToast('Issue mode activated. Select crew, area, and enter quantities.', 'info');
    };
    
    /**
     * Build issue process active controls (crew/area dropdowns and buttons)
     * @param {Object} state - Application state
     */
    const buildIssueActiveControls = (state) => {
        const activeDiv = byId('bulk-issue-active');
        if (!activeDiv) return;
        
        activeDiv.style.display = 'block';
        activeDiv.innerHTML = '';
        
        // Get crews for selected market and areas for selected SLOC
        const marketCrews = state.selectedMarket 
            ? (state.crews || []).filter(c => c.market_id === state.selectedMarket.id)
            : [];
        const slocAreas = (state.areas || []).filter(a => a.sloc_id === state.selectedSloc.id);
        
        // Crew dropdown
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
            onchange: () => window.validateBulkIssueForm()
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
            onchange: () => window.validateBulkIssueForm()
        }));
        
        // Buttons
        const buttonsDiv = div({ style: { display: 'flex', gap: '0.5rem', marginTop: '1rem' } }, [
            createElement('button', {
                id: 'cancel-bulk-issue-btn',
                className: 'btn btn-secondary',
                style: { flex: '1' },
                onclick: () => window.cancelBulkIssueProcess()
            }, ['Cancel']),
            createElement('button', {
                id: 'complete-bulk-issue-btn',
                className: 'btn btn-primary',
                style: { flex: '1' },
                disabled: true,
                onclick: () => window.completeBulkIssueProcess()
            }, ['Complete Process'])
        ]);
        activeDiv.appendChild(buttonsDiv);
    };
    
    /**
     * Cancel bulk issue process
     */
    const cancelBulkIssueProcess = () => {
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
        
        // Rebuild table with issue mode disabled
        rebuildTable(false, false);
    };
    
    /**
     * Validate bulk issue form
     * Enables complete button only if crew, area selected and valid quantities entered
     */
    const validateBulkIssueForm = () => {
        const crewSelect = byId('bulk-issue-crew');
        const areaSelect = byId('bulk-issue-area');
        const completeBtn = byId('complete-bulk-issue-btn');
        
        if (!completeBtn) return;
        
        const crewSelected = crewSelect && crewSelect.value;
        const areaSelected = areaSelect && areaSelect.value;
        
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        let hasValidQuantity = false;
        let hasExceededQuantity = false;
        
        qtyInputs.forEach(input => {
            const value = parseInt(input.value);
            const availableQty = parseInt(input.getAttribute('data-available-qty')) || 0;
            
            input.style.color = '';
            
            if (value && value > 0) {
                hasValidQuantity = true;
                
                if (value > availableQty) {
                    hasExceededQuantity = true;
                    input.style.color = 'red';
                }
            }
        });
        
        const isValid = crewSelected && areaSelected && hasValidQuantity && !hasExceededQuantity;
        completeBtn.disabled = !isValid;
        
        if (isValid) {
            completeBtn.classList.remove('btn-disabled');
        } else {
            completeBtn.classList.add('btn-disabled');
        }
    };
    
    /**
     * Complete bulk issue process
     * Collects selections and shows issue modal
     */
    const completeBulkIssueProcess = async () => {
        const state = Store.getState();
        
        if (!state.selectedSloc) {
            Components.showToast('No SLOC selected', 'error');
            return;
        }
        
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
        
        const itemsToIssue = collectItemsForIssue(state);
        
        if (itemsToIssue.length === 0) {
            Components.showToast('No valid items to issue', 'warning');
            return;
        }
        
        const issueAction = state.actionTypes.find(a => a.name === 'Issue') || { name: 'Issue', allow_pdf: true };
        
        showBulkIssueModal(itemsToIssue, issueAction, { crew, area });
    };
    
    /**
     * Collect items for issue from quantity inputs
     * @param {Object} state - Application state
     * @returns {Array} Items to issue
     */
    const collectItemsForIssue = (state) => {
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        const itemsToIssue = [];
        
        qtyInputs.forEach(input => {
            const quantity = parseInt(input.value);
            const availableQty = parseInt(input.getAttribute('data-available-qty')) || 0;
            
            if (quantity && quantity > 0 && quantity <= availableQty) {
                const itemTypeId = parseInt(input.getAttribute('data-item-type-id'));
                const itemType = state.itemTypes.find(it => it.id === itemTypeId);
                const status = state.statuses.find(s => s.name === 'Available');
                
                itemsToIssue.push({
                    item_type_id: itemTypeId,
                    quantity: quantity,
                    status_id: status?.id,
                    mfgrsn: null,
                    tilsonsn: `BULK-${itemType?.name || 'Item'}`
                });
            }
        });
        
        return itemsToIssue;
    };
    
    /**
     * Execute bulk issue action
     * @param {Array} items - Items to issue
     * @param {Object} assignments - Crew and area assignments
     */
    const executeBulkIssueAction = async (items, assignments) => {
        const state = Store.getState();
        const { crew, area } = assignments;
        
        const availableStatus = state.statuses.find(s => s.name === 'Available');
        const issuedStatus = state.statuses.find(s => s.name === 'Issued');
        
        if (!availableStatus || !issuedStatus) {
            Components.showToast('Required statuses not found', 'error');
            return;
        }
        
        const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
        
        if (!withCrewLocation) {
            Components.showToast('With Crew location not found', 'error');
            return;
        }
        
        const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
        const sourceLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
        
        if (!sourceLocation) {
            Components.showToast('Receiving location not set in preferences', 'error');
            return;
        }
        
        try {
            Components.showToast(`Issuing ${items.length} item(s)...`, 'info');
            
            const results = await processIssueItems(items, sourceLocation, withCrewLocation, availableStatus, issuedStatus, crew, area, state);
            
            await refreshInventoryAfterOperation(state);
            
            showOperationResults(results, 'issued');
            
        } catch (error) {
            console.error('Error executing bulk issue:', error);
            Components.showToast('Error completing issue process', 'error');
        }
    };
    
    /**
     * Process issue items - subtract from source, add to With Crew, create transactions
     * @param {Array} items - Items to issue
     * @param {Object} sourceLocation - Source location
     * @param {Object} withCrewLocation - With Crew location
     * @param {Object} availableStatus - Available status
     * @param {Object} issuedStatus - Issued status
     * @param {Object} crew - Crew assignment
     * @param {Object} area - Area assignment
     * @param {Object} state - Application state
     * @returns {Promise<Array>} Results array
     */
    const processIssueItems = async (items, sourceLocation, withCrewLocation, availableStatus, issuedStatus, crew, area, state) => {
        const results = [];
        
        for (const item of items) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            
            // Try edge function first (check if EdgeFunctions is available)
            if (typeof EdgeFunctions !== 'undefined' && EdgeFunctions.bulkIssueInventory) {
                console.log('📡 Attempting bulk issue via edge function for item:', item.item_type_id);
                
                const edgeResult = await EdgeFunctions.bulkIssueInventory({
                    item_type_id: item.item_type_id,
                    quantity: item.quantity,
                    sloc_id: state.selectedSloc.id,
                    source_location_id: sourceLocation.id,
                    source_status_id: availableStatus.id,
                    target_location_id: withCrewLocation.id,
                    target_status_id: issuedStatus.id,
                    crew_id: crew.id,
                    area_id: area.id,
                    notes: `Bulk issue to ${crew.name} - ${area.name}`
                });
                
                if (edgeResult.isOk) {
                    console.log('✅ Edge function succeeded for item:', item.item_type_id);
                    results.push({ success: true, ...edgeResult.value });
                    continue;
                }
                
                console.warn('⚠️ Edge function failed, using fallback for bulk issue:', edgeResult.error);
            } else {
                console.warn('⚠️ EdgeFunctions not available, using fallback');
            }
            
            // Fallback to direct database operations
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
            
            // Add to With Crew
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
        
        return results;
    };
    
    // ==================== SHARED UTILITIES ====================
    
    /**
     * Collect items from quantity inputs
     * @returns {Array} Items with quantities
     */
    const collectItemsFromInputs = () => {
        const state = Store.getState();
        const qtyInputs = document.querySelectorAll('.bulk-qty-input:not([disabled])');
        const items = [];
        
        qtyInputs.forEach(input => {
            const quantity = parseInt(input.value);
            if (quantity && quantity > 0) {
                const itemTypeId = parseInt(input.getAttribute('data-item-type-id'));
                const itemType = state.itemTypes.find(it => it.id === itemTypeId);
                if (itemType) {
                    items.push({ 
                        item_type_id: itemTypeId, 
                        item_type_name: itemType.name,
                        quantity 
                    });
                }
            }
        });
        
        return items;
    };
    
    /**
     * Rebuild bulk items table with specified modes
     * @param {boolean} receiveMode - Receive mode enabled
     * @param {boolean} issueMode - Issue mode enabled
     */
    const rebuildTable = (receiveMode, issueMode) => {
        const state = Store.getState();
        const bulkItemTypes = BulkReceiveHelpers.getFilteredBulkItemTypes(state.itemTypes, state);
        const tableData = BulkReceiveHelpers.buildBulkTableData(bulkItemTypes, state);
        const tableContainer = byId('bulk-items-table-container');
        
        if (tableContainer) {
            tableContainer.innerHTML = '';
            tableContainer.appendChild(BulkReceiveHelpers.renderBulkItemsTable(tableData, receiveMode, issueMode));
        }
    };
    
    /**
     * Refresh inventory after operation (consolidate and re-query)
     * @param {Object} state - Application state
     */
    const refreshInventoryAfterOperation = async (state) => {
        console.log('🔄 About to refresh inventory for SLOC:', state.selectedSloc?.id);
        
        if (state.selectedSloc) {
            // Consolidate duplicate records
            console.log('🔀 Running auto-consolidation...');
            const consolidationResult = await Consolidation.consolidateBulkInventory(state.selectedSloc.id);
            if (consolidationResult.isOk && consolidationResult.value.consolidated > 0) {
                console.log(`✅ Consolidated ${consolidationResult.value.consolidated} groups, deleted ${consolidationResult.value.deleted} duplicate records`);
            }
            
            // Re-query inventory
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            console.log('🔄 Inventory query result:', inventoryResult.isOk ? `Success (${inventoryResult.value.length} items)` : `Failed: ${inventoryResult.error}`);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
                console.log('✅ State updated with', inventoryResult.value.length, 'inventory items');
            }
        }
    };
    
    /**
     * Show operation results toast
     * @param {Array} results - Results array
     * @param {string} operation - Operation name (received/issued)
     */
    const showOperationResults = (results, operation) => {
        const successCount = results.filter(r => r.success).length;
        const failCount = results.length - successCount;
        
        if (failCount === 0) {
            Components.showToast(`Successfully ${operation} ${successCount} item type(s)`, 'success');
        } else {
            Components.showToast(`${operation.charAt(0).toUpperCase() + operation.slice(1)} ${successCount} item(s), ${failCount} failed`, 'warning');
        }
    };
    
    // ==================== PUBLIC API ====================
    
    return {
        // Receive process
        beginBulkReceiveProcess,
        cancelBulkReceiveProcess,
        validateBulkReceiveForm,
        completeBulkReceiveProcess,
        executeBulkReceive,
        
        // Issue process
        beginBulkIssueProcess,
        cancelBulkIssueProcess,
        validateBulkIssueForm,
        completeBulkIssueProcess,
        executeBulkIssueAction
    };
})();

// Make functions available globally
window.beginBulkReceiveProcess = BulkReceiveProcess.beginBulkReceiveProcess;
window.cancelBulkReceiveProcess = BulkReceiveProcess.cancelBulkReceiveProcess;
window.validateBulkReceiveForm = BulkReceiveProcess.validateBulkReceiveForm;
window.completeBulkReceiveProcess = BulkReceiveProcess.completeBulkReceiveProcess;
window.executeBulkReceive = BulkReceiveProcess.executeBulkReceive;

window.beginBulkIssueProcess = BulkReceiveProcess.beginBulkIssueProcess;
window.cancelBulkIssueProcess = BulkReceiveProcess.cancelBulkIssueProcess;
window.validateBulkIssueForm = BulkReceiveProcess.validateBulkIssueForm;
window.completeBulkIssueProcess = BulkReceiveProcess.completeBulkIssueProcess;
window.executeBulkIssueAction = BulkReceiveProcess.executeBulkIssueAction;

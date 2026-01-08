/**
 * Serialized Inventory Modals and Actions
 * 
 * Extracted from views.js - Contains all modal dialogs and action execution
 * functions for serialized inventory operations.
 */

(function() {
    'use strict';

    // ========================================
    // MODAL FUNCTIONS
    // ========================================

function showIssueActionModal(items, action, options = {}) {
    console.log('=== showIssueActionModal called ===');
    console.log('Items:', items, 'Action:', action, 'Options:', options);
    
    const state = Store.getState();
    const { requireSelections = false, preselectedCrew = null, preselectedArea = null, sourceView = null, onSuccess = null } = options;
    const helpers = SerializedModalHelpers;
    
    // Detect source view
    const detectedSourceView = helpers.detectSourceView(sourceView, state);
    console.log('📍 Source view detected:', detectedSourceView);
    
    // Check if single bulk item and initialize quantities
    const isSingleBulkItem = helpers.isSingleBulkItem(items, state);
    const issueQuantities = isSingleBulkItem ? helpers.initializeIssueQuantities(items) : {};
    const totalQuantity = helpers.calculateTotalQuantity(items);
    
    // State variables
    let selectedCrew = preselectedCrew;
    let selectedArea = preselectedArea;
    let signaturePad = null;
    
    // Build modal content from template
    const modalContentFragment = buildIssueModalItemsTable(items, isSingleBulkItem, issueQuantities, state);
    if (!modalContentFragment) {
        console.error('Failed to build issue modal - template not found');
        Components.showToast('Error loading issue modal. Please refresh the page.', 'error');
        return;
    }
    
    // Extract modal content element
    const modalContentDiv = helpers.extractElementFromFragment(modalContentFragment);
    if (!modalContentDiv) {
        console.error('Failed to extract modal content element from template fragment');
        Components.showToast('Error loading issue modal. Please refresh the page.', 'error');
        return;
    }
    
    // Get section references
    const selectionSection = helpers.safeQuerySelector(modalContentDiv, '[data-bind="selection-section"]');
    const summarySection = helpers.safeQuerySelector(modalContentDiv, '[data-bind="summary-section"]');
    const signatureSection = helpers.safeQuerySelector(modalContentDiv, '[data-bind="signature-section"]');
    
    // Setup selection section if required
    if (requireSelections && selectionSection) {
        setupSelectionSection(selectionSection, modalContentDiv, state, helpers, (crew, area) => {
            if (crew !== null) selectedCrew = crew;
            if (area !== null) selectedArea = area;
        });
    }
    
    // Update summary section
    if (summarySection) {
        updateSummarySection(summarySection, items.length, totalQuantity, preselectedCrew, preselectedArea);
    }
    
    // Setup signature section (without event handlers yet)
    const signatureCanvas = setupSignatureSection(signatureSection, action, helpers);
    
    // Create modal actions
    const modalActions = createIssueModalActions(
        requireSelections, selectedCrew, selectedArea, items, 
        detectedSourceView, isSingleBulkItem, issueQuantities, 
        action, () => signaturePad, () => selectedCrew, () => selectedArea
    );
    
    // Show modal
    const modal = Modals.create({
        title: 'Issue Inventory',
        content: [modalContentDiv],
        actions: modalActions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Focus quantity input for single bulk items
    if (isSingleBulkItem) {
        setTimeout(() => {
            const qtyInput = byId('issue-quantity-input');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        }, 150);
    }
    
    // Initialize signature pad and set up clear button AFTER modal is shown
    if (signatureCanvas && action.allow_pdf) {
        // Pass a callback to execute after signature pad is initialized
        helpers.initializeSignaturePad(signatureCanvas, 200, (pad) => {
            signaturePad = pad;
            
            // Now set up clear button handler with initialized pad
            const clearBtn = signatureSection.querySelector('[data-action="clear-signature"]');
            if (clearBtn && signaturePad) {
                clearBtn.addEventListener('click', () => {
                    helpers.clearSignaturePad(signaturePad);
                });
            }
        });
    }
}

// Helper function: Setup selection section
function setupSelectionSection(selectionSection, container, state, helpers, onSelectionChange) {
    selectionSection.style.display = 'block';
    
    // Filter crews and areas
    const { crews: filteredCrews, areas: filteredAreas } = helpers.filterSelectionsFromState(state);
    
    // Populate crew select
    const crewSelect = container.querySelector('#issue-crew-select');
    if (crewSelect) {
        helpers.populateCrewSelect(crewSelect, filteredCrews);
        crewSelect.addEventListener('change', (e) => {
            const crew = filteredCrews.find(c => c.id === parseInt(e.target.value));
            onSelectionChange(crew, null);
        });
    }
    
    // Populate area select
    const areaSelect = container.querySelector('#issue-area-select');
    if (areaSelect) {
        helpers.populateAreaSelect(areaSelect, filteredAreas);
        areaSelect.addEventListener('change', (e) => {
            const area = filteredAreas.find(a => a.id === parseInt(e.target.value));
            onSelectionChange(null, area);
        });
    }
}

// Helper function: Update summary section
function updateSummarySection(summarySection, itemCount, totalQuantity, preselectedCrew, preselectedArea) {
    const totalItems = summarySection.querySelector('[data-bind="total-items"]');
    const totalQty = summarySection.querySelector('[data-bind="total-quantity"]');
    if (totalItems) totalItems.textContent = itemCount;
    if (totalQty) totalQty.textContent = totalQuantity;
    
    if (preselectedCrew) {
        const crewDisplay = summarySection.querySelector('[data-bind="crew-display"]');
        const crewName = summarySection.querySelector('[data-bind="crew-name"]');
        if (crewDisplay) crewDisplay.style.display = 'block';
        if (crewName) crewName.textContent = preselectedCrew.name;
    }
    
    if (preselectedArea) {
        const areaDisplay = summarySection.querySelector('[data-bind="area-display"]');
        const areaName = summarySection.querySelector('[data-bind="area-name"]');
        if (areaDisplay) areaDisplay.style.display = 'block';
        if (areaName) areaName.textContent = preselectedArea.name;
    }
}

// Helper function: Setup signature section
function setupSignatureSection(signatureSection, action, helpers) {
    if (!action.allow_pdf || !signatureSection) {
        if (signatureSection) signatureSection.remove();
        return null;
    }
    
    signatureSection.style.display = 'block';
    const signatureCanvas = signatureSection.querySelector('#signature-canvas');
    
    // Note: Clear button handler is set up after signature pad initialization
    
    return signatureCanvas;
}

// Helper function: Create modal actions
function createIssueModalActions(requireSelections, crew, area, items, sourceView, isBulk, quantities, action, getSignaturePadFn, getCrewFn, getAreaFn) {
    return [
        {
            label: 'Complete Issue',
            type: 'primary',
            handler: async () => {
                const currentCrew = getCrewFn();
                const currentArea = getAreaFn();
                
                if (requireSelections && (!currentCrew || !currentArea)) {
                    Components.showToast('Please select both Crew and Area', 'error');
                    return;
                }
                
                const options = { 
                    crew: currentCrew, 
                    area: currentArea,
                    sourceView: sourceView
                };
                if (isBulk) {
                    options.issueQuantities = quantities;
                }
                
                await executeIssueAction(items, options, action);
                
                // Call onSuccess callback if provided
                if (typeof onSuccess === 'function') {
                    onSuccess();
                }
                
                // Auto-generate PDF if signature present
                const signaturePad = getSignaturePadFn();
                console.log('📄 [Issue Modal] Checking PDF generation:', { 
                    allow_pdf: action.allow_pdf, 
                    hasSignaturePad: !!signaturePad, 
                    isEmpty: signaturePad ? signaturePad.isEmpty() : 'N/A' 
                });
                
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                    console.log('📄 [Issue Modal] Generating PDF...');
                    await generateIssuePDF(items, { crew: currentCrew, area: currentArea }, signaturePad);
                } else {
                    console.log('📄 [Issue Modal] PDF generation skipped');
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
}

// Show Receive Action Modal (unified receive function for all entry points)
function showReceiveActionModal(items, options = {}) {
    console.log('=== showReceiveActionModal called ===');
    console.log('Items:', items, 'Options:', options);
    
    const state = Store.getState();
    const { sourceView = null } = options;
    const helpers = SerializedModalHelpers;
    
    // Detect source view
    const detectedSourceView = helpers.detectSourceView(sourceView, state);
    console.log('📍 Source view detected:', detectedSourceView);
    
    // Get receiving configuration
    const receivingConfig = getReceivingConfiguration(state);
    if (!receivingConfig) return; // Error already shown
    
    const { receivingStatus, receivingLocation } = receivingConfig;
    
    // Calculate total quantity
    const totalQuantity = helpers.calculateTotalQuantity(items);
    
    // Build modal content
    const modalContent = [
        buildReceiveItemsTable(items, state),
        buildReceiveSummary(items.length, totalQuantity, receivingLocation, receivingStatus)
    ];
    
    // Create modal actions
    const modalActions = [
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
            handler: () => Modals.close()
        }
    ];
    
    // Show modal
    const modal = Modals.create({
        title: 'Receive Inventory',
        content: modalContent,
        actions: modalActions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
}

// Helper function: Get receiving configuration from preferences
function getReceivingConfiguration(state) {
    const receivingStatusName = (state.config || []).find(c => c.key === 'receivingStatus')?.value || 'Available';
    const receivingStatus = state.statuses.find(s => s.name === receivingStatusName);
    
    if (!receivingStatus) {
        Components.showToast('Receiving status not found in preferences', 'error');
        return null;
    }
    
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return null;
    }
    
    return { receivingStatus, receivingLocation };
}

// Helper function: Build receive items table
function buildReceiveItemsTable(items, state) {
    return createElement('table', { className: 'inventory-table', style: { marginBottom: '1rem' } }, [
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
}

// Helper function: Build receive summary section
function buildReceiveSummary(itemCount, totalQuantity, receivingLocation, receivingStatus) {
    return div({ style: { marginTop: '1.5rem', padding: '1rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem' } }, [
        createElement('h4', { style: { margin: '0 0 0.5rem 0' } }, ['Receive Summary:']),
        div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
            div({}, [createElement('strong', {}, ['Total Items:']), ` ${itemCount}`]),
            div({}, [createElement('strong', {}, ['Total Quantity:']), ` ${totalQuantity}`]),
            div({}, [createElement('strong', {}, ['Receiving Location:']), ` ${receivingLocation.name}`]),
            div({}, [createElement('strong', {}, ['Status:']), ` ${receivingStatus.name}`])
        ])
    ]);
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

// Helper function to process a single serialized item issue (fallback)
async function processSingleSerializedIssue(item, crew, area, state, action) {
    const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
    const issuedStatus = state.statuses.find(s => s.name === 'Issued');
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    
    const updates = {
        location_id: withCrewLocation?.id || item.location_id,
        assigned_crew_id: crew?.id || item.assigned_crew_id,
        area_id: area?.id || item.area_id,
        status_id: issuedStatus?.id || item.status_id
    };
    
    await Database.update('inventory', item.id, updates);
    
    // Create transaction record
    await Queries.createTransaction({
        inventory_id: item.id,
        transaction_type: 'ISSUE',
        action: action.name,
        item_type_name: itemType?.name || 'Unknown',
        quantity: item.quantity || 1,
        status_name: 'Issued',
        old_status_name: state.statuses.find(s => s.id === item.status_id)?.name || 'Unknown',
        notes: `Issued to ${crew?.name || 'Crew'} - ${area?.name || 'Area'}`,
        user_name: state.user?.email || 'system'
    });
}

// Execute Issue Action
async function executeIssueAction(items, assignments, action) {
    const state = Store.getState();
    const { crew, area, issueQuantities, sourceView } = assignments;
    
    console.log('📍 [executeIssueAction] Source view:', sourceView);
    
    try {
        // Separate serialized and bulk items
        const serializedItems = [];
        const bulkAndOtherItems = [];
        
        items.forEach(item => {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const isSerializedItem = itemType && itemType.inventory_type_id === 1;
            
            if (isSerializedItem) {
                serializedItems.push(item);
            } else {
                bulkAndOtherItems.push(item);
            }
        });
        
        // Process serialized items via edge function (if available)
        if (serializedItems.length > 0 && window.EdgeFunctions && EdgeFunctions.issueSerializedInventory) {
            console.log('🚀 [executeIssueAction] Using issueSerializedInventory edge function for', serializedItems.length, 'items');
            
            const inventoryIds = serializedItems.map(item => item.id);
            const edgeResult = await EdgeFunctions.issueSerializedInventory(
                inventoryIds,
                crew?.id,
                area?.id,
                null, // location_id (edge function will use "With Crew")
                `Issued to ${crew?.name || 'Crew'} - ${area?.name || 'Area'}`
            );
            
            if (edgeResult.isOk) {
                console.log('✅ [executeIssueAction] Edge function succeeded for serialized items:', edgeResult.value);
            } else {
                console.warn('⚠️ [executeIssueAction] Edge function failed, falling back to direct updates:', edgeResult.error);
                // Fallback: process serialized items with direct DB calls
                for (const item of serializedItems) {
                    await processSingleSerializedIssue(item, crew, area, state, action);
                }
            }
        } else if (serializedItems.length > 0) {
            console.warn('⚠️ [executeIssueAction] EdgeFunctions not available, using direct updates for serialized items');
            // Fallback: process serialized items with direct DB calls
            for (const item of serializedItems) {
                await processSingleSerializedIssue(item, crew, area, state, action);
            }
        }
        
        // Process bulk/other items (existing logic)
        for (const item of bulkAndOtherItems) {
            const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
            const isBulkItem = itemType && itemType.inventory_type_id === 2;
            const issueQty = issueQuantities ? issueQuantities[item.id] : item.quantity;
            const isPartialIssue = isBulkItem && issueQty < item.quantity;
            
            // Try edge function for bulk items (both full and partial)
            if (isBulkItem && typeof EdgeFunctions !== 'undefined' && EdgeFunctions.bulkIssueInventory) {
                console.log('📡 [executeIssueAction] Attempting bulk issue via edge function for item:', item.id);
                
                const availableStatus = state.statuses.find(s => s.name === 'Available');
                const issuedStatus = state.statuses.find(s => s.name === 'Issued');
                const withCrewLocation = state.locations.find(l => l.name === 'With Crew');
                
                if (!availableStatus || !issuedStatus || !withCrewLocation) {
                    console.warn('⚠️ [executeIssueAction] Required statuses/locations not found, using fallback');
                } else {
                    try {
                        const result = await EdgeFunctions.bulkIssueInventory({
                            item_type_id: item.item_type_id,
                            quantity: issueQty,
                            sloc_id: item.sloc_id,
                            source_location_id: item.location_id,
                            source_status_id: item.status_id || availableStatus.id,
                            target_location_id: withCrewLocation.id,
                            target_status_id: issuedStatus.id,
                            crew_id: crew?.id,
                            area_id: area?.id,
                            notes: `Issued to ${crew?.name || 'Crew'} - ${area?.name || 'Area'}`
                        });
                        
                        if (result.isOk) {
                            console.log('✅ [executeIssueAction] Edge function succeeded for item:', item.id, 'Result:', result.value);
                            
                            // If partial issue, update the original record's quantity
                            if (isPartialIssue) {
                                const remainingQty = item.quantity - issueQty;
                                await Database.update('inventory', item.id, {
                                    quantity: remainingQty
                                });
                            }
                            
                            continue; // Skip fallback logic
                        } else {
                            console.warn('⚠️ [executeIssueAction] Edge function returned error:', result.error);
                        }
                    } catch (edgeError) {
                        console.error('❌ [executeIssueAction] Edge function error:', edgeError);
                    }
                }
            } else if (isBulkItem) {
                console.log('⚠️ [executeIssueAction] EdgeFunctions not available, using fallback for item:', item.id);
            }
            
            // Fallback to direct DB operations
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
                    item_type_name: itemType?.name || 'Unknown',
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
                    item_type_name: itemType?.name || 'Unknown',
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
            
            // Check if we have access to cancelIssueProcess (for issue selection mode)
            if (typeof window.cancelIssueProcess === 'function') {
                // Cancel any ongoing issue selection process
                window.cancelIssueProcess(false); // false = don't show "cancelled" message
            } else {
                // Just refresh the display
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
    const helpers = SerializedModalHelpers;
    
    // Detect source view
    const sourceView = helpers.detectSourceView(null, state);
    
    // Check if single bulk item and initialize quantities
    const isSingleBulkItem = helpers.isSingleBulkItem(items, state);
    const returnQuantities = isSingleBulkItem ? helpers.initializeIssueQuantities(items) : {};
    
    // Get receiving location from preferences
    const receivingLocation = getReceivingLocationFromPreferences(state);
    if (!receivingLocation) return; // Error already shown
    
    // Calculate total quantity
    const totalQuantity = helpers.calculateTotalQuantity(items);
    
    // Build installation question section
    const installQuestionSection = div({ 
        style: { 
            marginBottom: '1rem', 
            padding: '0.75rem', 
            backgroundColor: '#f9fafb', 
            borderRadius: '0.375rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            border: '1px solid #e5e7eb'
        } 
    }, [
        createElement('span', { 
            style: { 
                fontStyle: 'italic', 
                color: '#374151',
                flex: '1'
            } 
        }, [`Has any of the ${totalQuantity} unit${totalQuantity !== 1 ? 's' : ''} been installed?`]),
        button('Install Units', {
            className: 'btn btn-primary',
            style: { fontSize: '0.875rem', whiteSpace: 'nowrap' },
            onclick: () => {
                Modals.close();
                showFieldInstallModal(items, action);
            }
        })
    ]);
    
    // Build modal content
    const itemsTable = buildReturnMaterialItemsTable(items, state, isSingleBulkItem);
    const { signatureSection, signatureCanvas } = buildReturnSignatureSection(action);
    
    const modalContent = [installQuestionSection, itemsTable, signatureSection].filter(Boolean);
    
    // Signature pad variable (initialized after modal shown)
    let signaturePad = null;
    
    // Create modal actions
    const modalActions = createReturnModalActions(
        items, isSingleBulkItem, returnQuantities, sourceView, 
        action, () => signaturePad, state, receivingLocation
    );
    
    // Show modal
    const modal = Modals.create({
        title: `Return Material to ${receivingLocation.name}`,
        content: modalContent,
        actions: modalActions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Post-show initialization
    initializeReturnModal(isSingleBulkItem, signatureCanvas, action, (pad) => { signaturePad = pad; });
}

// Helper: Get receiving location from preferences
function getReceivingLocationFromPreferences(state) {
    const receivingLocationId = (state.config || []).find(c => c.key === 'receivingLocation')?.value;
    const receivingLocation = receivingLocationId ? state.locations.find(l => l.id === parseInt(receivingLocationId)) : null;
    
    if (!receivingLocation) {
        Components.showToast('Receiving location not set in preferences', 'error');
        return null;
    }
    
    return receivingLocation;
}

// Helper: Build return material items table
function buildReturnMaterialItemsTable(items, state, isSingleBulkItem) {
    const tableHeaders = [
        createElement('th', {}, ['Item']),
        createElement('th', {}, ['Current Location']),
        createElement('th', {}, ['Crew']),
        createElement('th', {}, ['Area']),
        createElement('th', {}, ['Quantity'])
    ];
    
    const tableRows = items.map(item => buildReturnMaterialItemRow(item, state, isSingleBulkItem));
    
    return createElement('table', { 
        className: 'inventory-table', 
        style: { width: '100%', marginBottom: '15px' } 
    }, [
        createElement('thead', {}, [createElement('tr', {}, tableHeaders)]),
        createElement('tbody', {}, tableRows)
    ]);
}

// Helper: Build single return material item row
function buildReturnMaterialItemRow(item, state, isSingleBulkItem) {
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
    
    // Add quantity column
    if (isSingleBulkItem) {
        const qtyInput = createElement('input', {
            type: 'text',
            className: 'return-qty-input',
            'data-item-id': String(item.id),
            value: String(item.quantity),
            style: { width: '200px', fontSize: '18px', padding: '8px' },
            oninput: (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                e.target.value = pastedText.replace(/[^0-9]/g, '');
            }
        });
        
        rowCells.push(createElement('td', {}, [
            qtyInput,
            createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity}`])
        ]));
    } else {
        // For serialized items, show quantity (always 1)
        rowCells.push(createElement('td', {}, [String(item.quantity || 1)]));
    }
    
    return createElement('tr', {}, rowCells);
}

// Helper: Build return signature section
function buildReturnSignatureSection(action) {
    if (!action.allow_pdf) {
        return { signatureSection: null, signatureCanvas: null };
    }
    
    let signatureCanvas = null;
    
    const signatureSection = div({ 
        style: { marginTop: '1.5rem', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } 
    }, [
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
                'data-action': 'clear-signature',
                style: { fontSize: '0.875rem' }
            })
        ])
    ]);
    
    return { signatureSection, signatureCanvas };
}

// Helper: Create return modal actions
function createReturnModalActions(items, isSingleBulkItem, returnQuantities, sourceView, action, getSignaturePadFn, state, receivingLocation) {
    return [
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
                        returnQuantities[itemId] = (isNaN(qtyValue) || qtyValue < 1) ? items[0].quantity : qtyValue;
                    }
                }
                
                await executeReturnMaterialAction(items, { returnQuantities, sourceView });
                
                // Auto-generate PDF if signature present
                const signaturePad = getSignaturePadFn();
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
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
}

// Helper: Initialize return modal after display
function initializeReturnModal(isSingleBulkItem, signatureCanvas, action, setSignaturePadFn) {
    setTimeout(() => {
        if (isSingleBulkItem) {
            const qtyInput = document.querySelector('.return-qty-input');
            if (qtyInput) {
                qtyInput.focus();
                qtyInput.select();
            }
        }
        
        if (signatureCanvas && action.allow_pdf) {
            const helpers = SerializedModalHelpers;
            
            // Initialize signature pad with callback
            helpers.initializeSignaturePad(signatureCanvas, 150, (signaturePad) => {
                setSignaturePadFn(signaturePad);
                
                // Set up clear button handler after pad is initialized
                const clearBtn = document.querySelector('[data-action="clear-signature"]');
                if (clearBtn && signaturePad) {
                    clearBtn.addEventListener('click', () => {
                        helpers.clearSignaturePad(signaturePad);
                    });
                }
            });
            
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = signatureCanvas.getBoundingClientRect();
                signatureCanvas.width = rect.width * ratio;
                signatureCanvas.height = rect.height * ratio;
                signatureCanvas.getContext('2d').scale(ratio, ratio);
            }
            
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
        // Prepare items array for edge function
        const returnItems = items.map(item => ({
            inventory_id: item.id,
            return_quantity: returnQuantities[item.id] || item.quantity || 1
        }));
        
        // Try edge function first
        const edgeResult = await EdgeFunctions.returnInventory(
            returnItems,
            receivingLocation.id,
            availableStatus.id,
            `Returned to ${receivingLocation.name}`
        );
        
        if (edgeResult.isOk) {
            console.log('✅ Return via edge function successful:', edgeResult.value);
            const responseData = edgeResult.value?.data || edgeResult.value;
            const successCount = responseData?.successCount || items.length;
            const failCount = responseData?.failCount || 0;
            
            if (failCount > 0) {
                Components.showToast(`Returned ${successCount} item(s), ${failCount} failed`, 'warning');
            } else {
                Components.showToast(`Returned ${successCount} item(s) successfully`, 'success');
            }
        } else {
            console.warn('⚠️ Edge function failed, using fallback:', edgeResult.error);
            
            // Fallback: Process each item locally
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
            
            Components.showToast(`Returned ${items.length} item(s) successfully (fallback)`, 'success');
        }
        
        // Refresh inventory (consolidation stays client-side)
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
        const currentDate = new Date();
        const formattedDate = currentDate.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: getUserTimezone(),
            timeZoneName: 'short'
        });
        page.drawText(`Date: ${formattedDate}`, {
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
    try {
        console.log('showFieldInstallModal called with items:', items, 'action:', action);
        const state = Store.getState();
        const helpers = SerializedModalHelpers;
        
        // Detect source view
        const sourceView = helpers.detectSourceView(null, state);
        console.log('Source view detected:', sourceView);
        
        // Validate required locations and statuses
        const validation = validateFieldInstallRequirements(state);
        console.log('Validation result:', validation);
        if (!validation.valid) {
            Components.showToast(validation.message, 'error');
            return;
        }
        
        const { fieldInstalledLocation, installedStatus } = validation;
        
        // Initialize tracking data
        const installQuantities = {};
        const areaSelections = {};
        items.forEach(item => {
            installQuantities[item.id] = item.quantity || 1; // Default to full quantity
            areaSelections[item.id] = item.area_id || null;
        });
        
        // Fetch sequential data for single serialized items
        console.log('Fetching sequential data...');
        const sequentialData = await fetchSequentialDataForItems(items, state);
        console.log('Sequential data fetched:', sequentialData);
        
        // Build modal sections
        console.log('Building modal sections...');
        const sequentialHistorySection = buildSequentialHistorySection(items, sequentialData);
        const itemsTable = buildFieldInstallItemsTable(items, state, installQuantities, areaSelections, sequentialData);
        const { signatureSection, signatureCanvas } = buildFieldInstallSignatureSection(action);
        
        // Build modal content
        const modalContent = [sequentialHistorySection, itemsTable, signatureSection].filter(Boolean);
        console.log('Modal content built, sections:', modalContent.length);
        
        // Signature pad variable (initialized after modal shown)
        let signaturePad = null;
        
        // Create modal actions
        console.log('Creating modal actions...');
        const modalActions = createFieldInstallModalActions(
            items, installQuantities, areaSelections, sequentialData, 
            sourceView, action, () => signaturePad, state, fieldInstalledLocation
        );
        console.log('Modal actions created:', modalActions);
        
        // Show modal
        console.log('Creating and showing modal...');
        const modal = Modals.create({
            title: 'Field Install',
            content: modalContent,
            actions: modalActions,
            size: 'large',
            actionModal: true
        });
        
        Modals.show(modal);
        console.log('Modal shown successfully');
        
        // Post-show initialization
        initializeFieldInstallModal(signatureCanvas, action, (pad) => { signaturePad = pad; });
    } catch (error) {
        console.error('Error in showFieldInstallModal:', error);
        Components.showToast('Error showing Field Install modal: ' + error.message, 'error');
    }
}

// Helper: Validate field install requirements
function validateFieldInstallRequirements(state) {
    const fieldInstalledLocation = state.locations.find(l => l.name === 'Field Installed');
    if (!fieldInstalledLocation) {
        return { valid: false, message: 'Field Installed location not found' };
    }
    
    const installedStatus = state.statuses.find(s => s.name === 'Installed');
    if (!installedStatus) {
        return { valid: false, message: 'Installed status not found' };
    }
    
    return { valid: true, fieldInstalledLocation, installedStatus };
}

// Helper: Fetch sequential data for serialized items
async function fetchSequentialDataForItems(items, state) {
    const sequentialData = {};
    
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
                    inputMethod: null
                };
            }
        }
    }
    
    return sequentialData;
}

// Helper: Build sequential history section
function buildSequentialHistorySection(items, sequentialData) {
    if (items.length !== 1 || !sequentialData[items[0].id]?.history?.length) {
        return null;
    }
    
    const history = sequentialData[items[0].id].history;
    
    return div({ 
        style: { 
            marginBottom: '20px', 
            padding: '12px', 
            backgroundColor: '#f0f9ff', 
            border: '1px solid #bae6fd', 
            borderRadius: '6px' 
        } 
    }, [
        createElement('h4', { 
            style: { margin: '0 0 10px 0', fontSize: '16px', fontWeight: '600', color: '#0369a1' } 
        }, ['Sequential History']),
        createElement('div', { style: { maxHeight: '150px', overflowY: 'auto' } }, [
            createElement('table', { 
                style: { width: '100%', fontSize: '14px', borderCollapse: 'collapse' } 
            }, [
                createElement('thead', {}, [
                    createElement('tr', {}, [
                        createElement('th', { 
                            style: { textAlign: 'left', padding: '6px', borderBottom: '2px solid #0284c7', color: '#0369a1', fontWeight: '600' } 
                        }, ['Sequential']),
                        createElement('th', { 
                            style: { textAlign: 'left', padding: '6px', borderBottom: '2px solid #0284c7', color: '#0369a1', fontWeight: '600' } 
                        }, ['Recorded At'])
                    ])
                ]),
                createElement('tbody', {}, 
                    history.map((seq, idx) => 
                        createElement('tr', { style: { backgroundColor: idx % 2 === 0 ? '#ffffff' : '#f0f9ff' } }, [
                            createElement('td', { style: { padding: '6px', fontFamily: 'monospace', fontWeight: '600' } }, 
                                [String(seq.sequential_number)]),
                            createElement('td', { style: { padding: '6px' } }, 
                                [formatTimestampWithTimezone(seq.recorded_at, seq.created_timezone)])
                        ])
                    )
                )
            ])
        ]),
        createElement('div', { 
            style: { marginTop: '8px', fontSize: '13px', color: '#0369a1', fontStyle: 'italic' } 
        }, [`Last recorded: ${history[0].sequential_number} on ${formatTimestampWithTimezone(history[0].recorded_at, history[0].created_timezone)}`])
    ]);
}

// Helper: Build field install items table
function buildFieldInstallItemsTable(items, state, installQuantities, areaSelections, sequentialData) {
    const tableHeaders = [
        createElement('th', {}, ['Item']),
        createElement('th', {}, ['Current Location']),
        createElement('th', {}, ['Crew']),
        createElement('th', {}, ['Install To Area']),
        createElement('th', {}, ['Quantity'])
    ];
    
    const tableRows = items.map(item => 
        buildFieldInstallItemRow(item, state, installQuantities, areaSelections, sequentialData)
    );
    
    return createElement('table', { 
        className: 'inventory-table', 
        style: { width: '100%', marginBottom: '15px' } 
    }, [
        createElement('thead', {}, [createElement('tr', {}, tableHeaders)]),
        createElement('tbody', {}, tableRows)
    ]);
}

// Helper: Build single field install item row
function buildFieldInstallItemRow(item, state, installQuantities, areaSelections, sequentialData) {
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    const location = state.locations.find(l => l.id === item.location_id);
    const crew = state.crews.find(c => c.id === item.assigned_crew_id);
    
    // Build area dropdown
    const areaDropdown = buildAreaDropdown(item, state, areaSelections);
    
    // Build quantity cell (with optional sequential inputs)
    const quantityCell = buildQuantityCell(item, installQuantities, sequentialData);
    
    return createElement('tr', {}, [
        createElement('td', {}, [itemType?.name || 'Unknown']),
        createElement('td', {}, [location?.name || 'Unknown']),
        createElement('td', {}, [crew?.name || 'Unassigned']),
        createElement('td', {}, [areaDropdown]),
        quantityCell
    ]);
}

// Helper: Build area dropdown for field install
function buildAreaDropdown(item, state, areaSelections) {
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
    
    return createElement('select', {
        className: 'install-area-select',
        'data-item-id': String(item.id),
        style: { width: '100%', fontSize: '18px', padding: '8px' },
        onchange: (e) => {
            areaSelections[item.id] = e.target.value ? parseInt(e.target.value) : null;
        }
    }, areaOptions);
}

// Helper: Build quantity cell with optional sequential tracking
function buildQuantityCell(item, installQuantities, sequentialData) {
    const hasSequentials = sequentialData[item.id]?.history?.length > 0;
    const lastSequential = hasSequentials ? sequentialData[item.id].history[0] : null;
    
    const qtyInput = buildQuantityInput(item, installQuantities, hasSequentials, lastSequential, sequentialData);
    
    if (hasSequentials) {
        const sequentialInput = buildSequentialInput(item, installQuantities, lastSequential, sequentialData);
        
        return createElement('td', {}, [
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
        return createElement('td', {}, [
            qtyInput,
            createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity || 1}`])
        ]);
    }
}

// Helper: Build quantity input
function buildQuantityInput(item, installQuantities, hasSequentials, lastSequential, sequentialData) {
    const handleFootageInput = (e) => {
        const footage = parseFloat(e.target.value) || 0;
        installQuantities[item.id] = footage;
        
        if (hasSequentials && footage > 0) {
            sequentialData[item.id].inputMethod = 'footage';
            const estimatedSequential = lastSequential.sequential_number - footage;
            sequentialData[item.id].currentSequential = estimatedSequential;
            sequentialData[item.id].calculatedFootage = footage;
            
            const seqInput = document.querySelector(`.install-sequential-input[data-item-id="${item.id}"]`);
            if (seqInput) seqInput.value = String(estimatedSequential);
            
            const remainingDisplay = document.getElementById(`remaining-footage-${item.id}`);
            if (remainingDisplay) {
                remainingDisplay.textContent = ` (Installed: ${footage} ft)`;
                remainingDisplay.style.color = '#059669';
                remainingDisplay.style.fontWeight = 'bold';
            }
        }
    };
    
    return createElement('input', {
        type: 'text',
        className: 'install-qty-input',
        'data-item-id': String(item.id),
        value: String(item.quantity || 1),
        style: { width: hasSequentials ? '120px' : '200px', fontSize: '18px', padding: '8px' },
        oninput: (e) => {
            e.target.value = e.target.value.replace(/[^0-9.]/g, '');
            handleFootageInput(e);
        },
        onpaste: (e) => {
            e.preventDefault();
            const pastedText = (e.clipboardData || window.clipboardData).getData('text');
            e.target.value = pastedText.replace(/[^0-9.]/g, '');
            handleFootageInput(e); // Update quantities after paste
        }
    });
}

// Helper: Build sequential input
function buildSequentialInput(item, installQuantities, lastSequential, sequentialData) {
    const handleSequentialInput = (e) => {
        const currentSeq = parseFloat(e.target.value);
        
        if (!isNaN(currentSeq) && currentSeq >= 0) {
            sequentialData[item.id].inputMethod = 'sequential';
            sequentialData[item.id].currentSequential = currentSeq;
            const footage = lastSequential.sequential_number - currentSeq;
            sequentialData[item.id].calculatedFootage = Math.max(0, footage);
            installQuantities[item.id] = Math.max(0, footage);
            
            const footageInput = document.querySelector(`.install-qty-input[data-item-id="${item.id}"]`);
            if (footageInput) footageInput.value = String(Math.max(0, footage));
            
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
    
    return createElement('input', {
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
}

// Helper: Build signature section for field install
function buildFieldInstallSignatureSection(action) {
    if (!action.allow_pdf) {
        return { signatureSection: null, signatureCanvas: null };
    }
    
    let signatureCanvas = null;
    
    const signatureSection = div({ 
        style: { marginTop: '0.75rem', padding: '0.5rem', border: '1px solid #e5e7eb', borderRadius: '0.375rem' } 
    }, [
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
                onclick: () => { 
                    const pad = signatureCanvas._signaturePad;
                    if (pad) pad.clear(); 
                }
            })
        ])
    ]);
    
    return { signatureSection, signatureCanvas };
}

// Helper: Create field install modal actions
function createFieldInstallModalActions(items, installQuantities, areaSelections, sequentialData, sourceView, action, getSignaturePadFn, state, fieldInstalledLocation) {
    return [
        {
            label: 'Cancel',
            type: 'secondary',
            handler: () => Modals.close()
        },
        {
            label: 'Complete Field Install',
            type: 'primary',
            handler: async () => {
                // Collect all input values
                collectFieldInstallInputs(items, installQuantities, areaSelections, sequentialData);
                
                await executeFieldInstallAction(items, { 
                    installQuantities, 
                    areaSelections, 
                    sequentialData,
                    sourceView 
                });
                
                // Auto-generate PDF if signature present
                const signaturePad = getSignaturePadFn();
                if (action.allow_pdf && signaturePad && !signaturePad.isEmpty()) {
                    const crew = items[0]?.assigned_crew_id ? state.crews.find(c => c.id === items[0].assigned_crew_id) : null;
                    const area = areaSelections[items[0].id] ? state.areas.find(a => a.id === areaSelections[items[0].id]) : null;
                    await generateFieldInstallPDF(items, { crew, area, fieldInstalledLocation }, signaturePad);
                }
                
                Modals.close();
            }
        }
    ];
}

// Helper: Collect field install inputs from DOM
function collectFieldInstallInputs(items, installQuantities, areaSelections, sequentialData) {
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
    
    const sequentialInputs = document.querySelectorAll('.install-sequential-input');
    sequentialInputs.forEach(input => {
        const itemId = parseInt(input.getAttribute('data-item-id'));
        const seqValue = parseFloat(input.value);
        if (!isNaN(seqValue) && seqValue > 0 && sequentialData[itemId]) {
            sequentialData[itemId].currentSequential = seqValue;
        }
    });
}

// Helper: Initialize field install modal after display
function initializeFieldInstallModal(signatureCanvas, action, setSignaturePadFn) {
    setTimeout(() => {
        const firstQtyInput = document.querySelector('.install-qty-input');
        if (firstQtyInput) {
            firstQtyInput.focus();
            firstQtyInput.select();
        }
        
        if (signatureCanvas && action.allow_pdf) {
            const helpers = SerializedModalHelpers;
            const signaturePad = helpers.initializeSignaturePad(signatureCanvas);
            signatureCanvas._signaturePad = signaturePad;
            setSignaturePadFn(signaturePad);
            
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = signatureCanvas.getBoundingClientRect();
                signatureCanvas.width = rect.width * ratio;
                signatureCanvas.height = rect.height * ratio;
                signatureCanvas.getContext('2d').scale(ratio, ratio);
            }
            
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
        // Prepare items array for edge function
        const installItems = items.map(item => ({
            inventory_id: item.id,
            install_quantity: installQuantities[item.id] || item.quantity || 1,
            area_id: areaSelections[item.id] || item.area_id,
            sequential_number: sequentialData[item.id]?.currentSequential || null
        }));
        
        // Try edge function first
        const edgeResult = await EdgeFunctions.fieldInstallInventory(
            installItems,
            fieldInstalledLocation.id,
            installedStatus.id,
            'Installed in field'
        );
        
        if (edgeResult.isOk) {
            console.log('✅ Field install via edge function successful:', edgeResult.value);
            const responseData = edgeResult.value?.data || edgeResult.value;
            const successCount = responseData?.successCount || items.length;
            const failCount = responseData?.failCount || 0;
            
            if (failCount > 0) {
                Components.showToast(`Installed ${successCount} item(s), ${failCount} failed`, 'warning');
            } else {
                Components.showToast(`Installed ${successCount} item(s) successfully`, 'success');
            }
        } else {
            console.warn('⚠️ Edge function failed, using fallback:', edgeResult.error);
            
            // Fallback: Process each item
            for (const item of items) {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                const installQty = installQuantities[item.id] || item.quantity || 1;
                const isPartialInstall = installQty < (item.quantity || 1);
            
            if (isPartialInstall) {
                // Partial install (bulk or serialized with sequential tracking)
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
                    const targetInventoryId = insertResult.isOk ? insertResult.value[0].id : item.id;
                    
                    await Queries.createSequential({
                        inventory_id: targetInventoryId,
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
            } // Close for loop
            
            Components.showToast(`Installed ${items.length} item(s) successfully (fallback)`, 'success');
        }
        
        // Refresh inventory (always runs after edge function or fallback)
        if (state.selectedSloc) {
            // Re-query inventory (no consolidation needed for Field Install)
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
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
        const currentDateIssue = new Date();
        const formattedDateIssue = currentDateIssue.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: getUserTimezone(),
            timeZoneName: 'short'
        });
        page.drawText(`Date: ${formattedDateIssue}`, {
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
    const { buildAdjustItemDetailsSection, buildAdjustmentInputSection, createAdjustModalActions } = window.SerializedModalHelpers;
    
    // Validate single item
    if (items.length !== 1) {
        Components.showToast('Adjust action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    
    // Build modal sections
    const itemDetails = buildAdjustItemDetailsSection(item, state);
    const adjustmentSection = buildAdjustmentInputSection(item);
    const actions = createAdjustModalActions(item);
    
    // Create and show modal
    const modal = Modals.create({
        title: 'Adjust Quantity',
        content: [itemDetails, adjustmentSection],
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-focus quantity input
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
        const oldQuantity = item.quantity || 1;
        
        console.log('📊 [executeAdjustAction] Adjusting inventory:', { id: item.id, oldQuantity, newQuantity, comment });
        
        // Use InventoryActions service (which will try edge function first)
        const result = await InventoryActions.adjust(item.id, newQuantity, comment);
        
        if (!result.isOk) {
            console.error('❌ [executeAdjustAction] Adjust failed:', result.error);
            Components.showToast('Error adjusting quantity: ' + result.error.message, 'error');
            return;
        }
        
        console.log('✅ [executeAdjustAction] Adjust succeeded');
        
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
        console.error('❌ [executeAdjustAction] Error:', error);
        Components.showToast('Error adjusting quantity', 'error');
    }
}

// Show Reject Modal
function showRejectModal(items, action) {
    const state = Store.getState();
    const { buildRejectItemDetailsSection, buildRejectInputSection, createRejectModalActions } = window.SerializedModalHelpers;
    
    // Validate single item
    if (items.length !== 1) {
        Components.showToast('Reject action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    
    // Validate rejected status exists
    const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
    if (!rejectedStatus) {
        Components.showToast('Rejected status not found', 'error');
        return;
    }
    
    // Check if bulk item
    const isBulkItem = itemType && itemType.inventory_type_id === 2;
    
    // Build modal sections
    const itemDetails = buildRejectItemDetailsSection(item, state, isBulkItem);
    const rejectionSection = buildRejectInputSection(item, isBulkItem);
    const actions = createRejectModalActions(item, isBulkItem);
    
    // Create and show modal
    const modal = Modals.create({
        title: 'Reject Material',
        content: [itemDetails, rejectionSection],
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-focus appropriate input
    setTimeout(() => {
        if (isBulkItem) {
            document.getElementById('reject-quantity-input')?.focus();
            document.getElementById('reject-quantity-input')?.select();
        } else {
            document.getElementById('reject-comment-input')?.focus();
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
        
        // Try edge function first
        const edgeFunctionResult = await EdgeFunctions.rejectInventory(
            item.id,
            rejectQuantity,
            comment,
            rejectedStatus.id
        );
        
        if (edgeFunctionResult.isOk) {
            console.log('✅ Reject via edge function successful:', edgeFunctionResult.value);
        } else {
            console.warn('⚠️ Edge function failed, using fallback:', edgeFunctionResult.error);
            
            // Fallback to direct database operations
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
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            // Consolidate for bulk items at receiving location
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
    const { buildInspectItemDetailsSection, buildBulkInspectionInputSection, buildSerializedInspectionSection, createInspectModalActions } = window.SerializedModalHelpers;
    
    // Validate single item
    if (items.length !== 1) {
        Components.showToast('Inspect action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
    
    // Validate required statuses exist
    const availableStatus = state.statuses.find(s => s.name === 'Available');
    const rejectedStatus = state.statuses.find(s => s.name === 'Rejected');
    
    if (!availableStatus || !rejectedStatus) {
        Components.showToast('Required statuses not found', 'error');
        return;
    }
    
    // Check if bulk item
    const isBulkItem = itemType && itemType.inventory_type_id === 2;
    const totalAvailable = item.quantity || 1;
    
    // Build modal sections
    const itemDetails = buildInspectItemDetailsSection(item, state, isBulkItem);
    const inspectionSection = isBulkItem 
        ? buildBulkInspectionInputSection(totalAvailable)
        : buildSerializedInspectionSection();
    const actions = createInspectModalActions(item, isBulkItem, totalAvailable);
    
    // Create and show modal
    const modal = Modals.create({
        title: 'Inspect Material',
        content: [itemDetails, inspectionSection],
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-focus passed input for bulk items
    if (isBulkItem) {
        setTimeout(() => {
            document.getElementById('inspect-passed-input')?.focus();
            document.getElementById('inspect-passed-input')?.select();
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
        
        // Try edge function first
        const edgeFunctionResult = await EdgeFunctions.inspectInventory(
            item.id,
            passedUnits,
            rejectedUnits,
            availableStatus.id,
            rejectedStatus.id,
            isBulkItem ? `Inspected: ${passedUnits} passed, ${rejectedUnits} rejected` : 'Serialized item inspected'
        );
        
        if (edgeFunctionResult.isOk) {
            console.log('✅ Inspect via edge function successful:', edgeFunctionResult.value);
        } else {
            console.warn('⚠️ Edge function failed, using fallback:', edgeFunctionResult.error);
            
            // Fallback to direct database operations
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
    const { buildRemoveItemDetailsSection, buildRemovalInputSection, createRemoveModalActions } = window.SerializedModalHelpers;
    
    // Validate single item
    if (items.length !== 1) {
        Components.showToast('Remove action only supports single items', 'error');
        return;
    }
    
    const item = items[0];
    
    // Get Outgoing location type
    const outgoingLocationType = state.locationTypes.find(lt => lt.name === 'Outgoing');
    if (!outgoingLocationType) {
        Components.showToast('Outgoing location type not found', 'error');
        return;
    }
    
    // Filter locations by Outgoing type
    const outgoingLocations = (state.locations || []).filter(l => l.loc_type_id === outgoingLocationType.id);
    if (outgoingLocations.length === 0) {
        Components.showToast('No Outgoing locations available', 'error');
        return;
    }
    
    // Build modal sections
    const itemDetails = buildRemoveItemDetailsSection(item, state);
    const removalSection = buildRemovalInputSection(outgoingLocations);
    const actions = createRemoveModalActions(item);
    
    // Create and show modal
    const modal = Modals.create({
        title: 'Remove Material',
        content: [itemDetails, removalSection],
        actions: actions,
        size: 'large',
        actionModal: true
    });
    
    Modals.show(modal);
    
    // Auto-focus location dropdown
    setTimeout(() => {
        document.getElementById('remove-location-select')?.focus();
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
        
        // Try edge function first
        const edgeFunctionResult = await EdgeFunctions.removeInventory(
            item.id,
            outgoingLocationId,
            removedStatus.id,
            comment
        );
        
        if (edgeFunctionResult.isOk) {
            console.log('✅ Remove via edge function successful:', edgeFunctionResult.value);
        } else {
            console.warn('⚠️ Edge function failed, using fallback:', edgeFunctionResult.error);
            
            // Fallback to direct database operations
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
        }
        
        // Refresh inventory
        if (state.selectedSloc) {
            const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
        }
        
        // Refresh transactions
        await refreshTransactionsList();
        
        // Build descriptive message
        const isBulkItem = itemType && itemType.inventory_type_id === 2;
        let successMessage;
        if (isBulkItem) {
            successMessage = `Removed ${item.quantity || 1} units of ${itemType?.name || 'material'} to ${newLocation.name}`;
        } else {
            const qty = item.quantity || 1;
            const unit = itemType?.unit_of_measure || 'ft';
            successMessage = `Removed 1 item (${qty.toLocaleString()} ${unit}) to ${newLocation.name}`;
        }
        Components.showToast(successMessage, 'success');
        
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
        const currentDateAction = new Date();
        const formattedDateAction = currentDateAction.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: getUserTimezone(),
            timeZoneName: 'short'
        });
        page.drawText(`Date: ${formattedDateAction}`, {
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

    // ========================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================

    // Expose modal functions
    window.showIssueActionModal = showIssueActionModal;
    window.showReceiveActionModal = showReceiveActionModal;
    window.showReturnMaterialModal = showReturnMaterialModal;
    window.showFieldInstallModal = showFieldInstallModal;
    window.showAdjustModal = showAdjustModal;
    window.showRejectModal = showRejectModal;
    window.showInspectModal = showInspectModal;
    window.showRemoveModal = showRemoveModal;

    // Expose action executors
    window.executeReceiveAction = executeReceiveAction;
    window.executeIssueAction = executeIssueAction;
    window.executeReturnMaterialAction = executeReturnMaterialAction;
    window.executeFieldInstallAction = executeFieldInstallAction;
    window.executeAdjustAction = executeAdjustAction;
    window.executeRejectAction = executeRejectAction;
    window.executeInspectAction = executeInspectAction;
    window.executeRemoveAction = executeRemoveAction;

    // Expose PDF generators
    window.generateReturnPDF = generateReturnPDF;
    window.generateFieldInstallPDF = generateFieldInstallPDF;
    window.generateIssuePDF = generateIssuePDF;

})();

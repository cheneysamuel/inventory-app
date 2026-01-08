/**
 * Inventory Actions Service
 * Handles all inventory action types (adjust, remove, issue, return, etc.)
 */

const InventoryActions = (() => {
    
    /**
     * Get available actions for an inventory item based on its current status
     * @param {number} statusId - Current status ID of inventory
     * @returns {Result} Array of available action types
     */
    const getAvailableActions = (statusId) => {
        const state = Store.getState();
        
        // Get action_statuses that match this status from local state
        const matchingActionStatuses = (state.actionStatuses || []).filter(as => as.status_id === statusId);
        
        // Get the full action type details
        const actionIds = matchingActionStatuses.map(as => as.inv_action_id);
        const actions = (state.actionTypes || []).filter(at => actionIds.includes(at.id));
        
        return Result.ok(actions);
    };
    
    /**
     * Adjust - Adjusts the quantity of an inventory record
     * @param {number} inventoryId - Inventory record ID
     * @param {number} newQuantity - New quantity value
     * @param {string} reason - Reason for adjustment
     * @returns {Promise<Result>}
     */
    const adjust = async (inventoryId, newQuantity, reason = '') => {
        console.log('📊 [InventoryActions.adjust] Starting adjustment:', { inventoryId, newQuantity, reason });
        
        // Try edge function first
        console.log('📡 [InventoryActions.adjust] Attempting edge function...');
        const edgeResult = await EdgeFunctions.adjustInventory(inventoryId, newQuantity, reason);
        
        if (edgeResult.isOk) {
            console.log('✅ [InventoryActions.adjust] Edge function succeeded');
            await refreshInventory();
            return edgeResult;
        }
        
        // Fallback to direct database operations
        console.warn('⚠️ [InventoryActions.adjust] Edge function failed, using fallback:', edgeResult.error);
        const state = Store.getState();
        
        // Get current inventory record
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        const oldQuantity = inventory.quantity;
        
        // Update quantity
        const updateResult = await Database.update('inventory', inventoryId, {
            quantity: newQuantity,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Adjust',
            old_quantity: oldQuantity,
            quantity: newQuantity,
            notes: reason
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Quantity adjusted successfully' });
    };
    
    /**
     * Remove - Removes an inventory record (scrapped, waste, etc.)
     * @param {number} inventoryId - Inventory record ID
     * @param {string} reason - Reason for removal
     * @returns {Promise<Result>}
     */
    const remove = async (inventoryId, reason = '') => {
        const state = Store.getState();
        
        // Get current inventory record
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        
        // Log transaction before deletion
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Remove',
            quantity: inventory.quantity,
            notes: reason
        });
        
        // Delete inventory record
        const deleteResult = await Database.deleteById('inventory', inventoryId);
        
        if (!deleteResult.isOk) {
            return deleteResult;
        }
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Inventory removed successfully' });
    };
    
    /**
     * Return Material As Reserved - Sets location to SLOC but maintains assigned_crew
     * @param {number} inventoryId - Inventory record ID
     * @param {number} slocId - SLOC ID to return to
     * @returns {Promise<Result>}
     */
    const returnMaterialAsReserved = async (inventoryId, slocId) => {
        const state = Store.getState();
        
        // Get SLOC location
        const sloc = state.slocs?.find(s => s.id === slocId);
        if (!sloc) {
            return Result.error(new Error('SLOC not found'));
        }
        
        const slocLocation = state.locations?.find(l => l.name === 'SLOC' || l.location_type_id === 1);
        if (!slocLocation) {
            return Result.error(new Error('SLOC location type not found'));
        }
        
        // Update inventory - change location but keep assigned_crew
        const updateResult = await Database.update('inventory', inventoryId, {
            location_id: slocLocation.id,
            sloc_id: slocId,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Return Material As Reserved',
            to_location_name: 'SLOC',
            notes: 'Material returned to SLOC but remains reserved'
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material returned as reserved successfully' });
    };
    
    /**
     * Assign Area - Designates an area for the inventory record
     * @param {number} inventoryId - Inventory record ID
     * @param {number} areaId - Area ID to assign
     * @returns {Promise<Result>}
     */
    const assignArea = async (inventoryId, areaId) => {
        const state = Store.getState();
        
        const area = state.areas?.find(a => a.id === areaId);
        if (!area) {
            return Result.error(new Error('Area not found'));
        }
        
        // Update inventory
        const updateResult = await Database.update('inventory', inventoryId, {
            area_id: areaId,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Assign Area',
            area_name: area.name,
            notes: `Assigned to area: ${area.name}`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Area assigned successfully' });
    };
    
    /**
     * Inspect - Changes status from "Received" to "Available"
     * @param {number} inventoryId - Inventory record ID
     * @param {string} notes - Inspection notes
     * @returns {Promise<Result>}
     */
    const inspect = async (inventoryId, notes = '') => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        
        // Find "Received" and "Available" statuses
        const receivedStatus = state.statuses?.find(s => s.name === 'Received');
        const availableStatus = state.statuses?.find(s => s.name === 'Available');
        
        if (!receivedStatus || !availableStatus) {
            return Result.error(new Error('Required statuses not found'));
        }
        
        // Verify current status is "Received"
        if (inventory.status_id !== receivedStatus.id) {
            return Result.error(new Error('Item must be in "Received" status to inspect'));
        }
        
        // Update status to Available
        const updateResult = await Database.update('inventory', inventoryId, {
            status_id: availableStatus.id,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Inspect',
            old_status_name: 'Received',
            status_name: 'Available',
            notes: notes || 'Inspection completed'
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Inspection completed, status changed to Available' });
    };
    
    /**
     * Issue - Changes location from SLOC to With Crew, optionally assigns crew
     * @param {number} inventoryId - Inventory record ID
     * @param {number} crewId - Crew ID to issue to (optional if already assigned)
     * @param {number} areaId - Area ID (optional)
     * @param {number} locationId - Location ID (optional)
     * @param {string} notes - Issue notes (optional)
     * @returns {Promise<Result>}
     */
    const issue = async (inventoryId, crewId = null, areaId = null, locationId = null, notes = '') => {
        // Try edge function first
        const edgeResult = await EdgeFunctions.issueInventory(inventoryId, crewId, areaId, locationId, notes);
        
        if (edgeResult.isOk) {
            await refreshInventory();
            return edgeResult;
        }
        
        // Fallback to direct database operations
        console.warn('⚠️ Edge function failed, using fallback for issue');
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        
        // Determine crew (use provided or existing)
        const finalCrewId = crewId || inventory.assigned_crew_id;
        if (!finalCrewId) {
            return Result.error(new Error('Crew must be assigned'));
        }
        
        // Find "With Crew" location
        const withCrewLocation = state.locations?.find(l => l.name === 'With Crew' || l.location_type_id === 2);
        if (!withCrewLocation) {
            return Result.error(new Error('With Crew location not found'));
        }
        
        // Update inventory
        const updateResult = await Database.update('inventory', inventoryId, {
            location_id: withCrewLocation.id,
            assigned_crew_id: finalCrewId,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        const crew = state.crews?.find(c => c.id === finalCrewId);
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Issue',
            from_location_name: 'SLOC',
            to_location_name: 'With Crew',
            assigned_crew_name: crew?.name,
            notes: notes || `Issued to crew: ${crew?.name || finalCrewId}`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material issued to crew successfully' });
    };
    
    /**
     * Reserve - Assigns inventory to a specific crew
     * @param {number} inventoryId - Inventory record ID
     * @param {number} crewId - Crew ID to reserve for
     * @returns {Promise<Result>}
     */
    const reserve = async (inventoryId, crewId) => {
        const state = Store.getState();
        
        const crew = state.crews?.find(c => c.id === crewId);
        if (!crew) {
            return Result.error(new Error('Crew not found'));
        }
        
        // Update inventory
        const updateResult = await Database.update('inventory', inventoryId, {
            assigned_crew_id: crewId,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Reserve',
            assigned_crew_name: crew.name,
            notes: `Reserved for crew: ${crew.name}`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material reserved for crew successfully' });
    };
    
    /**
     * Field Install - Changes inventory from With Crew to Installed
     * @param {number} inventoryId - Inventory record ID
     * @param {string} notes - Installation notes
     * @returns {Promise<Result>}
     */
    const fieldInstall = async (inventoryId, notes = '') => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        // Find "Installed" location and status
        const installedLocation = state.locations?.find(l => l.name === 'Installed' || l.location_type_id === 3);
        const installedStatus = state.statuses?.find(s => s.name === 'Installed');
        
        if (!installedLocation) {
            return Result.error(new Error('Installed location not found'));
        }
        
        // Update inventory
        const updateData = {
            location_id: installedLocation.id,
            updated_at: getLocalTimestamp()
        };
        
        if (installedStatus) {
            updateData.status_id = installedStatus.id;
        }
        
        const updateResult = await Database.update('inventory', inventoryId, updateData);
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Field Install',
            from_location_name: 'With Crew',
            to_location_name: 'Installed',
            status_name: 'Installed',
            notes: notes || 'Material installed in field'
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material marked as installed successfully' });
    };
    
    /**
     * Unreserve - Releases a crew reservation
     * @param {number} inventoryId - Inventory record ID
     * @returns {Promise<Result>}
     */
    const unreserve = async (inventoryId) => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        const oldCrew = state.crews?.find(c => c.id === inventory.assigned_crew_id);
        
        // Update inventory - remove crew assignment
        const updateResult = await Database.update('inventory', inventoryId, {
            assigned_crew_id: null,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Unreserve',
            notes: `Crew reservation released${oldCrew ? ` (was: ${oldCrew.name})` : ''}`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Crew reservation released successfully' });
    };
    
    /**
     * Allocate - Assigns portions of serialized inventory to specific areas
     * @param {number} inventoryId - Inventory record ID
     * @param {Array<{areaId: number, quantity: number}>} allocations - Area allocations
     * @returns {Promise<Result>}
     */
    const allocate = async (inventoryId, allocations) => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        
        // Validate total allocation doesn't exceed available quantity
        const totalAllocated = allocations.reduce((sum, alloc) => sum + alloc.quantity, 0);
        if (totalAllocated > inventory.quantity) {
            return Result.error(new Error('Total allocation exceeds available quantity'));
        }
        
        // Create allocation records (or update area_id on portions)
        // This depends on your allocation strategy - splitting records or tracking separately
        const allocationPromises = allocations.map(async (alloc) => {
            const area = state.areas?.find(a => a.id === alloc.areaId);
            
            // Create a new inventory record for the allocated portion
            const newRecord = {
                ...inventory,
                id: undefined, // Let database generate new ID
                quantity: alloc.quantity,
                area_id: alloc.areaId,
                created_at: getLocalTimestamp(),
                updated_at: getLocalTimestamp()
            };
            
            return Database.insert('inventory', newRecord);
        });
        
        const results = await Promise.all(allocationPromises);
        
        // Reduce original inventory quantity
        const remainingQuantity = inventory.quantity - totalAllocated;
        if (remainingQuantity > 0) {
            await Database.update('inventory', inventoryId, {
                quantity: remainingQuantity,
                updated_at: getLocalTimestamp()
            });
        } else {
            // If fully allocated, delete original record
            await Database.deleteById('inventory', inventoryId);
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Allocate',
            quantity: totalAllocated,
            notes: `Allocated to ${allocations.length} area(s)`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material allocated successfully' });
    };
    
    /**
     * Move - Material moved between storage locations
     * @param {number} inventoryId - Inventory record ID
     * @param {number} newLocationId - New location ID
     * @returns {Promise<Result>}
     */
    const move = async (inventoryId, newLocationId) => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        const oldLocation = state.locations?.find(l => l.id === inventory.location_id);
        const newLocation = state.locations?.find(l => l.id === newLocationId);
        
        if (!newLocation) {
            return Result.error(new Error('New location not found'));
        }
        
        // Update inventory
        const updateResult = await Database.update('inventory', inventoryId, {
            location_id: newLocationId,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Move',
            from_location_name: oldLocation?.name,
            to_location_name: newLocation.name,
            notes: `Moved from ${oldLocation?.name || 'unknown'} to ${newLocation.name}`
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material moved successfully' });
    };
    
    /**
     * Reject - Changes material status to Rejected
     * @param {number} inventoryId - Inventory record ID
     * @param {string} reason - Rejection reason
     * @returns {Promise<Result>}
     */
    const reject = async (inventoryId, reason = '') => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        const rejectedStatus = state.statuses?.find(s => s.name === 'Rejected');
        
        if (!rejectedStatus) {
            return Result.error(new Error('Rejected status not found'));
        }
        
        const oldStatus = state.statuses?.find(s => s.id === inventory.status_id);
        
        // Update status
        const updateResult = await Database.update('inventory', inventoryId, {
            status_id: rejectedStatus.id,
            updated_at: getLocalTimestamp()
        });
        
        if (!updateResult.isOk) {
            return updateResult;
        }
        
        // Log transaction
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Reject',
            old_status_name: oldStatus?.name,
            status_name: 'Rejected',
            notes: reason || 'Material rejected'
        });
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material rejected successfully' });
    };
    
    /**
     * Return Material - Removes material from inventory (return to client/vendor/mfgr)
     * @param {number} inventoryId - Inventory record ID
     * @param {string} returnTo - Who material is being returned to
     * @param {string} reason - Return reason
     * @returns {Promise<Result>}
     */
    const returnMaterial = async (inventoryId, returnTo = '', reason = '') => {
        const state = Store.getState();
        
        // Get current inventory
        const inventoryResult = await Database.selectById('inventory', inventoryId);
        if (!inventoryResult.isOk) {
            return Result.error(new Error('Inventory item not found'));
        }
        
        const inventory = inventoryResult.value;
        
        // Log transaction before deletion
        await logTransaction({
            inventory_id: inventoryId,
            action: 'Return Material',
            quantity: inventory.quantity,
            notes: `Returned to ${returnTo || 'vendor'}${reason ? ': ' + reason : ''}`
        });
        
        // Delete inventory record
        const deleteResult = await Database.deleteById('inventory', inventoryId);
        
        if (!deleteResult.isOk) {
            return deleteResult;
        }
        
        // Refresh inventory
        await refreshInventory();
        
        return Result.ok({ message: 'Material returned successfully' });
    };
    
    /**
     * Helper: Log transaction with full inventory context
     * @private
     */
    const logTransaction = async (transactionData) => {
        const state = Store.getState();
        
        // Get inventory details if inventory_id provided
        let inventoryDetails = {};
        if (transactionData.inventory_id) {
            const invResult = await Database.selectById('inventory', transactionData.inventory_id);
            if (invResult.isOk) {
                const inv = invResult.value;
                const itemType = state.itemTypes?.find(it => it.id === inv.item_type_id);
                const inventoryType = state.inventoryTypes?.find(it => it.id === itemType?.inventory_type_id);
                const category = state.categories?.find(c => c.id === itemType?.category_id);
                const status = state.statuses?.find(s => s.id === inv.status_id);
                const location = state.locations?.find(l => l.id === inv.location_id);
                const crew = state.crews?.find(c => c.id === inv.assigned_crew_id);
                const area = state.areas?.find(a => a.id === inv.area_id);
                const sloc = state.slocs?.find(s => s.id === inv.sloc_id);
                const market = state.markets?.find(m => m.id === sloc?.market_id);
                const client = state.clients?.find(c => c.id === market?.client_id);
                
                inventoryDetails = {
                    item_type_name: itemType?.name,
                    inventory_type_name: inventoryType?.name,
                    manufacturer: itemType?.manufacturer,
                    part_number: itemType?.part_number,
                    category_name: category?.name,
                    status_name: status?.name,
                    mfgrsn: inv.mfgrsn,
                    tilsonsn: inv.tilsonsn,
                    quantity: inv.quantity,
                    from_location_name: location?.name,
                    assigned_crew_name: crew?.name,
                    area_name: area?.name,
                    sloc: sloc?.name,
                    market: market?.name,
                    client: client?.name
                };
            }
        }
        
        const fullTransactionData = {
            transaction_type: 'Inventory Action',
            date_time: getLocalTimestamp(),
            ...inventoryDetails,
            ...transactionData
        };
        
        return await Database.insert('transactions', fullTransactionData);
    };
    
    /**
     * Helper: Refresh inventory in state
     * @private
     */
    const refreshInventory = async () => {
        const inventoryResult = await Queries.getAllInventory();
        if (inventoryResult.isOk) {
            Store.setState({ inventory: inventoryResult.value });
        }
    };
    
    return {
        getAvailableActions,
        adjust,
        remove,
        returnMaterialAsReserved,
        assignArea,
        inspect,
        issue,
        reserve,
        fieldInstall,
        unreserve,
        allocate,
        move,
        reject,
        returnMaterial
    };
})();

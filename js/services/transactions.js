/**
 * Transaction Logging Service
 * Handles creation and management of inventory transactions
 */

const TransactionService = (() => {
    
    // Create a transaction log entry
    const logTransaction = ({
        inventoryId = null,
        transactionType,
        action,
        client = null,
        market = null,
        sloc = null,
        itemTypeName = null,
        inventoryTypeName = null,
        manufacturer = null,
        partNumber = null,
        description = null,
        unitOfMeasure = null,
        unitsPerPackage = null,
        providerName = null,
        categoryName = null,
        mfgrsn = null,
        tilsonsn = null,
        fromLocationName = null,
        fromLocationType = null,
        toLocationName = null,
        toLocationType = null,
        assignedCrewName = null,
        areaName = null,
        statusName = null,
        oldStatusName = null,
        quantity = null,
        oldQuantity = null,
        notes = null,
        beforeState = null,
        afterState = null
    }) => {
        const state = Store.getState();
        
        const transactionData = {
            inventory_id: inventoryId,
            transaction_type: transactionType,
            action: action,
            client: client || state.selectedClient?.name,
            market: market || state.selectedMarket?.name,
            sloc: sloc || state.selectedSloc?.name,
            item_type_name: itemTypeName,
            inventory_type_name: inventoryTypeName,
            manufacturer: manufacturer,
            part_number: partNumber,
            description: description,
            unit_of_measure: unitOfMeasure,
            units_per_package: unitsPerPackage,
            provider_name: providerName,
            category_name: categoryName,
            mfgrsn: mfgrsn,
            tilsonsn: tilsonsn,
            from_location_name: fromLocationName,
            from_location_type: fromLocationType,
            to_location_name: toLocationName,
            to_location_type: toLocationType,
            assigned_crew_name: assignedCrewName,
            area_name: areaName,
            status_name: statusName,
            old_status_name: oldStatusName,
            quantity: quantity,
            old_quantity: oldQuantity,
            user_name: state.user?.name || 'system',
            date_time: getLocalTimestamp(),
            session_id: state.sessionId,
            notes: notes,
            ip_address: null, // Could be populated if needed
            user_agent: navigator.userAgent,
            before_state: beforeState ? JSON.stringify(beforeState) : null,
            after_state: afterState ? JSON.stringify(afterState) : null
        };
        
        const result = Queries.createTransaction(transactionData);
        
        if (result.isOk) {
            Store.actions.addTransaction({ ...transactionData, id: result.value.id });
        }
        
        return result;
    };
    
    // Log a receive transaction
    const logReceive = (inventoryItem, itemType) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'RECEIVE',
            action: 'Receive Material',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            manufacturer: itemType.manufacturer,
            partNumber: itemType.part_number,
            description: itemType.description,
            unitOfMeasure: itemType.unit_of_measure_name,
            unitsPerPackage: itemType.units_per_package,
            providerName: itemType.provider_name,
            categoryName: itemType.category_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            toLocationName: inventoryItem.location_name,
            toLocationType: inventoryItem.location_type_name,
            statusName: inventoryItem.status_name,
            quantity: inventoryItem.quantity,
            afterState: inventoryItem
        });
    };
    
    // Log an issue transaction
    const logIssue = (inventoryItem, itemType, crew, oldState) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'ISSUE',
            action: 'Issue Material',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            fromLocationName: oldState.location_name,
            fromLocationType: oldState.location_type_name,
            toLocationName: inventoryItem.location_name,
            toLocationType: inventoryItem.location_type_name,
            assignedCrewName: crew?.name,
            statusName: inventoryItem.status_name,
            oldStatusName: oldState.status_name,
            quantity: inventoryItem.quantity,
            oldQuantity: oldState.quantity,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Log a move transaction
    const logMove = (inventoryItem, itemType, fromLocation, toLocation, oldState) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'MOVE',
            action: 'Move Material',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            fromLocationName: fromLocation.name,
            fromLocationType: fromLocation.location_type_name,
            toLocationName: toLocation.name,
            toLocationType: toLocation.location_type_name,
            statusName: inventoryItem.status_name,
            quantity: inventoryItem.quantity,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Log an adjust transaction
    const logAdjust = (inventoryItem, itemType, oldState, reason = null) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'ADJUST',
            action: 'Quantity Adjust',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            statusName: inventoryItem.status_name,
            quantity: inventoryItem.quantity,
            oldQuantity: oldState.quantity,
            notes: reason,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Log a return transaction
    const logReturn = (inventoryItem, itemType, crew, oldState) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'RETURN',
            action: 'Return Material',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            fromLocationName: oldState.location_name,
            fromLocationType: oldState.location_type_name,
            toLocationName: inventoryItem.location_name,
            toLocationType: inventoryItem.location_type_name,
            assignedCrewName: crew?.name,
            statusName: inventoryItem.status_name,
            oldStatusName: oldState.status_name,
            quantity: inventoryItem.quantity,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Log an install transaction
    const logInstall = (inventoryItem, itemType, area, oldState) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'INSTALL',
            action: 'Field Install',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            areaName: area?.name,
            statusName: inventoryItem.status_name,
            oldStatusName: oldState.status_name,
            quantity: inventoryItem.quantity,
            oldQuantity: oldState.quantity,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Log a remove transaction
    const logRemove = (inventoryItem, itemType, oldState, reason = null) => {
        return logTransaction({
            inventoryId: inventoryItem.id,
            transactionType: 'REMOVE',
            action: 'Remove Material',
            itemTypeName: itemType.name,
            inventoryTypeName: itemType.inventory_type_name,
            mfgrsn: inventoryItem.mfgrsn,
            tilsonsn: inventoryItem.tilsonsn,
            fromLocationName: oldState.location_name,
            fromLocationType: oldState.location_type_name,
            statusName: inventoryItem.status_name,
            oldStatusName: oldState.status_name,
            quantity: inventoryItem.quantity,
            oldQuantity: oldState.quantity,
            notes: reason,
            beforeState: oldState,
            afterState: inventoryItem
        });
    };
    
    // Get transaction history for an inventory item
    const getHistory = (inventoryId, limit = 50) => {
        return Queries.getTransactionsByInventory(inventoryId, limit);
    };
    
    // Get recent transactions
    const getRecent = (limit = 100) => {
        return Queries.getAllTransactions(limit);
    };
    
    return {
        logTransaction,
        logReceive,
        logIssue,
        logMove,
        logAdjust,
        logReturn,
        logInstall,
        logRemove,
        getHistory,
        getRecent
    };
})();

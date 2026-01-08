/**
 * Database Queries - Async query builders and common operations for Supabase
 */

const Queries = (() => {
    
    // ===== Generic CRUD Operations =====
    
    const findAll = async (table, orderBy = { column: 'id', ascending: true }) => {
        return await Database.select(table, { order: orderBy });
    };
    
    const findById = async (table, id) => {
        return await Database.findById(table, id);
    };
    
    const findWhere = async (table, filter, orderBy = { column: 'id', ascending: true }) => {
        return await Database.select(table, { filter, order: orderBy });
    };
    
    const insert = async (table, data) => {
        const result = await Database.insert(table, data);
        if (result.isOk && result.value && result.value.length > 0) {
            return Result.ok(result.value[0]);
        }
        return result;
    };
    
    const update = async (table, id, data) => {
        return await Database.update(table, id, data);
    };
    
    const deleteById = async (table, id) => {
        return await Database.deleteRecord(table, id);
    };
    
    const deleteWhere = async (table, filter) => {
        // For Supabase, we need to select first, then delete by IDs
        const selectResult = await Database.select(table, { filter });
        if (!selectResult.isOk) return selectResult;
        
        const deletePromises = selectResult.value.map(row => 
            Database.deleteRecord(table, row.id)
        );
        
        const results = await Promise.all(deletePromises);
        const allOk = results.every(r => r.isOk);
        
        return allOk 
            ? Result.ok({ deleted: results.length })
            : Result.error(new Error('Some deletes failed'));
    };
    
    // ===== Specific Domain Queries =====
    
    // Clients
    const getAllClients = async () => findAll('clients', { column: 'name', ascending: true });
    const getClientById = async (id) => findById('clients', id);
    const createClient = async (data) => insert('clients', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // Markets
    const getAllMarkets = async () => findAll('markets', { column: 'name', ascending: true });
    const getMarketsByClient = async (clientId) => 
        findWhere('markets', { client_id: clientId }, { column: 'name', ascending: true });
    const createMarket = async (data) => insert('markets', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // SLOCs
    const getAllSlocs = async () => findAll('slocs', { column: 'name', ascending: true });
    const getSlocsByMarket = async (marketId) => 
        findWhere('slocs', { market_id: marketId }, { column: 'name', ascending: true });
    const createSloc = async (data) => insert('slocs', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // Crews
    const getAllCrews = async () => findAll('crews', { column: 'name', ascending: true });
    const getCrewsByMarket = async (marketId) => 
        findWhere('crews', { market_id: marketId }, { column: 'name', ascending: true });
    const createCrew = async (data) => insert('crews', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // Areas
    const getAllAreas = async () => findAll('areas', { column: 'name', ascending: true });
    const getAreasBySloc = async (slocId) => 
        findWhere('areas', { sloc_id: slocId }, { column: 'name', ascending: true });
    const createArea = async (data) => insert('areas', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // Item Types (with joins)
    const getAllItemTypes = async () => {
        return await Database.select('item_types', {
            select: `
                *,
                inventory_types(name),
                units_of_measure(name),
                inventory_providers(name),
                categories(name)
            `,
            order: { column: 'name', ascending: true }
        });
    };
    
    const getItemTypesByMarket = async (marketId) => {
        // Query item_types via the item_type_markets link table
        const result = await Database.select('item_type_markets', {
            select: `
                item_types(
                    *,
                    inventory_types(name),
                    units_of_measure(name),
                    inventory_providers(name),
                    categories(name)
                )
            `,
            filter: { market_id: marketId }
        });
        
        // Extract the item_types from the nested structure
        if (result.isOk && result.value) {
            const itemTypes = result.value
                .map(row => row.item_types)
                .filter(it => it !== null)
                .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            return Result.ok(itemTypes);
        }
        
        return result;
    };
    
    const createItemType = async (data) => insert('item_types', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    // Inventory (with joins)
    const getAllInventory = async () => {
        return await Database.select('inventory', {
            select: `
                *,
                item_types(name, description, inventory_type_id),
                locations(name),
                crews(name),
                statuses(name),
                slocs(name)
            `,
            order: { column: 'id', ascending: false }
        });
    };
    
    const getInventoryBySloc = async (slocId) => {
        // Try edge function first
        if (window.EdgeFunctions) {
            const edgeResult = await EdgeFunctions.getInventory(slocId);
            if (edgeResult.isOk) {
                return edgeResult;
            }
            console.warn('⚠️ Edge function failed, using fallback:', edgeResult.error);
        }
        
        // Fallback to direct database query
        return await Database.select('inventory', {
            select: `
                *,
                item_types(name, description, inventory_type_id, units_of_measure(name)),
                locations(name),
                crews(name),
                statuses(name),
                slocs(name)
            `,
            filter: { sloc_id: slocId },
            order: { column: 'id', ascending: false }
        });
    };
    
    const createInventory = async (data) => insert('inventory', {
        ...data,
        created_at: getLocalTimestamp(),
        updated_at: getLocalTimestamp()
    });
    
    /**
     * Upsert bulk inventory - finds equivalent record or creates new one
     * Equivalency is based on: location_id, assigned_crew_id, area_id, item_type_id, status_id
     * @param {Object} data - Inventory data including the 5 equivalency fields and quantity
     * @param {string} operation - 'add' or 'subtract' for quantity adjustment
     * @returns {Object} Result with inventory record and whether it was created or updated
     */
    const upsertBulkInventory = async (data, operation = 'add') => {
        // Try edge function first
        const edgeResult = await EdgeFunctions.receiveBulkInventory(data, operation);
        
        if (edgeResult.isOk) {
            return edgeResult;
        }
        
        // Fallback to direct database operations
        console.warn('⚠️ Edge function failed, using fallback for upsertBulkInventory');
        
        try {
            // Find equivalent record (matching the key fields including SLOC)
            const filter = {
                location_id: data.location_id,
                item_type_id: data.item_type_id,
                status_id: data.status_id,
                sloc_id: data.sloc_id
            };
            
            // Add optional fields to filter if they exist
            if (data.assigned_crew_id !== undefined && data.assigned_crew_id !== null) {
                filter.assigned_crew_id = data.assigned_crew_id;
            }
            if (data.area_id !== undefined && data.area_id !== null) {
                filter.area_id = data.area_id;
            }
            
            const existingResult = await Database.select('inventory', {
                filter: filter,
                limit: 1
            });
            
            if (!existingResult.isOk) {
                return existingResult;
            }
            
            const existing = existingResult.value && existingResult.value.length > 0 
                ? existingResult.value[0] 
                : null;
            
            if (existing) {
                // Update existing record quantity
                const newQuantity = operation === 'add' 
                    ? existing.quantity + data.quantity
                    : existing.quantity - data.quantity;
                
                // Don't allow negative quantities
                if (newQuantity < 0) {
                    return {
                        isOk: false,
                        error: `Operation would result in negative quantity (${newQuantity})`
                    };
                }
                
                const updateResult = await Database.update('inventory', existing.id, {
                    quantity: newQuantity,
                    updated_at: getLocalTimestamp()
                });
                
                if (updateResult.isOk) {
                    return {
                        isOk: true,
                        value: {
                            record: updateResult.value,
                            operation: 'updated',
                            inventory_id: existing.id
                        }
                    };
                }
                return updateResult;
            } else {
                // Create new record
                const newRecord = {
                    ...data,
                    quantity: operation === 'subtract' ? -data.quantity : data.quantity,
                    created_at: getLocalTimestamp(),
                    updated_at: getLocalTimestamp()
                };
                
                // Don't create records with negative quantities
                if (newRecord.quantity < 0) {
                    return {
                        isOk: false,
                        error: 'Cannot create inventory record with negative quantity'
                    };
                }
                
                const insertResult = await Database.insert('inventory', newRecord);
                
                if (insertResult.isOk) {
                    return {
                        isOk: true,
                        value: {
                            record: insertResult.value,
                            operation: 'created',
                            inventory_id: insertResult.value.id
                        }
                    };
                }
                return insertResult;
            }
        } catch (error) {
            return {
                isOk: false,
                error: error.message || 'Unknown error in upsertBulkInventory'
            };
        }
    };
    
    /**
     * Update bulk inventory with consolidation check
     * When updating one of the 5 equivalency fields, check if the update creates a duplicate
     * If so, consolidate the records by adding quantities and deleting the original
     * @param {number} inventoryId - ID of inventory record to update
     * @param {Object} updates - Fields to update
     * @returns {Object} Result with information about consolidation if it occurred
     */
    const updateBulkInventory = async (inventoryId, updates) => {
        try {
            // Get the current record
            const currentResult = await Database.selectById('inventory', inventoryId);
            if (!currentResult.isOk) {
                return currentResult;
            }
            
            const current = currentResult.value;
            
            // Check if this is a bulk item (no serial numbers)
            if (current.mfgrsn || current.tilsonsn) {
                // This is a serialized item, use regular update
                return await Database.update('inventory', inventoryId, {
                    ...updates,
                    updated_at: getLocalTimestamp()
                });
            }
            
            // Check if any of the 5 equivalency fields are being updated
            const equivalencyFields = ['location_id', 'assigned_crew_id', 'area_id', 'item_type_id', 'status_id'];
            const isEquivalencyUpdate = equivalencyFields.some(field => updates.hasOwnProperty(field));
            
            if (!isEquivalencyUpdate) {
                // No equivalency fields changing, safe to update directly
                return await Database.update('inventory', inventoryId, {
                    ...updates,
                    updated_at: getLocalTimestamp()
                });
            }
            
            // Build the new equivalency signature after update
            const newRecord = { ...current, ...updates };
            const filter = {
                location_id: newRecord.location_id,
                item_type_id: newRecord.item_type_id,
                status_id: newRecord.status_id
            };
            
            // Add optional fields
            if (newRecord.assigned_crew_id !== undefined && newRecord.assigned_crew_id !== null) {
                filter.assigned_crew_id = newRecord.assigned_crew_id;
            }
            if (newRecord.area_id !== undefined && newRecord.area_id !== null) {
                filter.area_id = newRecord.area_id;
            }
            
            // Check if an equivalent record already exists (excluding current record)
            const existingResult = await Database.select('inventory', {
                filter: filter,
                limit: 2 // Get up to 2 to check if multiple exist
            });
            
            if (!existingResult.isOk) {
                return existingResult;
            }
            
            // Filter out the current record
            const equivalentRecords = (existingResult.value || []).filter(r => r.id !== inventoryId);
            
            if (equivalentRecords.length > 0) {
                // Found an equivalent record - consolidate
                const targetRecord = equivalentRecords[0];
                const combinedQuantity = targetRecord.quantity + current.quantity;
                
                // Update the target record with combined quantity
                const updateResult = await Database.update('inventory', targetRecord.id, {
                    quantity: combinedQuantity,
                    updated_at: getLocalTimestamp()
                });
                
                if (!updateResult.isOk) {
                    return updateResult;
                }
                
                // Delete the original record
                const deleteResult = await Database.deleteRecord('inventory', inventoryId);
                
                if (!deleteResult.isOk) {
                    return deleteResult;
                }
                
                return {
                    isOk: true,
                    value: {
                        record: updateResult.value,
                        operation: 'consolidated',
                        inventory_id: targetRecord.id,
                        consolidated_from: inventoryId,
                        combined_quantity: combinedQuantity
                    }
                };
            } else {
                // No equivalent found, safe to update
                return await Database.update('inventory', inventoryId, {
                    ...updates,
                    updated_at: getLocalTimestamp()
                });
            }
        } catch (error) {
            return {
                isOk: false,
                error: error.message || 'Unknown error in updateBulkInventory'
            };
        }
    };
    
    // Transactions
    const getAllTransactions = async (limit = 100) => {
        return await Database.select('transactions', {
            order: { column: 'date_time', ascending: false },
            limit: limit
        });
    };
    
    const getTransactionsByInventory = async (inventoryId, limit = 50) => {
        return await Database.select('transactions', {
            filter: { inventory_id: inventoryId },
            order: { column: 'date_time', ascending: false },
            limit: limit
        });
    };
    
    const createTransaction = async (data) => {
        const state = Store.getState();
        
        // Create user info JSON string
        let userInfo = 'system';
        if (state.user) {
            userInfo = JSON.stringify({
                id: state.user.id || null,
                email: state.user.email || null,
                name: state.user.name || state.user.email || null
            });
        }
        
        const transactionData = {
            ...data,
            date_time: getLocalTimestamp(),
            created_timezone: getUserTimezone(),
            user_name: data.user_name || userInfo,
            client: data.client || state.selectedClient?.name,
            market: data.market || state.selectedMarket?.name,
            sloc: data.sloc || state.selectedSloc?.name
        };
        
        return insert('transactions', transactionData);
    };
    
    // Statuses
    const getAllStatuses = async () => findAll('statuses', { column: 'name', ascending: true });
    
    // Location Types
    const getAllLocationTypes = async () => findAll('location_types', { column: 'name', ascending: true });
    
    // Locations (with joins)
    const getAllLocations = async () => {
        return await Database.select('locations', {
            select: '*,location_types(name)',
            order: { column: 'name', ascending: true }
        });
    };
    
    // Categories
    const getAllCategories = async () => findAll('categories', { column: 'name', ascending: true });
    
    // Inventory Types
    const getAllInventoryTypes = async () => findAll('inventory_types', { column: 'name', ascending: true });
    
    // Units of Measure
    const getAllUnitsOfMeasure = async () => findAll('units_of_measure', { column: 'name', ascending: true });
    
    // Inventory Providers
    const getAllProviders = async () => findAll('inventory_providers', { column: 'name', ascending: true });
    
    // Action Types (with joins)
    const getAllActionTypes = async () => {
        return await Database.select('inv_action_types', {
            select: '*,location_types(name)',
            order: { column: 'name', ascending: true }
        });
    };
    
    // Transaction Types
    const getAllTransactionTypes = async () => findAll('transaction_types', { column: 'name', ascending: true });
    
    // Action Statuses
    const getAllActionStatuses = async () => {
        return await Database.select('action_statuses');
    };
    
    // Item Type Markets (link table)
    const getAllItemTypeMarkets = async () => {
        return await Database.select('item_type_markets', {
            order: { column: 'item_type_id', ascending: true }
        });
    };
    
    // Config
    const getAllConfig = async () => {
        return await Database.select('config');
    };
    
    const getConfig = async (key) => {
        const result = await Database.select('config', {
            filter: { key: key }
        });
        
        if (result.isOk && result.value.length > 0) {
            try {
                return Result.ok(JSON.parse(result.value[0].value));
            } catch {
                return Result.ok(result.value[0].value);
            }
        }
        return Result.error(new Error('Config key not found'));
    };
    
    const setConfig = async (key, value) => {
        const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
        const exists = await Database.select('config', { filter: { key: key } });
        
        if (exists.isOk && exists.value.length > 0) {
            return await Database.updateByKey('config', 'key', key, { value: stringValue });
        } else {
            return await Database.insert('config', { key: key, value: stringValue });
        }
    };
    
    // Sequentials
    const getAllSequentials = async () => findAll('sequentials', { column: 'recorded_at', ascending: false });
    
    const getSequentialsByInventory = async (inventoryId) => 
        findWhere('sequentials', { inventory_id: inventoryId }, { column: 'recorded_at', ascending: false });
    
    const getLatestSequential = async (inventoryId) => {
        const result = await Database.select('sequentials', {
            filter: { inventory_id: inventoryId },
            order: { column: 'recorded_at', ascending: false },
            limit: 1
        });
        
        return result.isOk && result.value.length > 0
            ? Result.ok(result.value[0])
            : Result.ok(null); // Return null if no sequentials found
    };
    
    const createSequential = async (data) => insert('sequentials', {
        ...data,
        recorded_at: data.recorded_at || getLocalTimestamp(),
        created_at: getLocalTimestamp(),
        created_timezone: getUserTimezone()
    });
    
    return {
        // Generic
        findAll,
        findById,
        findWhere,
        insert,
        update,
        deleteById,
        deleteWhere,
        
        // Clients
        getAllClients,
        getClientById,
        createClient,
        
        // Markets
        getAllMarkets,
        getMarketsByClient,
        createMarket,
        
        // SLOCs
        getAllSlocs,
        getSlocsByMarket,
        createSloc,
        
        // Crews
        getAllCrews,
        getCrewsByMarket,
        createCrew,
        
        // Areas
        getAllAreas,
        getAreasBySloc,
        createArea,
        
        // Item Types
        getAllItemTypes,
        getItemTypesByMarket,
        createItemType,
        
        // Inventory
        getAllInventory,
        getInventoryBySloc,
        createInventory,
        upsertBulkInventory,
        updateBulkInventory,
        
        // Transactions
        getAllTransactions,
        getTransactionsByInventory,
        createTransaction,
        
        // Lookup tables
        getAllStatuses,
        getAllLocationTypes,
        getAllLocations,
        getAllCategories,
        getAllInventoryTypes,
        getAllUnitsOfMeasure,
        getAllProviders,
        getAllActionTypes,
        getAllActionStatuses,
        getAllTransactionTypes,
        getAllItemTypeMarkets,
        
        // Config
        getAllConfig,
        getConfig,
        setConfig,
        
        // Sequentials
        getAllSequentials,
        getSequentialsByInventory,
        getLatestSequential,
        createSequential
    };
})();

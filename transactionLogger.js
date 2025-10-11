// Transaction Logger - Handles all historical    // Log transaction with complete audit information
// Transaction Logger - Handles all historical transaction recording
// This module provides functions to log all inventory operations as historical records

class TransactionLogger {
    constructor() {
        this.sessionId = this.generateSessionId();
        this.userInfo = null;
        this.initializeUserInfo();
    }

    // Generate a unique session identifier
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    // Initialize user information from system/browser
    async initializeUserInfo() {
        this.userInfo = {
            ipAddress: await this.getClientIP(),
            userAgent: navigator.userAgent
        };
    }

    // Get system username (simplified - no user detection)
    async getSystemUsername() {
        return 'system'; // Fixed value since user detection is removed
    }

    // Get system domain (simplified)
    async getSystemDomain() {
        return 'local'; // Fixed value since user detection is removed
    }

    // Get client IP address
    async getClientIP() {
        try {
            // For local applications, this will typically be localhost
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip || '127.0.0.1';
        } catch (error) {
            return '127.0.0.1';
        }
    }

    // Fetch client, market, and SLOC names based on IDs
    async getClientMarketSlocNames(recordData) {
        let clientName = '', marketName = '', slocName = '';
        try {
            if (recordData.sloc_id) {
                // Get SLOC name and market_id
                const { data: sloc, error: slocError } = await supabase
                    .from('slocs')
                    .select('name, market_id')
                    .eq('id', recordData.sloc_id)
                    .single();
                if (slocError || !sloc) return { client: '', market: '', sloc: '' };
                slocName = sloc.name;
                const marketId = sloc.market_id;

                if (marketId) {
                    // Get Market name and client_id
                    const { data: market, error: marketError } = await supabase
                        .from('markets')
                        .select('name, client_id')
                        .eq('id', marketId)
                        .single();
                    if (marketError || !market) return { client: '', market: '', sloc: slocName };
                    marketName = market.name;
                    const clientId = market.client_id;

                    if (clientId) {
                        // Get Client name
                        const { data: client, error: clientError } = await supabase
                            .from('clients')
                            .select('name')
                            .eq('id', clientId)
                            .single();
                        if (clientError || !client) return { client: '', market: marketName, sloc: slocName };
                        clientName = client.name;
                    }
                }
            }
        } catch (e) {
            console.warn('Could not fetch client/market/sloc names for transaction snapshot:', e);
        }
        return { client: clientName, market: marketName, sloc: slocName };
    }

    // Log a transaction with complete audit information
    async logTransaction(transactionData) {
        if (!this.userInfo) {
            await this.initializeUserInfo();
        }

        // Get client/market/sloc names if not already present
        let client = transactionData.client || null;
        let market = transactionData.market || null;
        let sloc = transactionData.sloc || null;

        // If not provided, try to fetch from inventory record
        if ((!client || !market || !sloc) && transactionData.sloc_id) {
            const names = await this.getClientMarketSlocNames(transactionData);
            client = client || names.client;
            market = market || names.market;
            sloc = sloc || names.sloc;
        }

        const transaction = {
            inventory_id: transactionData.inventory_id || null,
            transaction_type: transactionData.transaction_type,
            action: transactionData.action,
            item_type_name: transactionData.item_type_name || null,
            inventory_type_name: transactionData.inventory_type_name || null,
            manufacturer: transactionData.manufacturer || null,
            part_number: transactionData.part_number || null,
            description: transactionData.description || null,
            unit_of_measure: transactionData.unit_of_measure || null,
            units_per_package: transactionData.units_per_package || null,
            provider_name: transactionData.provider_name || null,
            category_name: transactionData.category_name || null,
            mfgrsn: transactionData.mfgrsn || null,
            tilsonsn: transactionData.tilsonsn || null,
            from_location_name: transactionData.from_location_name || null,
            from_location_type: transactionData.from_location_type || null,
            to_location_name: transactionData.to_location_name || null,
            to_location_type: transactionData.to_location_type || null,
            assigned_crew_name: transactionData.assigned_crew_name || null,
            dfn_name: transactionData.dfn_name || null,
            status_name: transactionData.status_name || null,
            old_status_name: transactionData.old_status_name || null,
            quantity: transactionData.quantity || null,
            old_quantity: transactionData.old_quantity || null,
            user_name: window.currentUser || 'system',
            session_id: this.sessionId,
            ip_address: this.userInfo.ipAddress,
            user_agent: this.userInfo.userAgent,
            notes: transactionData.notes || null,
            before_state: transactionData.before_state ? JSON.stringify(transactionData.before_state) : null,
            after_state: transactionData.after_state ? JSON.stringify(transactionData.after_state) : null,
            client: client,
            market: market,
            sloc: sloc
        };

        try {
            // Insert the transaction record into Supabase
            const { data, error } = await supabase
                .from('transactions')
                .insert([transaction])
                .select('id')
                .single();

            if (error) {
                console.error('TransactionLogger: Failed to log transaction (Supabase):', error);
                throw error;
            }

            return data;
        } catch (error) {
            console.error('TransactionLogger: Failed to log transaction (Supabase):', error);
            throw error;
        }
    }

    // Helper method to get complete inventory record data for logging
    async getInventoryRecordData(inventoryId) {
        try {
            const { data, error } = await supabase
                .from('inventory')
                .select(`
                    *,
                    item_types(
                        name,
                        manufacturer,
                        part_number,
                        description,
                        units_per_package,
                        inventory_types(name),
                        units_of_measure(name),
                        inventory_providers(name),
                        categories(name)
                    ),
                    locations(name, location_types(name)),
                    crews(name),
                    dfns(name),
                    statuses(name)
                `)
                .eq('id', inventoryId)
                .single();

            if (error || !data) {
                console.error('TransactionLogger: Error getting inventory record data (Supabase):', error);
                return null;
            }

            // Flatten the joined data to match your original structure
            return {
                ...data,
                item_type_name: data.item_types?.name || null,
                inventory_type_name: data.item_types?.inventory_types?.name || null,
                manufacturer: data.item_types?.manufacturer || null,
                part_number: data.item_types?.part_number || null,
                description: data.item_types?.description || null,
                unit_of_measure: data.item_types?.units_of_measure?.name || null,
                units_per_package: data.item_types?.units_per_package || null,
                provider_name: data.item_types?.inventory_providers?.name || null,
                category_name: data.item_types?.categories?.name || null,
                location_name: data.locations?.name || null,
                location_type: data.locations?.location_types?.name || null,
                crew_name: data.crews?.name || null,
                dfn_name: data.dfns?.name || null,
                status_name: data.statuses?.name || null
            };
        } catch (error) {
            console.error('TransactionLogger: Error getting inventory record data (Supabase):', error);
            throw error;
        }
    }

    // Log inventory creation
    async logInventoryCreated(inventoryId, inventoryData) {
        try {
            console.log('TransactionLogger: Logging inventory creation for ID:', inventoryId);
            console.log('TransactionLogger: Inventory data provided:', inventoryData);
            
            const recordData = await this.getInventoryRecordData(inventoryId);
            console.log('TransactionLogger: Retrieved record data:', recordData);
            
            if (!recordData || Object.keys(recordData).length === 0) {
                console.warn('TransactionLogger: No record data found for inventory ID:', inventoryId);
                return null;
            }
            
            const result = await this.logTransaction({
                inventory_id: inventoryId,
                transaction_type: 'INVENTORY_MANAGEMENT',
                action: 'CREATE',
                ...recordData,
                after_state: recordData,
                notes: 'New inventory record created'
            });
            
            console.log('TransactionLogger: Successfully logged inventory creation with transaction ID:', result?.lastID);
            
            
            return result;
        } catch (error) {
            console.error('TransactionLogger: Failed to log inventory creation:', error);
            throw error;
        }
    }

    // Log inventory update
    async logInventoryUpdated(inventoryId, beforeData, afterData, changes) {

        console.log("logging changes: ", changes)

        try {
            const recordData = await this.getInventoryRecordData(inventoryId);
            
            const result = await this.logTransaction({
                inventory_id: inventoryId,
                transaction_type: 'INVENTORY_MANAGEMENT',
                action: 'UPDATE',
                ...recordData,
                old_quantity: beforeData.quantity,
                old_status_name: beforeData.status_name,
                before_state: beforeData,
                after_state: afterData,
                notes: `Updated fields: ${Object.entries(changes).map(([key, value]) => `${key}: ${value}`).join(', ')}`
            });
            
            
            return result;
        } catch (error) {
            console.error('TransactionLogger: Failed to log inventory update:', error);
            throw error;
        }
    }

    // Log inventory deletion
    async logInventoryDeleted(inventoryId, inventoryData) {
        try {
            return await this.logTransaction({
                inventory_id: inventoryId,
                transaction_type: 'INVENTORY_MANAGEMENT',
                action: 'DELETE',
                ...inventoryData,
                before_state: inventoryData,
                notes: 'Inventory record deleted'
            });
        } catch (error) {
            console.error('TransactionLogger: Failed to log inventory deletion:', error);
            throw error;
        }
    }

    // Log inventory move
    async logInventoryMoved(inventoryId, fromLocation, toLocation) {
        try {
            const recordData = await this.getInventoryRecordData(inventoryId);
            
            const result = await this.logTransaction({
                inventory_id: inventoryId,
                transaction_type: 'INVENTORY_MANAGEMENT',
                action: 'MOVE',
                ...recordData,
                from_location_name: fromLocation.name,
                from_location_type: fromLocation.type,
                to_location_name: toLocation.name,
                to_location_type: toLocation.type,
                notes: `Moved from ${fromLocation.name} to ${toLocation.name}`
            });
            
            return result;
        } catch (error) {
            console.error('TransactionLogger: Failed to log inventory move:', error);
            throw error;
        }
    }

    // Log quantity adjustment
    async logQuantityAdjusted(inventoryId, oldQuantity, newQuantity, reason) {
        try {
            const recordData = await this.getInventoryRecordData(inventoryId);
            
            const result = await this.logTransaction({
                inventory_id: inventoryId,
                transaction_type: 'INVENTORY_MANAGEMENT',
                action: 'QUANTITY_ADJUST',
                ...recordData,
                old_quantity: oldQuantity,
                quantity: newQuantity,
                notes: reason || `Quantity adjusted from ${oldQuantity} to ${newQuantity}`
            });
            
            return result;
        } catch (error) {
            console.error('TransactionLogger: Failed to log quantity adjustment:', error);
            throw error;
        }
    }
}

// Export for use in other modules
window.TransactionLogger = TransactionLogger;



/**
 * Edge Functions Service
 * Handles communication with Supabase Edge Functions
 * Provides version detection for concurrent old/new app operation
 */

const EdgeFunctions = (() => {
    const APP_VERSION = '7.6'; // Increment this when switching to edge functions
    const USE_EDGE_FUNCTIONS = true; // Toggle to enable/disable edge functions
    
    /**
     * Get the base URL for edge functions
     * @returns {string} Edge functions base URL
     */
    const getEdgeFunctionsUrl = () => {
        if (!SupabaseConfig || !SupabaseConfig.url) {
            throw new Error('Supabase configuration not found');
        }
        return `${SupabaseConfig.url}/functions/v1`;
    };
    
    /**
     * Call an edge function
     * @param {string} functionName - Name of the edge function
     * @param {Object} data - Data to send to the function
     * @param {string} method - HTTP method (default: POST)
     * @returns {Promise<Result>}
     */
    const callEdgeFunction = async (functionName, data = {}, method = 'POST') => {
        try {
            const supabase = Database.getClient();
            if (!supabase) {
                console.error('❌ Database not initialized');
                return Result.error(new Error('Database not initialized'));
            }
            
            // Get current session for auth token
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                console.error('❌ Not authenticated - no session');
                return Result.error(new Error('Not authenticated'));
            }
            
            const url = `${getEdgeFunctionsUrl()}/${functionName}`;
            console.log(`📡 Calling edge function: ${method} ${url}`);
            
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                    'Content-Type': 'application/json',
                    'x-app-version': APP_VERSION,
                },
                body: method !== 'GET' ? JSON.stringify(data) : undefined
            });
            
            console.log(`📥 Edge function response status: ${response.status} ${response.statusText}`);
            
            const result = await response.json();
            console.log('📥 Edge function response data:', result);
            
            if (!response.ok || !result.success) {
                console.error('❌ Edge function returned error:', result.error);
                return Result.error(new Error(result.error || 'Edge function call failed'));
            }
            
            return Result.ok(result.data);
            
        } catch (error) {
            console.error(`❌ Edge function ${functionName} error:`, error);
            return Result.error(error);
        }
    };
    
    /**
     * Log a transaction using edge function
     * Falls back to direct database insert if edge functions disabled
     * @param {Object} transactionData - Transaction data to log
     * @returns {Promise<Result>}
     */
    const logTransaction = async (transactionData) => {
        if (!USE_EDGE_FUNCTIONS) {
            console.log('🔄 Edge functions disabled, using direct database insert');
            // Fallback to direct database insert (old behavior)
            return await Database.insert('transactions', {
                ...transactionData,
                date_time: transactionData.date_time || getLocalTimestamp(),
                created_timezone: transactionData.created_timezone || getUserTimezone(),
            });
        }
        
        console.log('🚀 Attempting to log transaction via edge function:', transactionData);
        
        try {
            // Use edge function
            const result = await callEdgeFunction('log-transaction', {
                transaction: transactionData
            });
            
            if (!result.isOk) {
                console.warn('⚠️ Edge function failed, falling back to direct insert:', result.error);
                // Fallback to direct insert
                return await Database.insert('transactions', {
                    ...transactionData,
                    date_time: transactionData.date_time || getLocalTimestamp(),
                    created_timezone: transactionData.created_timezone || getUserTimezone(),
                });
            }
            
            console.log('✅ Transaction logged successfully via edge function:', result.value);
            return result;
            
        } catch (error) {
            console.error('❌ Transaction logging error, falling back to direct insert:', error);
            // Fallback to direct insert on error
            return await Database.insert('transactions', {
                ...transactionData,
                date_time: transactionData.date_time || getLocalTimestamp(),
                created_timezone: transactionData.created_timezone || getUserTimezone(),
            });
        }
    };
    
    /**
     * Get transactions using edge function
     * Falls back to direct database query if edge functions disabled
     * @param {Object} options - Query options (inventoryId, limit, offset)
     * @returns {Promise<Result>}
     */
    const getTransactions = async (options = {}) => {
        if (!USE_EDGE_FUNCTIONS) {
            // Fallback to direct database query (old behavior)
            const queryOptions = {
                order: { column: 'date_time', ascending: false },
                limit: options.limit || 100,
            };
            
            if (options.inventoryId) {
                queryOptions.filter = { inventory_id: options.inventoryId };
            }
            
            return await Database.select('transactions', queryOptions);
        }
        
        try {
            // Build query string
            const params = new URLSearchParams();
            if (options.inventoryId) params.append('inventory_id', options.inventoryId);
            if (options.limit) params.append('limit', options.limit);
            if (options.offset) params.append('offset', options.offset);
            
            const functionName = `get-transactions?${params.toString()}`;
            const result = await callEdgeFunction(functionName, {}, 'GET');
            
            if (!result.isOk) {
                console.warn('Edge function failed, falling back to direct query:', result.error);
                // Fallback to direct query
                const queryOptions = {
                    order: { column: 'date_time', ascending: false },
                    limit: options.limit || 100,
                };
                
                if (options.inventoryId) {
                    queryOptions.filter = { inventory_id: options.inventoryId };
                }
                
                return await Database.select('transactions', queryOptions);
            }
            
            return result;
            
        } catch (error) {
            console.error('Get transactions error:', error);
            // Fallback to direct query on error
            const queryOptions = {
                order: { column: 'date_time', ascending: false },
                limit: options.limit || 100,
            };
            
            if (options.inventoryId) {
                queryOptions.filter = { inventory_id: options.inventoryId };
            }
            
            return await Database.select('transactions', queryOptions);
        }
    };
    
    /**
     * Check if edge functions are enabled
     * @returns {boolean}
     */
    const isEnabled = () => USE_EDGE_FUNCTIONS;
    
    /**
     * Get current app version
     * @returns {string}
     */
    const getVersion = () => APP_VERSION;
    
    /**
     * Adjust inventory quantity via edge function
     * @param {number} inventoryId - Inventory ID
     * @param {number} newQuantity - New quantity value
     * @param {string} reason - Reason for adjustment
     * @returns {Promise<Result>}
     */
    const adjustInventory = async (inventoryId, newQuantity, reason = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('adjust-inventory', {
            inventory_id: inventoryId,
            new_quantity: newQuantity,
            reason: reason
        });
    };
    
    /**
     * Issue inventory via edge function
     * @param {number} inventoryId - Inventory ID
     * @param {number} crewId - Crew ID (optional)
     * @param {number} areaId - Area ID (optional)
     * @param {number} locationId - Location ID (optional)
     * @param {string} notes - Notes
     * @returns {Promise<Result>}
     */
    const issueInventory = async (inventoryId, crewId = null, areaId = null, locationId = null, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('issue-inventory', {
            inventory_id: inventoryId,
            crew_id: crewId,
            area_id: areaId,
            location_id: locationId,
            notes: notes
        });
    };
    
    /**
     * Receive inventory via edge function
     * @param {Object} data - Receive data
     * @returns {Promise<Result>}
     */
    const receiveInventory = async (data) => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('receive-inventory', data);
    };
    
    /**
     * Receive bulk inventory via edge function with automatic consolidation
     * @param {Object} data - Bulk receive data with operation type
     * @returns {Promise<Result>}
     */
    const receiveBulkInventory = async (data, operation = 'add') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('receive-bulk-inventory', {
            ...data,
            operation: operation
        });
    };
    
    /**
     * Issue bulk inventory via edge function (subtract from source, add to target with crew/area)
     * @param {Object} issueData - Issue parameters
     * @returns {Promise<Result>}
     */
    const bulkIssueInventory = async (issueData) => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('bulk-issue-inventory', issueData);
    };
    
    /**
     * Receive serialized inventory items via edge function
     * @param {Array} items - Array of serialized items with tilsonsn, mfgrsn, etc.
     * @returns {Promise<Result>}
     */
    const receiveSerializedInventory = async (items) => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        console.log('🚀 Calling receiveSerializedInventory edge function with items:', items);
        return await callEdgeFunction('receive-serialized-inventory', { items });
    };
    
    /**
     * Issue serialized inventory items via edge function
     * @param {Array} inventoryIds - Array of inventory IDs to issue
     * @param {number} crewId - Crew ID
     * @param {number} areaId - Area ID
     * @param {number} locationId - Location ID (optional)
     * @param {string} notes - Notes (optional)
     * @returns {Promise<Result>}
     */
    const issueSerializedInventory = async (inventoryIds, crewId, areaId, locationId = null, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        console.log('🚀 Calling issueSerializedInventory edge function with:', { inventoryIds, crewId, areaId });
        return await callEdgeFunction('issue-serialized-inventory', {
            inventory_ids: inventoryIds,
            crew_id: crewId,
            area_id: areaId,
            location_id: locationId,
            notes: notes
        });
    };
    
    /**
     * Return inventory items to receiving location via edge function
     * @param {Array} items - Array of {inventory_id, return_quantity} objects
     * @param {number} targetLocationId - Target location ID (receiving location)
     * @param {number} targetStatusId - Target status ID (usually Available)
     * @param {string} notes - Notes (optional)
     * @returns {Promise<Result>}
     */
    const returnInventory = async (items, targetLocationId, targetStatusId, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        console.log('🚀 Calling returnInventory edge function with:', { items, targetLocationId, targetStatusId });
        return await callEdgeFunction('return-inventory', {
            items: items,
            target_location_id: targetLocationId,
            target_status_id: targetStatusId,
            notes: notes
        });
    };
    
    /**
     * Field install inventory items via edge function
     * @param {Array} items - Array of {inventory_id, install_quantity, area_id, sequential_number} objects
     * @param {number} targetLocationId - Target location ID (Field Installed)
     * @param {number} targetStatusId - Target status ID (Installed)
     * @param {string} notes - Notes (optional)
     * @returns {Promise<Result>}
     */
    const fieldInstallInventory = async (items, targetLocationId, targetStatusId, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        console.log('🚀 Calling fieldInstallInventory edge function with:', { items, targetLocationId, targetStatusId });
        return await callEdgeFunction('field-install-inventory', {
            items: items,
            target_location_id: targetLocationId,
            target_status_id: targetStatusId,
            notes: notes
        });
    };
    
    /**
     * Reject inventory item via edge function
     * @param {number} inventoryId - Inventory ID
     * @param {number} rejectQuantity - Quantity to reject (optional for full rejection)
     * @param {string} comment - Rejection reason
     * @param {number} rejectedStatusId - ID of "Rejected" status
     * @returns {Promise<Result>}
     */
    const rejectInventory = async (inventoryId, rejectQuantity, comment, rejectedStatusId) => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('reject-inventory', {
            inventory_id: inventoryId,
            reject_quantity: rejectQuantity,
            comment: comment,
            rejected_status_id: rejectedStatusId
        });
    };
    
    /**
     * Inspect inventory item via edge function
     * @param {number} inventoryId - Inventory ID
     * @param {number} passedUnits - Quantity that passed inspection (for bulk items)
     * @param {number} rejectedUnits - Quantity that failed inspection (for bulk items)
     * @param {number} availableStatusId - ID of "Available" status
     * @param {number} rejectedStatusId - ID of "Rejected" status
     * @param {string} notes - Inspection notes (optional)
     * @returns {Promise<Result>}
     */
    const inspectInventory = async (inventoryId, passedUnits, rejectedUnits, availableStatusId, rejectedStatusId, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('inspect-inventory', {
            inventory_id: inventoryId,
            passed_units: passedUnits,
            rejected_units: rejectedUnits,
            available_status_id: availableStatusId,
            rejected_status_id: rejectedStatusId,
            notes: notes
        });
    };
    
    /**
     * Remove inventory item via edge function
     * @param {number} inventoryId - Inventory ID
     * @param {number} outgoingLocationId - Target outgoing location ID
     * @param {number} removedStatusId - ID of "Removed" status
     * @param {string} notes - Removal notes (optional)
     * @returns {Promise<Result>}
     */
    const removeInventory = async (inventoryId, outgoingLocationId, removedStatusId, notes = '') => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('remove-inventory', {
            inventory_id: inventoryId,
            outgoing_location_id: outgoingLocationId,
            removed_status_id: removedStatusId,
            notes: notes
        });
    };
    
    /**
     * Get inventory items for a SLOC via edge function
     * @param {number} slocId - SLOC ID to filter inventory
     * @returns {Promise<Result>}
     */
    const getInventory = async (slocId) => {
        if (!USE_EDGE_FUNCTIONS) {
            return Result.error(new Error('Edge functions disabled'));
        }
        
        return await callEdgeFunction('get-inventory', {
            sloc_id: slocId
        });
    };
    
    return {
        callEdgeFunction,
        logTransaction,
        getTransactions,
        adjustInventory,
        issueInventory,
        receiveInventory,
        receiveBulkInventory,
        bulkIssueInventory,
        receiveSerializedInventory,
        issueSerializedInventory,
        returnInventory,
        fieldInstallInventory,
        rejectInventory,
        inspectInventory,
        removeInventory,
        getInventory,
        isEnabled,
        getVersion
    };
})();

// Make available globally
window.EdgeFunctions = EdgeFunctions;


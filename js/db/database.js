/**
 * Database Layer - Supabase PostgreSQL client with async interface
 */

const Database = (() => {
    let supabase = null;
    
    // Initialize Supabase client
    const init = async () => {
        try {
            if (!window.supabase) {
                throw new Error('Supabase library not loaded');
            }
            
            if (!SupabaseConfig || !SupabaseConfig.url || !SupabaseConfig.anonKey) {
                throw new Error('Supabase configuration not found. Please update js/config/supabase.config.js');
            }
            
            supabase = window.supabase.createClient(SupabaseConfig.url, SupabaseConfig.anonKey);
            
            // Get current session (not user) to check authentication state
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (session && session.user) {
                // Debug: Log available metadata
                console.log('🔍 Supabase User Metadata:', {
                    app_metadata: session.user.app_metadata,
                    user_metadata: session.user.user_metadata,
                    raw_app_meta_data: session.user.raw_app_meta_data,
                    raw_user_meta_data: session.user.raw_user_meta_data
                });
                
                // Extract role from user metadata (check all possible locations)
                const role = session.user.app_metadata?.role || 
                           session.user.user_metadata?.role || 
                           session.user.raw_app_meta_data?.role ||
                           session.user.raw_user_meta_data?.role ||
                           'user';
                
                console.log('✅ Extracted role:', role);
                
                const userState = { 
                    id: session.user.id,
                    email: session.user.email,
                    name: session.user.email,
                    role: role
                };
                Store.setState({ user: userState });
            }
            
            return Result.ok(supabase);
        } catch (error) {
            console.error('Database initialization failed:', error);
            return Result.error(error);
        }
    };
    
    // Generic select query
    const select = async (table, options = {}) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            let query = supabase.from(table).select(options.select || '*');
            
            // Apply filters
            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    query = query.eq(key, value);
                });
            }
            
            // Apply ordering
            if (options.order) {
                const { column, ascending = true } = options.order;
                query = query.order(column, { ascending });
            }
            
            // Apply limit
            if (options.limit) {
                query = query.limit(options.limit);
            }
            
            // Apply range
            if (options.range) {
                query = query.range(options.range.from, options.range.to);
            }
            
            const { data, error } = await query;
            
            if (error) throw error;
            return Result.ok(data);
        } catch (error) {
            console.error('Select error:', error);
            return Result.error(error);
        }
    };
    
    // Insert record
    const insert = async (table, data) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            // Ensure id is not in the data object - let PostgreSQL auto-generate it
            const { id, ...insertData } = data;
            
            if (id !== undefined) {
                console.warn(`Stripped id field (${id}) from insert to ${table}`);
            }
            
            const { data: result, error } = await supabase
                .from(table)
                .insert(insertData)
                .select();
            
            if (error) throw error;
            return Result.ok(result);
        } catch (error) {
            console.error('Insert error:', error);
            return Result.error(error);
        }
    };
    
    // Update record
    const update = async (table, id, data) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            const { data: result, error } = await supabase
                .from(table)
                .update(data)
                .eq('id', id)
                .select();
            
            if (error) throw error;
            return Result.ok(result);
        } catch (error) {
            console.error('Update error:', error);
            return Result.error(error);
        }
    };
    
    // Update record by custom key (for tables without 'id' primary key)
    const updateByKey = async (table, keyField, keyValue, data) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            const { data: result, error } = await supabase
                .from(table)
                .update(data)
                .eq(keyField, keyValue)
                .select();
            
            if (error) throw error;
            return Result.ok(result);
        } catch (error) {
            console.error('Update error:', error);
            return Result.error(error);
        }
    };
    
    // Delete record
    const deleteRecord = async (table, id) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            const { error } = await supabase
                .from(table)
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            return Result.ok({ deleted: true });
        } catch (error) {
            console.error('Delete error:', error);
            return Result.error(error);
        }
    };
    
    // Execute RPC (stored procedure/function)
    const rpc = async (functionName, params = {}) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            const { data, error } = await supabase.rpc(functionName, params);
            
            if (error) throw error;
            return Result.ok(data);
        } catch (error) {
            console.error('RPC error:', error);
            return Result.error(error);
        }
    };
    
    // Count rows in a table
    const count = async (table, filter = {}) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            let query = supabase.from(table).select('*', { count: 'exact', head: true });
            
            Object.entries(filter).forEach(([key, value]) => {
                query = query.eq(key, value);
            });
            
            const { count, error } = await query;
            
            if (error) throw error;
            return Result.ok(count);
        } catch (error) {
            console.error('Count error:', error);
            return Result.error(error);
        }
    };
    
    // Get single record by ID
    const findById = async (table, id) => {
        try {
            if (!supabase) throw new Error('Database not initialized');
            
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('id', id)
                .single();
            
            if (error) throw error;
            return Result.ok(data);
        } catch (error) {
            console.error('FindById error:', error);
            return Result.error(error);
        }
    };
    
    // Get all tables (metadata query)
    const getAllTables = async () => {
        try {
            // This would typically be done via information_schema
            // For now, return known tables from schema
            const tables = [
                'clients', 'markets', 'slocs', 'crews', 'areas',
                'item_types', 'inventory', 'transactions', 
                'statuses', 'locations', 'location_types',
                'categories', 'inventory_types', 'units_of_measure',
                'inventory_providers', 'inv_action_types', 'action_statuses',
                'qty_allocations', 'transaction_types', 'config'
            ];
            return Result.ok(tables.map(name => ({ name })));
        } catch (error) {
            return Result.error(error);
        }
    };
    
    // Get Supabase client instance
    const getClient = () => supabase;
    
    return {
        init,
        select,
        insert,
        update,
        updateByKey,
        deleteRecord,
        rpc,
        count,
        findById,
        getAllTables,
        getClient
    };
})();

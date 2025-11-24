/**
 * State Management - Functional state store with pub/sub
 */

const Store = (() => {
    let state = {
        currentView: 'dashboard',
        selectedClient: null,
        selectedMarket: null,
        selectedSloc: null,
        user: null,  // User must be authenticated via Supabase
        sessionId: generateSessionId(),
        inventory: [],
        itemTypes: [],
        crews: [],
        areas: [],
        locations: [],
        statuses: [],
        categories: [],
        transactions: [],
        loading: false,
        error: null
    };
    
    const subscribers = new Map();
    let subscriberId = 0;
    
    // Generate unique session ID
    function generateSessionId() {
        return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // Get current state (immutable copy)
    const getState = () => ({ ...state });
    
    // Get specific state property
    const get = (path) => {
        const keys = path.split('.');
        return keys.reduce((obj, key) => obj?.[key], state);
    };
    
    // Subscribe to state changes
    const subscribe = (listener) => {
        const id = subscriberId++;
        subscribers.set(id, listener);
        
        // Return unsubscribe function
        return () => subscribers.delete(id);
    };
    
    // Notify all subscribers of state change
    const notify = (changes) => {
        subscribers.forEach(listener => {
            try {
                listener(state, changes);
            } catch (error) {
                console.error('Subscriber error:', error);
            }
        });
    };
    
    // Update state (immutable)
    const setState = (updates) => {
        const prevState = state;
        state = { ...state, ...updates };
        notify({ ...updates, _prev: prevState });
        return state;
    };
    
    // Update nested state property
    const set = (path, value) => {
        const keys = path.split('.');
        const lastKey = keys.pop();
        const target = keys.reduce((obj, key) => {
            if (!obj[key]) obj[key] = {};
            return obj[key];
        }, { ...state });
        
        target[lastKey] = value;
        return setState(target);
    };
    
    // Merge object into state
    const merge = (updates) => {
        return setState({ ...state, ...updates });
    };
    
    // Reset state to initial values
    const reset = () => {
        state = {
            currentView: 'dashboard',
            selectedClient: null,
            selectedMarket: null,
            selectedSloc: null,
            user: null,  // User must be authenticated via Supabase
            sessionId: generateSessionId(),
            inventory: [],
            itemTypes: [],
            crews: [],
            areas: [],
            locations: [],
            statuses: [],
            categories: [],
            transactions: [],
            loading: false,
            error: null
        };
        notify({ _reset: true });
        return state;
    };
    
    // Action creators (for common state updates)
    const actions = {
        setView: (view) => setState({ currentView: view }),
        
        setClient: (client) => setState({ 
            selectedClient: client,
            selectedMarket: null,
            selectedSloc: null
        }),
        
        setMarket: (market) => setState({ 
            selectedMarket: market,
            selectedSloc: null
        }),
        
        setSloc: (sloc) => setState({ selectedSloc: sloc }),
        
        setLoading: (loading) => setState({ loading }),
        
        setError: (error) => setState({ error }),
        
        clearError: () => setState({ error: null }),
        
        setInventory: (inventory) => setState({ inventory }),
        
        addInventoryItem: (item) => setState({ 
            inventory: [...state.inventory, item] 
        }),
        
        updateInventoryItem: (id, updates) => setState({
            inventory: state.inventory.map(item => 
                item.id === id ? { ...item, ...updates } : item
            )
        }),
        
        removeInventoryItem: (id) => setState({
            inventory: state.inventory.filter(item => item.id !== id)
        }),
        
        setItemTypes: (itemTypes) => setState({ itemTypes }),
        
        setCrews: (crews) => setState({ crews }),
        
        setAreas: (areas) => setState({ areas }),
        
        setLocations: (locations) => setState({ locations }),
        
        setStatuses: (statuses) => setState({ statuses }),
        
        setCategories: (categories) => setState({ categories }),
        
        setTransactions: (transactions) => setState({ transactions }),
        
        addTransaction: (transaction) => setState({
            transactions: [transaction, ...state.transactions]
        })
    };
    
    // Computed/derived state
    const computed = {
        hasSelectedContext: () => 
            state.selectedClient && state.selectedMarket && state.selectedSloc,
        
        getFilteredInventory: (filters = {}) => {
            let filtered = state.inventory;
            
            if (filters.status) {
                filtered = filtered.filter(item => item.status_id === filters.status);
            }
            
            if (filters.location) {
                filtered = filtered.filter(item => item.location_id === filters.location);
            }
            
            if (filters.itemType) {
                filtered = filtered.filter(item => item.item_type_id === filters.itemType);
            }
            
            if (filters.crew) {
                filtered = filtered.filter(item => item.assigned_crew_id === filters.crew);
            }
            
            return filtered;
        },
        
        getSerializedInventory: () => 
            state.inventory.filter(item => {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                return itemType && itemType.inventory_type_id === 1;
            }),
        
        getBulkInventory: () => 
            state.inventory.filter(item => {
                const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                return itemType && itemType.inventory_type_id === 2;
            }),
        
        getTotalInventoryValue: () => 
            state.inventory.reduce((sum, item) => sum + (item.quantity || 0), 0),
        
        getInventoryByStatus: () => 
            groupBy(item => item.status_name, state.inventory),
        
        getInventoryByLocation: () => 
            groupBy(item => item.location_name, state.inventory)
    };
    
    // Persistence
    const persistence = {
        save: (key = 'app_state') => {
            try {
                const stateToSave = pick([
                    'selectedClient', 'selectedMarket', 'selectedSloc', 'user'
                ], state);
                localStorage.setItem(key, JSON.stringify(stateToSave));
                return Result.ok({ saved: true });
            } catch (error) {
                console.error('State save error:', error);
                return Result.error(error);
            }
        },
        
        load: (key = 'app_state') => {
            try {
                const saved = localStorage.getItem(key);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    setState(parsed);
                    return Result.ok(parsed);
                }
                return Result.error(new Error('No saved state'));
            } catch (error) {
                console.error('State load error:', error);
                return Result.error(error);
            }
        },
        
        clear: (key = 'app_state') => {
            localStorage.removeItem(key);
            return Result.ok({ cleared: true });
        }
    };
    
    return {
        getState,
        get,
        setState,
        set,
        merge,
        reset,
        subscribe,
        actions,
        computed,
        persistence
    };
})();

// Auto-save state on changes
Store.subscribe((state, changes) => {
    if (changes.selectedClient || changes.selectedMarket || changes.selectedSloc) {
        Store.persistence.save();
    }
});

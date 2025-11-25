/**
 * Main Application Entry Point
 * Initialize and bootstrap the inventory management system with Supabase
 * 
 * CACHED REFERENCE TABLES:
 * The following tables are loaded once at startup and cached locally in the Store.
 * They are automatically refreshed when modified via the DB wrapper functions:
 * - areas, categories, clients, inv_action_types, inventory_types
 * - item_types, item_type_markets, location_types, locations, markets, slocs
 * - statuses, transaction_types, units_of_measure
 * 
 * Usage:
 * - Use DB.insert(table, data) instead of Database.insert() for auto-refresh
 * - Use DB.update(table, id, data) instead of Database.update() for auto-refresh
 * - Use DB.delete(table, id) instead of Database.deleteRecord() for auto-refresh
 */

(async function initializeApp() {
    try {
        // Step 1: Initialize Supabase Database Connection
        const dbResult = await Database.init();
        
        if (!dbResult.isOk) {
            throw new Error('Failed to initialize Supabase connection: ' + dbResult.error);
        }
        
        // Step 2: Validate authentication session
        const state = Store.getState();
        
        if (!state.user) {
            // No valid session - redirect to login page
            console.log('❌ No active session found. Redirecting to login...');
            window.location.href = 'login.html';
            return;
        }
        
        console.log('✅ Logged in as:', state.user.email);
        
        // Step 3: Hide loading screen and show app
        const loadingScreen = byId('loading-screen');
        const app = byId('app');
        
        if (loadingScreen) loadingScreen.style.display = 'none';
        if (app) app.style.display = 'flex';
        
        // Step 4: Load application
        await loadApplication();
        Components.showToast('Connected to Supabase successfully', 'success');
        
        console.log('✅ Application initialization complete!');
        
    } catch (error) {
        console.error('❌ Application initialization failed:', error);
        
        // Show user-friendly error
        if (error.message.includes('Supabase configuration')) {
            alert('⚠️ Supabase Not Configured\n\nPlease update your Supabase credentials in:\njs/config/supabase.config.js\n\nSee README.md for setup instructions.');
        } else {
            alert('Failed to initialize application: ' + error.message);
        }
        
        // Redirect to login on error
        window.location.href = 'login.html';
    }
})();

// Setup login form handler (REMOVED - login handled in login.html)
function setupLoginForm() {
    const loginForm = byId('login-form');
    
    if (!loginForm) {
        console.error('❌ #login-form element not found!');
        return;
    }
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = byId('login-email').value;
        const password = byId('login-password').value;
        const errorDiv = byId('login-error');
        const loginScreen = byId('login-screen');
        const app = byId('app');
        
        errorDiv.style.display = 'none';
        
        const result = await AuthService.login(email, password);
        
        if (result.isOk) {
            console.log('✅ Login successful:', email);
            // Hide login screen and load application
            loginScreen.style.display = 'none';
            app.style.display = 'flex';
            await loadApplication();
            Components.showToast('Welcome back!', 'success');
        } else {
            console.error('❌ Login failed:', result.error);
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
        }
    });
    
    // Setup forgot password link handler
    const forgotPasswordLink = byId('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            showForgotPasswordModal();
        });
    }
    
    // Setup forgot password modal handlers
    setupForgotPasswordModal();
    
    // Check if we're returning from a password reset email link
    checkPasswordResetRedirect();
}

// Show forgot password modal
function showForgotPasswordModal() {
    const modal = byId('forgot-password-modal');
    const messageDiv = byId('forgot-password-message');
    const emailInput = byId('reset-email');
    
    if (!modal) return;
    
    // Clear previous state
    messageDiv.style.display = 'none';
    messageDiv.className = '';
    emailInput.value = '';
    
    modal.style.display = 'flex';
}

// Setup forgot password modal form handlers
function setupForgotPasswordModal() {
    const modal = byId('forgot-password-modal');
    const form = byId('forgot-password-form');
    const cancelBtn = byId('cancel-forgot-password');
    const messageDiv = byId('forgot-password-message');
    
    if (!form || !modal) return;
    
    // Handle form submission
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const email = byId('reset-email').value;
        messageDiv.style.display = 'none';
        
        // Disable submit button during request
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Sending...';
        
        const result = await AuthService.requestPasswordReset(email);
        
        submitBtn.disabled = false;
        submitBtn.textContent = 'Send Reset Link';
        
        if (result.isOk) {
            messageDiv.textContent = 'Password reset email sent! Check your inbox.';
            messageDiv.className = 'alert alert-success';
            messageDiv.style.display = 'block';
            
            // Close modal after 3 seconds
            setTimeout(() => {
                modal.style.display = 'none';
            }, 3000);
        } else {
            messageDiv.textContent = result.error;
            messageDiv.className = 'alert alert-error';
            messageDiv.style.display = 'block';
        }
    });
    
    // Handle cancel button
    if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }
    
    // Close modal when clicking outside
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Check if user is returning from password reset email link
async function checkPasswordResetRedirect() {
    const hashParams = new URLSearchParams(window.location.hash.substring(1));
    const type = hashParams.get('type');
    
    // If this is a password recovery redirect
    if (type === 'recovery') {
        const loginScreen = byId('login-screen');
        const resetScreen = byId('reset-password-screen');
        
        if (loginScreen && resetScreen) {
            loginScreen.style.display = 'none';
            resetScreen.style.display = 'flex';
            setupResetPasswordForm();
        }
    }
}

// Setup reset password form (shown after clicking email link)
function setupResetPasswordForm() {
    const form = byId('reset-password-form');
    const errorDiv = byId('reset-password-error');
    
    if (!form) return;
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const newPassword = byId('new-password').value;
        const confirmPassword = byId('confirm-password').value;
        
        errorDiv.style.display = 'none';
        
        // Validate passwords match
        if (newPassword !== confirmPassword) {
            errorDiv.textContent = 'Passwords do not match';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Validate password length
        if (newPassword.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Update password
        const result = await AuthService.updatePassword(newPassword);
        
        if (result.isOk) {
            alert('Password updated successfully! You can now log in with your new password.');
            // Redirect to login
            window.location.hash = '';
            window.location.reload();
        } else {
            errorDiv.textContent = result.error;
            errorDiv.style.display = 'block';
        }
    });
}

// Show change password modal
function showChangePasswordModal() {
    const modal = byId('change-password-modal');
    const form = byId('change-password-form');
    const cancelBtn = byId('cancel-password-change-btn');
    const errorDiv = byId('change-password-error');
    const successDiv = byId('change-password-success');
    
    // Reset form
    form.reset();
    errorDiv.style.display = 'none';
    successDiv.style.display = 'none';
    
    // Show modal
    modal.style.display = 'flex';
    
    // Cancel button handler
    cancelBtn.onclick = () => {
        modal.style.display = 'none';
    };
    
    // Close modal on outside click
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    };
    
    // Form submit handler
    form.onsubmit = async (e) => {
        e.preventDefault();
        
        errorDiv.style.display = 'none';
        successDiv.style.display = 'none';
        
        const currentPassword = byId('current-password').value;
        const newPassword = byId('new-password').value;
        const confirmNewPassword = byId('confirm-new-password').value;
        
        // Validate passwords match
        if (newPassword !== confirmNewPassword) {
            errorDiv.textContent = 'New passwords do not match';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Validate password length
        if (newPassword.length < 6) {
            errorDiv.textContent = 'Password must be at least 6 characters';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Verify current password by attempting to sign in
        const state = Store.getState();
        const verifyResult = await AuthService.login(state.user.email, currentPassword);
        
        if (!verifyResult.isOk) {
            errorDiv.textContent = 'Current password is incorrect';
            errorDiv.style.display = 'block';
            return;
        }
        
        // Update password
        const result = await AuthService.updatePassword(newPassword);
        
        if (result.isOk) {
            successDiv.textContent = 'Password updated successfully!';
            successDiv.style.display = 'block';
            form.reset();
            
            // Close modal after 2 seconds
            setTimeout(() => {
                modal.style.display = 'none';
            }, 2000);
        } else {
            errorDiv.textContent = result.error || 'Failed to update password';
            errorDiv.style.display = 'block';
        }
    };
}

// Show login screen
function showLoginScreen() {
    console.log('🔑 showLoginScreen() called');
    const loginScreen = byId('login-screen');
    const app = byId('app');
    
    console.log('Login screen element:', loginScreen);
    console.log('App element:', app);
    
    if (!loginScreen) {
        console.error('❌ #login-screen element not found!');
        return;
    }
    
    if (!app) {
        console.error('❌ #app element not found!');
        return;
    }
    
    loginScreen.style.display = 'flex';
    app.style.display = 'none';
    console.log('✅ Login screen displayed, app hidden');
}

// Load the main application after authentication
async function loadApplication() {
    // Show user info at top of sidebar
    const state = Store.getState();
    const userEmail = byId('user-email');
    
    if (state.user) {
        userEmail.textContent = state.user.email;
    }
    
    // Setup user dropdown menu
    const userMenuBtn = byId('user-menu-btn');
    const userDropdownMenu = byId('user-dropdown-menu');
    
    // Toggle dropdown on button click
    userMenuBtn.onclick = (e) => {
        e.stopPropagation();
        const isVisible = userDropdownMenu.style.display !== 'none';
        userDropdownMenu.style.display = isVisible ? 'none' : 'block';
    };
    
    // Close dropdown when clicking outside
    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userDropdownMenu.contains(e.target)) {
            userDropdownMenu.style.display = 'none';
        }
    });
    
    // Setup logout handler
    const logoutBtn = byId('logout-btn');
    logoutBtn.onclick = async () => {
        userDropdownMenu.style.display = 'none';
        const result = await AuthService.logout();
        if (result.isOk) {
            // Redirect to login page
            window.location.href = 'login.html';
        }
    };
    
    // Setup change password handler
    const changePasswordBtn = byId('change-password-btn');
    changePasswordBtn.onclick = () => {
        userDropdownMenu.style.display = 'none';
        showChangePasswordModal();
    };
    
    // Load application state from localStorage (only for authenticated users)
    const loadResult = Store.persistence.load();
    if (loadResult.isOk) {
        // Get current user with role from Database.init
        const currentUser = Store.get('user');
        console.log('💾 Current user from Database.init:', currentUser);
        
        // Restore user from persisted state since we have valid session
        const persistedUser = loadResult.value.user;
        if (persistedUser && currentUser) {
            // Merge persisted preferences but keep the role from current session
            Store.setState({ user: { ...persistedUser, ...currentUser } });
            console.log('✅ Final user state:', Store.get('user'));
        }
    } else {
        console.log('✅ User state from Database.init:', Store.get('user'));
    }
    
    // Load initial data from Supabase into state
    await loadInitialData();
    
    // Setup UI event handlers
    setupEventHandlers();
    
    // Render initial view
    const initialView = Store.get('currentView') || 'dashboard';
    Views.render(initialView);
    
    // Subscribe to state changes
    Store.subscribe((state, changes) => {
        if (changes.currentView) {
            Views.render(state.currentView);
        }
        
        if (changes.selectedClient || changes.selectedMarket || changes.selectedSloc) {
            updateContextSelectors();
            updateMainOperationsState();
            
            // Re-render Import Data view if it's currently active and SLOC changed
            if (changes.selectedSloc) {
                console.log('SLOC changed:', state.selectedSloc);
                console.log('Current view:', state.currentView);
                
                if (state.currentView === 'import') {
                    console.log('Re-rendering import view');
                    Views.render('import');
                }
            }
        }
        
        // Reload inventory lists when SLOC changes
        if (changes.selectedSloc) {
            reloadInventoryLists();
        }
    });
}

// Define tables that are cached locally and don't change frequently
const CACHED_TABLES = [
    'areas', 'categories', 'clients', 'crews', 'inv_action_types', 'inventory_types', 
    'item_types', 'item_type_markets', 'location_types', 'locations', 'markets', 'slocs', 
    'statuses', 'transaction_types', 'units_of_measure', 'inventory_providers'
];

// Load initial data from Supabase into state
async function loadInitialData() {
    console.log('📥 Loading initial data from Supabase...');
    
    try {
        // Load all data including cached reference tables
        const [clients, markets, slocs, itemTypes, crews, locations, statuses, categories, inventory, transactions, config, actionTypes, actionStatuses, unitsOfMeasure, providers, areas, inventoryTypes, locationTypes, transactionTypes, itemTypeMarkets, sequentials] = await Promise.all([
            Queries.getAllClients(),
            Queries.getAllMarkets(),
            Queries.getAllSlocs(),
            Queries.getAllItemTypes(),
            Queries.getAllCrews(),
            Queries.getAllLocations(),
            Queries.getAllStatuses(),
            Queries.getAllCategories(),
            Queries.getAllInventory(),
            Queries.getAllTransactions(100),
            Queries.getAllConfig(),
            Queries.getAllActionTypes(),
            Queries.getAllActionStatuses(),
            Queries.getAllUnitsOfMeasure(),
            Queries.getAllProviders(),
            Queries.getAllAreas(),
            Queries.getAllInventoryTypes(),
            Queries.getAllLocationTypes(),
            Queries.getAllTransactionTypes(),
            Queries.getAllItemTypeMarkets(),
            Queries.getAllSequentials()
        ]);
        
        // Clear initial context - let user select
        Store.setState({ 
            selectedClient: null,
            selectedMarket: null,
            selectedSloc: null
        });
        
        // Update state with all data (including cached reference tables)
        Store.setState({
            // Cached reference tables
            clients: clients.isOk ? clients.value : [],
            markets: markets.isOk ? markets.value : [],
            slocs: slocs.isOk ? slocs.value : [],
            itemTypes: itemTypes.isOk ? itemTypes.value : [],
            locations: locations.isOk ? locations.value : [],
            statuses: statuses.isOk ? statuses.value : [],
            categories: categories.isOk ? categories.value : [],
            actionTypes: actionTypes.isOk ? actionTypes.value : [],
            unitsOfMeasure: unitsOfMeasure.isOk ? unitsOfMeasure.value : [],
            areas: areas.isOk ? areas.value : [],
            inventoryTypes: inventoryTypes.isOk ? inventoryTypes.value : [],
            locationTypes: locationTypes.isOk ? locationTypes.value : [],
            transactionTypes: transactionTypes.isOk ? transactionTypes.value : [],
            itemTypeMarkets: itemTypeMarkets.isOk ? itemTypeMarkets.value : [],
            
            // Frequently changing data
            crews: crews.isOk ? crews.value : [],
            inventory: inventory.isOk ? inventory.value : [],
            transactions: transactions.isOk ? transactions.value : [],
            sequentials: sequentials.isOk ? sequentials.value : [],
            config: config.isOk ? config.value : [],
            actionStatuses: actionStatuses.isOk ? actionStatuses.value : [],
            providers: providers.isOk ? providers.value : []
        });
        
        // Ensure receivingStatus preference exists with default of 'Available'
        const receivingStatusPref = (config.isOk ? config.value : []).find(c => c.key === 'receivingStatus');
        if (!receivingStatusPref) {
            await Queries.setConfig('receivingStatus', 'Available');
            // Reload config
            const updatedConfig = await Queries.getAllConfig();
            if (updatedConfig.isOk) {
                Store.setState({ config: updatedConfig.value });
            }
        }
        
        console.log('✅ Initial data loaded from Supabase');
    } catch (error) {
        console.error('Error loading initial data:', error);
        Components.showToast('Error loading data from Supabase', 'error');
    }
}

// Refresh a specific cached reference table after modification
async function refreshCachedTable(tableName) {
    if (!CACHED_TABLES.includes(tableName)) {
        return;
    }
    
    try {
        let result;
        const queryMap = {
            'areas': Queries.getAllAreas,
            'categories': Queries.getAllCategories,
            'clients': Queries.getAllClients,
            'crews': Queries.getAllCrews,
            'inv_action_types': Queries.getAllActionTypes,
            'inventory_types': Queries.getAllInventoryTypes,
            'item_types': Queries.getAllItemTypes,
            'item_type_markets': Queries.getAllItemTypeMarkets,
            'location_types': Queries.getAllLocationTypes,
            'locations': Queries.getAllLocations,
            'markets': Queries.getAllMarkets,
            'slocs': Queries.getAllSlocs,
            'statuses': Queries.getAllStatuses,
            'transaction_types': Queries.getAllTransactionTypes,
            'units_of_measure': Queries.getAllUnitsOfMeasure
        };
        
        const queryFunc = queryMap[tableName];
        if (queryFunc) {
            result = await queryFunc();
            
            if (result.isOk) {
                // Map table names to state property names
                const stateMap = {
                    'inv_action_types': 'actionTypes',
                    'inventory_types': 'inventoryTypes',
                    'item_types': 'itemTypes',
                    'item_type_markets': 'itemTypeMarkets',
                    'location_types': 'locationTypes',
                    'transaction_types': 'transactionTypes',
                    'units_of_measure': 'unitsOfMeasure'
                };
                
                const stateKey = stateMap[tableName] || tableName;
                Store.setState({ [stateKey]: result.value });
                console.log(`✅ Cached table ${tableName} refreshed`);
            } else {
                console.error(`Failed to refresh ${tableName}:`, result.error);
            }
        }
    } catch (error) {
        console.error(`Error refreshing cached table ${tableName}:`, error);
    }
}

// Setup UI event handlers
async function setupEventHandlers() {
    // Navigation buttons
    $$('.nav-btn').forEach(btn => {
        on('click', (e) => {
            const view = btn.dataset.view;
            if (view) {
                Views.render(view);
            }
        }, btn);
    });
    
    // Initialize cascading dropdowns
    await initializeCascadingDropdowns();
    
    // Set initial Main Operations button state
    updateMainOperationsState();
}

// Refresh hierarchy dropdowns (called after creating/editing hierarchy items)
async function refreshHierarchyDropdowns() {
    const clientSelect = byId('clientSelect');
    const marketSelect = byId('marketSelect');
    const slocSelect = byId('slocSelect');
    
    if (!clientSelect || !marketSelect || !slocSelect) {
        return; // Dropdowns don't exist
    }
    
    const state = Store.getState();
    const currentClientId = clientSelect.value;
    const currentMarketId = marketSelect.value;
    const currentSlocId = slocSelect.value;
    
    // Helper to populate dropdown
    const populateDropdown = (select, items, placeholderText) => {
        const currentValue = select.value;
        select.innerHTML = '';
        const placeholder = createElement('option', { value: '', disabled: true, selected: !currentValue }, [placeholderText]);
        select.appendChild(placeholder);
        items.forEach(item => {
            const option = createElement('option', { value: item.id, selected: item.id === parseInt(currentValue) }, [item.name]);
            select.appendChild(option);
        });
    };
    
    // Refresh clients
    const clients = await Queries.getAllClients();
    if (clients.isOk) {
        populateDropdown(clientSelect, clients.value, '-- Select Client --');
        clientSelect.value = currentClientId || '';
    }
    
    // Refresh markets if client is selected
    if (currentClientId) {
        const markets = await Queries.getMarketsByClient(parseInt(currentClientId));
        if (markets.isOk) {
            populateDropdown(marketSelect, markets.value, '-- Select Market --');
            marketSelect.disabled = false;
            marketSelect.value = currentMarketId || '';
        }
    }
    
    // Refresh SLOCs if market is selected
    if (currentMarketId) {
        const slocs = await Queries.getSlocsByMarket(parseInt(currentMarketId));
        if (slocs.isOk) {
            populateDropdown(slocSelect, slocs.value, '-- Select SLOC --');
            slocSelect.disabled = false;
            slocSelect.value = currentSlocId || '';
        }
    }
}

// Initialize cascading client/market/SLOC dropdowns
async function initializeCascadingDropdowns() {
    const clientSelect = byId('clientSelect');
    const marketSelect = byId('marketSelect');
    const slocSelect = byId('slocSelect');
    
    if (!clientSelect || !marketSelect || !slocSelect) {
        return; // Dropdowns don't exist on this page
    }
    
    // Helper to populate dropdown options
    const populateDropdown = (select, items, placeholderText) => {
        // Clear existing options
        select.innerHTML = '';
        
        // Add placeholder
        const placeholder = createElement('option', { value: '', disabled: true, selected: true }, [placeholderText]);
        select.appendChild(placeholder);
        
        // Add items
        items.forEach(item => {
            const option = createElement('option', { value: item.id }, [item.name]);
            select.appendChild(option);
        });
    };
    
    // Initially populate client dropdown and disable dependents
    const clients = await Queries.getAllClients();
    if (clients.isOk && clients.value.length > 0) {
        populateDropdown(clientSelect, clients.value, '-- Select Client --');
    }
    
    // Initially disable market and SLOC dropdowns
    marketSelect.disabled = true;
    slocSelect.disabled = true;
    populateDropdown(marketSelect, [], '-- Select Market --');
    populateDropdown(slocSelect, [], '-- Select SLOC --');
    
    // Client change handler
    on('change', async (e) => {
        const clientId = e.target.value;
        
        if (!clientId) {
            // No client selected - disable and clear dependent dropdowns
            marketSelect.disabled = true;
            slocSelect.disabled = true;
            populateDropdown(marketSelect, [], '-- Select Market --');
            populateDropdown(slocSelect, [], '-- Select SLOC --');
            Store.setState({ 
                selectedClient: null,
                selectedMarket: null,
                selectedSloc: null
            });
            return;
        }
        
        // Update state with selected client
        const selectedClient = clients.value.find(c => c.id === parseInt(clientId));
        Store.setState({ 
            selectedClient: selectedClient,
            selectedMarket: null,
            selectedSloc: null
        });
        
        // Load and populate markets for selected client
        const markets = await Queries.getMarketsByClient(parseInt(clientId));
        if (markets.isOk && markets.value.length > 0) {
            populateDropdown(marketSelect, markets.value, '-- Select Market --');
            marketSelect.disabled = false;
        } else {
            populateDropdown(marketSelect, [], '-- Select Market --');
            marketSelect.disabled = true;
        }
        
        // Clear SLOC dropdown
        populateDropdown(slocSelect, [], '-- Select SLOC --');
        slocSelect.disabled = true;
    }, clientSelect);
    
    // Market change handler
    on('change', async (e) => {
        const marketId = e.target.value;
        
        if (!marketId) {
            // No market selected - disable and clear SLOC dropdown
            slocSelect.disabled = true;
            populateDropdown(slocSelect, [], '-- Select SLOC --');
            Store.setState({ 
                selectedMarket: null,
                selectedSloc: null
            });
            return;
        }
        
        // Update state with selected market
        const clientId = Store.get('selectedClient')?.id;
        if (!clientId) return;
        
        const markets = await Queries.getMarketsByClient(clientId);
        const selectedMarket = markets.isOk ? markets.value.find(m => m.id === parseInt(marketId)) : null;
        
        Store.setState({ 
            selectedMarket: selectedMarket,
            selectedSloc: null
        });
        
        // Load and populate SLOCs for selected market
        const slocs = await Queries.getSlocsByMarket(parseInt(marketId));
        if (slocs.isOk && slocs.value.length > 0) {
            populateDropdown(slocSelect, slocs.value, '-- Select SLOC --');
            slocSelect.disabled = false;
        } else {
            populateDropdown(slocSelect, [], '-- Select SLOC --');
            slocSelect.disabled = true;
        }
    }, marketSelect);
    
    // SLOC change handler
    on('change', async (e) => {
        const slocId = e.target.value;
        
        if (!slocId) {
            Store.setState({ selectedSloc: null });
            updateInventoryTemplateButton(false);
            return;
        }
        
        // Update state with selected SLOC
        const marketId = Store.get('selectedMarket')?.id;
        if (!marketId) return;
        
        const slocs = await Queries.getSlocsByMarket(marketId);
        const selectedSloc = slocs.isOk ? slocs.value.find(s => s.id === parseInt(slocId)) : null;
        
        Store.setState({ selectedSloc: selectedSloc });
        
        // Enable/disable inventory template button based on SLOC selection
        updateInventoryTemplateButton(!!selectedSloc);
    }, slocSelect);
}

// Enable/disable Main Operations buttons based on SLOC selection
function updateMainOperationsState() {
    const state = Store.getState();
    const hasSlocSelected = !!state.selectedSloc;
    
    // Get all Main Operations section buttons
    const mainOpsButtons = $$('.nav-section h3').filter(h3 => 
        h3.textContent.trim() === 'Main Operations'
    )[0]?.parentElement.querySelectorAll('.nav-btn');
    
    if (mainOpsButtons && mainOpsButtons.length > 0) {
        mainOpsButtons.forEach(btn => {
            if (hasSlocSelected) {
                btn.disabled = false;
                btn.style.opacity = '1';
                btn.style.cursor = 'pointer';
            } else {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                btn.style.cursor = 'not-allowed';
            }
        });
    }
}

// Reload inventory lists when SLOC changes
async function reloadInventoryLists() {
    const state = Store.getState();
    
    if (!state.selectedSloc) {
        return;
    }
    
    // Reload inventory filtered by the selected SLOC
    const inventoryResult = await Queries.getInventoryBySloc(state.selectedSloc.id);
    
    if (inventoryResult.isOk) {
        Store.setState({ inventory: inventoryResult.value });
        
        // Re-render current view if it's one of the inventory views
        const currentView = state.currentView;
        if (['receive-serialized', 'receive-bulk', 'inventory-view'].includes(currentView)) {
            Views.render(currentView);
        }
    }
}

// Update context selectors based on state (used for programmatic changes)
async function updateContextSelectors() {
    const state = Store.getState();
    
    const clientSelect = byId('clientSelect');
    const marketSelect = byId('marketSelect');
    const slocSelect = byId('slocSelect');
    
    if (!clientSelect || !marketSelect || !slocSelect) {
        return;
    }
    
    // Update client selection
    if (state.selectedClient) {
        clientSelect.value = state.selectedClient.id;
    } else {
        clientSelect.value = '';
    }
    
    // Update market selection
    if (state.selectedMarket) {
        marketSelect.value = state.selectedMarket.id;
        marketSelect.disabled = false;
    } else {
        marketSelect.value = '';
    }
    
    // Update SLOC selection
    if (state.selectedSloc) {
        slocSelect.value = state.selectedSloc.id;
        slocSelect.disabled = false;
    } else {
        slocSelect.value = '';
    }
}

// Database operation wrappers that auto-refresh cached tables
const DB = {
    /**
     * Insert a record and refresh cache if the table is cached
     * @param {string} table - Table name
     * @param {object} data - Data to insert
     * @returns {Promise<Result>}
     */
    insert: async (table, data) => {
        const result = await Database.insert(table, data);
        
        if (result.isOk && CACHED_TABLES.includes(table)) {
            await refreshCachedTable(table);
        }
        
        return result;
    },
    
    /**
     * Update a record and refresh cache if the table is cached
     * Special handling for inventory table to check for bulk consolidation
     * @param {string} table - Table name
     * @param {number} id - Record ID
     * @param {object} data - Data to update
     * @returns {Promise<Result>}
     */
    update: async (table, id, data) => {
        let result;
        
        // Use special bulk inventory update for inventory table
        if (table === 'inventory') {
            result = await Queries.updateBulkInventory(id, data);
            
            // If consolidation occurred, refresh inventory in state
            if (result.isOk && result.value.operation === 'consolidated') {
                const inventoryResult = await Queries.getAllInventory();
                if (inventoryResult.isOk) {
                    Store.setState({ inventory: inventoryResult.value });
                }
            }
        } else {
            result = await Database.update(table, id, data);
        }
        
        if (result.isOk && CACHED_TABLES.includes(table)) {
            await refreshCachedTable(table);
        }
        
        return result;
    },
    
    /**
     * Delete a record and refresh cache if the table is cached
     * @param {string} table - Table name
     * @param {number} id - Record ID
     * @returns {Promise<Result>}
     */
    delete: async (table, id) => {
        const result = await Database.deleteRecord(table, id);
        
        if (result.isOk && CACHED_TABLES.includes(table)) {
            await refreshCachedTable(table);
        }
        
        return result;
    }
};

// Update inventory template button state
function updateInventoryTemplateButton(enabled) {
    const downloadButton = byId('download-inventory-template-btn');
    const importButton = byId('import-inventory-btn');
    const importNewButton = byId('import-new-inventory-btn');
    const warningMsg = byId('inventory-template-warning');
    const noSlocWarning = byId('import-no-sloc-warning');
    
    if (downloadButton) {
        if (enabled) {
            downloadButton.removeAttribute('disabled');
            downloadButton.style.opacity = '1';
            downloadButton.style.cursor = 'pointer';
        } else {
            downloadButton.disabled = '';
            downloadButton.style.opacity = '0.6';
            downloadButton.style.cursor = 'not-allowed';
        }
    }
    
    if (importButton) {
        if (enabled) {
            importButton.removeAttribute('disabled');
            importButton.style.opacity = '1';
            importButton.style.cursor = 'pointer';
        } else {
            importButton.disabled = '';
            importButton.style.opacity = '0.6';
            importButton.style.cursor = 'not-allowed';
        }
    }
    
    if (importNewButton) {
        if (enabled) {
            importNewButton.removeAttribute('disabled');
            importNewButton.style.opacity = '1';
            importNewButton.style.cursor = 'pointer';
        } else {
            importNewButton.disabled = '';
            importNewButton.style.opacity = '0.6';
            importNewButton.style.cursor = 'not-allowed';
        }
    }
    
    if (warningMsg) {
        warningMsg.style.display = enabled ? 'none' : 'block';
    }
    
    if (noSlocWarning) {
        noSlocWarning.style.display = enabled ? 'none' : 'block';
    }
}

// Make DB and refreshCachedTable available globally for use in other modules
window.DB = DB;
window.refreshCachedTable = refreshCachedTable;
window.loadInitialData = loadInitialData;

/**
 * Authentication Service
 * Handle user login, logout, and session management
 */

const AuthService = (() => {
    
    // Login with email and password
    const login = async (email, password) => {
        try {
            const { data, error } = await Database.getClient().auth.signInWithPassword({
                email,
                password
            });
            
            if (error) {
                return Result.error(error.message);
            }
            
            if (data.user) {
                const userState = {
                    id: data.user.id,
                    email: data.user.email,
                    name: data.user.email
                };
                Store.setState({ user: userState });
                return Result.ok(userState);
            }
            
            return Result.error('Login failed');
        } catch (error) {
            console.error('Login exception:', error);
            return Result.error(error.message);
        }
    };
    
    // Login with OAuth (Microsoft/Azure)
    const loginWithOAuth = async (provider = 'azure', options = {}) => {
        try {
            const defaultOptions = {
                redirectTo: window.location.origin + '/index.html',
                scopes: 'email profile'
            };
            
            const { data, error } = await Database.getClient().auth.signInWithOAuth({
                provider,
                options: { ...defaultOptions, ...options }
            });
            
            if (error) {
                return Result.error(error.message);
            }
            
            // OAuth redirects, so we won't reach here on success
            return Result.ok(data);
        } catch (error) {
            console.error('OAuth login exception:', error);
            return Result.error(error.message);
        }
    };
    
    // Logout
    const logout = async () => {
        try {
            // Get the Supabase client
            const client = Database.getClient();
            
            if (!client) {
                Store.setState({ user: null });
                return Result.ok(true);
            }
            
            const { error } = await client.auth.signOut();
            
            if (error) {
                console.error('❌ Logout error:', error);
            } else {
                console.log('✅ Logged out successfully');
            }
            
            // Always clear local state regardless of signOut result
            Store.setState({ user: null });
            localStorage.removeItem('supabase.auth.token');
            Store.persistence.clear();
            
            return Result.ok(true);
        } catch (error) {
            console.error('Logout exception:', error);
            // Clear local state even on exception
            Store.setState({ user: null });
            localStorage.removeItem('supabase.auth.token');
            return Result.error(error.message);
        }
    };
    
    // Check if user is logged in
    const isAuthenticated = () => {
        const state = Store.getState();
        return !!state.user;
    };
    
    // Get current user
    const getCurrentUser = () => {
        const state = Store.getState();
        return state.user;
    };
    
    // Request password reset email
    const requestPasswordReset = async (email) => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            // Get the current URL origin for redirect
            const redirectUrl = window.location.origin + window.location.pathname;
            
            const { error } = await client.auth.resetPasswordForEmail(email, {
                redirectTo: redirectUrl
            });
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok('Password reset email sent');
        } catch (error) {
            console.error('Password reset request error:', error);
            return Result.error(error.message);
        }
    };
    
    // Update password (called after user clicks reset link)
    const updatePassword = async (newPassword) => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            const { error } = await client.auth.updateUser({
                password: newPassword
            });
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok('Password updated successfully');
        } catch (error) {
            console.error('Password update error:', error);
            return Result.error(error.message);
        }
    };
    
    // Admin: List all users
    const listUsers = async () => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            // Call Supabase Admin API to list users
            const { data, error } = await client.auth.admin.listUsers();
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok(data.users || []);
        } catch (error) {
            console.error('List users error:', error);
            return Result.error(error.message);
        }
    };
    
    // Admin: Update user metadata (role)
    const updateUserRole = async (userId, role) => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            // Update user metadata via Supabase Admin API
            const { data, error } = await client.auth.admin.updateUserById(
                userId,
                { user_metadata: { user_role: role } }
            );
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok(data);
        } catch (error) {
            console.error('Update user role error:', error);
            return Result.error(error.message);
        }
    };
    
    // Admin: Create new user
    const createUser = async (email, password, role = 'user') => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            // Create user via Supabase Admin API
            const { data, error } = await client.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { user_role: role }
            });
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok(data.user);
        } catch (error) {
            console.error('Create user error:', error);
            return Result.error(error.message);
        }
    };
    
    // Admin: Delete user
    const deleteUser = async (userId) => {
        try {
            const client = Database.getClient();
            
            if (!client) {
                return Result.error('Database not initialized');
            }
            
            // Delete user via Supabase Admin API
            const { error } = await client.auth.admin.deleteUser(userId);
            
            if (error) {
                return Result.error(error.message);
            }
            
            return Result.ok(true);
        } catch (error) {
            console.error('Delete user error:', error);
            return Result.error(error.message);
        }
    };
    
    return {
        login,
        loginWithOAuth,
        logout,
        isAuthenticated,
        getCurrentUser,
        requestPasswordReset,
        updatePassword,
        listUsers,
        updateUserRole,
        createUser,
        deleteUser
    };
})();

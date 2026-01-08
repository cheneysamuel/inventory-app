/**
 * Preferences Helper Functions
 * Extracted from preferences view to improve maintainability
 * 
 * This module contains handler functions for preferences operations:
 * - Clear Operations: Item types, inventory, transactions, sequentials
 * - Config Management: Edit, delete config keys
 * - Export Operations: Bulk database export
 * - Navigation: Section switching
 */

const PreferencesHelpers = (() => {
    
    // ==================== NAVIGATION ====================
    
    /**
     * Show a specific preference section and update navigation
     * @param {string} sectionId - Section ID to show
     * @param {boolean} isAdmin - Whether user has admin role
     */
    const showPreferenceSection = (sectionId, isAdmin) => {
        // Hide all sections
        const sections = isAdmin 
            ? ['receiving-section', 'display-section', 'admin-section', 'config-section', 'users-section', 'export-section']
            : ['receiving-section', 'display-section'];
            
        sections.forEach(id => {
            const section = byId(id);
            if (section) section.style.display = 'none';
        });
        
        // Remove active class from all nav items
        const navItems = document.querySelectorAll('.prefs-nav-item');
        navItems.forEach(item => item.classList.remove('active'));
        
        // Show selected section
        const selectedSection = byId(sectionId);
        if (selectedSection) selectedSection.style.display = 'block';
        
        // Add active class to clicked nav item
        const activeNav = document.querySelector(`[data-section="${sectionId}"]`);
        if (activeNav) activeNav.classList.add('active');
    };
    
    // ==================== CLEAR OPERATIONS ====================
    
    /**
     * Clear all item types from database
     */
    const handleClearItemTypes = async () => {
        const state = Store.getState();
        const count = state.itemTypes.length;
        
        if (count === 0) {
            Components.showToast('No item types to clear', 'info');
            return;
        }
        
        const confirmed = confirm(
            `⚠️ WARNING: This will permanently delete ALL ${count} item types.\n\n` +
            `This action cannot be undone and may affect inventory records.\n\n` +
            `Are you sure you want to continue?`
        );
        
        if (!confirmed) return;
        
        try {
            const deletePromises = state.itemTypes.map(itemType => 
                Database.deleteRecord('item_types', itemType.id)
            );
            
            await Promise.all(deletePromises);
            
            // Reload item types state
            const itemTypesResult = await Queries.getAllItemTypes();
            if (itemTypesResult.isOk) {
                Store.setState({ itemTypes: itemTypesResult.value });
            }
            
            Components.showToast(`Successfully cleared ${count} item types`, 'success');
            Views.render('preferences');
        } catch (error) {
            console.error('Error clearing item types:', error);
            Components.showToast('Failed to clear item types', 'error');
        }
    };
    
    /**
     * Clear all inventory records from database
     */
    const handleClearInventory = async () => {
        const state = Store.getState();
        const count = state.inventory.length;
        
        if (count === 0) {
            Components.showToast('No inventory to clear', 'info');
            return;
        }
        
        const confirmed = confirm(
            `⚠️ WARNING: This will permanently delete ALL ${count} inventory records.\n\n` +
            `This action cannot be undone.\n\n` +
            `Are you sure you want to continue?`
        );
        
        if (!confirmed) return;
        
        try {
            const deletePromises = state.inventory.map(item => 
                Database.deleteRecord('inventory', item.id)
            );
            
            await Promise.all(deletePromises);
            
            // Reload inventory state
            const inventoryResult = await Queries.getAllInventory();
            if (inventoryResult.isOk) {
                Store.setState({ inventory: inventoryResult.value });
            }
            
            Components.showToast(`Successfully cleared ${count} inventory records`, 'success');
            Views.render('preferences');
        } catch (error) {
            console.error('Error clearing inventory:', error);
            Components.showToast('Failed to clear inventory', 'error');
        }
    };
    
    /**
     * Clear all transaction records from database
     */
    const handleClearTransactions = async () => {
        const state = Store.getState();
        const count = state.transactions.length;
        
        if (count === 0) {
            Components.showToast('No transactions to clear', 'info');
            return;
        }
        
        const confirmed = confirm(
            `⚠️ WARNING: This will permanently delete ALL ${count} transaction records.\n\n` +
            `This action cannot be undone.\n\n` +
            `Are you sure you want to continue?`
        );
        
        if (!confirmed) return;
        
        try {
            const deletePromises = state.transactions.map(tx => 
                Database.deleteRecord('transactions', tx.id)
            );
            
            await Promise.all(deletePromises);
            
            // Reload transactions state
            const txResult = await Queries.getRecentTransactions(100);
            if (txResult.isOk) {
                Store.setState({ transactions: txResult.value });
            }
            
            Components.showToast(`Successfully cleared ${count} transaction records`, 'success');
            Views.render('preferences');
        } catch (error) {
            console.error('Error clearing transactions:', error);
            Components.showToast('Failed to clear transactions', 'error');
        }
    };
    
    /**
     * Clear all sequential records from database
     */
    const handleClearSequentials = async () => {
        const state = Store.getState();
        const count = state.sequentials?.length || 0;
        
        if (count === 0) {
            Components.showToast('No sequentials to clear', 'info');
            return;
        }
        
        const confirmed = confirm(
            `⚠️ WARNING: This will permanently delete ALL ${count} sequential records.\n\n` +
            `This action cannot be undone.\n\n` +
            `Are you sure you want to continue?`
        );
        
        if (!confirmed) return;
        
        try {
            const deletePromises = state.sequentials.map(seq => 
                Database.deleteRecord('sequentials', seq.id)
            );
            
            await Promise.all(deletePromises);
            
            // Reload sequentials state
            const seqResult = await Queries.getAllSequentials();
            if (seqResult.isOk) {
                Store.setState({ sequentials: seqResult.value });
            }
            
            Components.showToast(`Successfully cleared ${count} sequential records`, 'success');
            Views.render('preferences');
        } catch (error) {
            console.error('Error clearing sequentials:', error);
            Components.showToast('Failed to clear sequentials', 'error');
        }
    };
    
    // ==================== CONFIG MANAGEMENT ====================
    
    /**
     * Edit a config key's value
     * @param {string} key - Config key to edit
     * @param {string} currentValue - Current value
     */
    const handleEditConfigValue = async (key, currentValue) => {
        const newValue = prompt(`Edit value for "${key}":`, currentValue);
        
        if (newValue === null || newValue === currentValue) return;
        
        try {
            await Queries.setConfig(key, newValue);
            
            const configResult = await Queries.getAllConfig();
            if (configResult.isOk) {
                Store.setState({ config: configResult.value });
            }
            Components.showToast('Config value updated successfully', 'success');
            Views.render('preferences');
            showPreferenceSection('config-section', true);
        } catch (error) {
            console.error('Edit config error:', error);
            Components.showToast('Failed to update config value', 'error');
        }
    };
    
    /**
     * Delete a config key
     * @param {string} key - Config key to delete
     */
    const handleDeleteConfigKey = async (key) => {
        const confirmed = confirm(`Are you sure you want to delete the config key "${key}"?`);
        if (!confirmed) return;
        
        try {
            await Queries.deleteConfig(key);
            
            const configResult = await Queries.getAllConfig();
            if (configResult.isOk) {
                Store.setState({ config: configResult.value });
            }
            Components.showToast('Config key deleted successfully', 'success');
            Views.render('preferences');
            showPreferenceSection('config-section', true);
        } catch (error) {
            console.error('Delete config error:', error);
            Components.showToast('Failed to delete config key', 'error');
        }
    };
    
    // ==================== UTILITY OPERATIONS ====================
    
    /**
     * Open Supabase dashboard for user management
     */
    const handleOpenSupabaseDashboard = () => {
        const supabaseUrl = Database.getClient().supabaseUrl;
        if (supabaseUrl) {
            const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\.supabase\.co/)?.[1];
            if (projectRef) {
                window.open(`https://supabase.com/dashboard/project/${projectRef}/auth/users`, '_blank');
            } else {
                window.open('https://supabase.com/dashboard', '_blank');
            }
        } else {
            window.open('https://supabase.com/dashboard', '_blank');
        }
    };
    
    /**
     * Export entire database to Excel
     */
    const handleBulkExport = async () => {
        Components.showToast('Preparing database export...', 'info');
        await ImportExportService.exportDatabaseToExcel();
    };
    
    // ==================== PUBLIC API ====================
    
    return {
        // Navigation
        showPreferenceSection,
        
        // Clear operations
        handleClearItemTypes,
        handleClearInventory,
        handleClearTransactions,
        handleClearSequentials,
        
        // Config management
        handleEditConfigValue,
        handleDeleteConfigKey,
        
        // Utility operations
        handleOpenSupabaseDashboard,
        handleBulkExport
    };
})();

// Make available globally
window.PreferencesHelpers = PreferencesHelpers;

/**
 * Export Data Helpers
 * 
 * Extracted helper functions for the Export Data view.
 * Handles cascading dropdown population, filter management, and export operations.
 */

const ExportDataHelpers = (function() {
    'use strict';
    
    // ========================================
    // DROPDOWN POPULATION
    // ========================================
    
    /**
     * Populate a dropdown with items
     */
    function populateExportDropdown(selectId, items, defaultText, selectedValue = '') {
        const select = byId(selectId);
        if (!select) return;
        
        // Store current value if provided
        const valueToSet = selectedValue || select.value || '';
        
        // Clear and rebuild options
        select.innerHTML = '';
        
        // Add default option
        const defaultOption = createElement('option', { value: '' }, [defaultText]);
        select.appendChild(defaultOption);
        
        // Add items
        items.forEach(item => {
            const option = createElement('option', { value: item.id }, [item.name]);
            select.appendChild(option);
        });
        
        // Restore value if it exists in the new options
        if (valueToSet) {
            select.value = valueToSet;
        }
    }
    
    // ========================================
    // CASCADING FILTER HANDLERS
    // ========================================
    
    /**
     * Handle client filter change (cascades to markets)
     */
    function handleClientChange(clientId, state) {
        // Filter and update markets dropdown
        let filteredMarkets = clientId 
            ? state.markets.filter(m => m.client_id === parseInt(clientId))
            : state.markets;
        populateExportDropdown('export-market-filter', filteredMarkets, 'All Markets');
        
        // Clear dependent dropdowns
        populateExportDropdown('export-sloc-filter', [], 'All SLOCs');
        populateExportDropdown('export-area-filter', [], 'All Areas');
    }
    
    /**
     * Handle market filter change (cascades to SLOCs)
     */
    function handleMarketChange(marketId, state) {
        // Filter and update SLOCs dropdown
        let filteredSlocs = marketId
            ? state.slocs.filter(s => s.market_id === parseInt(marketId))
            : state.slocs;
        populateExportDropdown('export-sloc-filter', filteredSlocs, 'All SLOCs');
        
        // Clear dependent dropdown
        populateExportDropdown('export-area-filter', [], 'All Areas');
    }
    
    /**
     * Handle SLOC filter change (cascades to areas)
     */
    function handleSlocChange(slocId, state) {
        // Filter and update areas dropdown
        let filteredAreas = slocId
            ? state.areas.filter(a => a.sloc_id === parseInt(slocId))
            : state.areas;
        populateExportDropdown('export-area-filter', filteredAreas, 'All Areas');
    }
    
    // ========================================
    // FORM BUILDING
    // ========================================
    
    /**
     * Build the export filter form with cascading dropdowns
     */
    function buildExportForm(state) {
        const formContainer = byId('export-filter-form');
        if (!formContainer) return;
        
        formContainer.innerHTML = '';
        
        // Client dropdown
        const clientOptions = [{ value: '', text: 'All Clients' }];
        state.clients.forEach(c => {
            clientOptions.push({ value: c.id, text: c.name });
        });
        
        // Initial empty dropdowns for cascading filters
        const marketOptions = [{ value: '', text: 'All Markets' }];
        const slocOptions = [{ value: '', text: 'All SLOCs' }];
        const areaOptions = [{ value: '', text: 'All Areas' }];
        
        // Crew dropdown
        const crewOptions = [{ value: '', text: 'All Crews' }];
        state.crews.forEach(c => {
            crewOptions.push({ value: c.id, text: c.name });
        });
        
        formContainer.appendChild(
            div({ className: 'row' }, [
                div({ className: 'col-md-4' }, [
                    Components.formField({
                        type: 'select',
                        id: 'export-client-filter',
                        name: 'client',
                        label: 'Client',
                        options: clientOptions,
                        onchange: (e) => handleClientChange(e.target.value, state)
                    })
                ]),
                div({ className: 'col-md-4' }, [
                    Components.formField({
                        type: 'select',
                        id: 'export-market-filter',
                        name: 'market',
                        label: 'Market',
                        options: marketOptions,
                        onchange: (e) => handleMarketChange(e.target.value, state)
                    })
                ]),
                div({ className: 'col-md-4' }, [
                    Components.formField({
                        type: 'select',
                        id: 'export-sloc-filter',
                        name: 'sloc',
                        label: 'SLOC',
                        options: slocOptions,
                        onchange: (e) => handleSlocChange(e.target.value, state)
                    })
                ])
            ])
        );
        
        formContainer.appendChild(
            div({ className: 'row mt-3' }, [
                div({ className: 'col-md-4' }, [
                    Components.formField({
                        type: 'select',
                        id: 'export-area-filter',
                        name: 'area',
                        label: 'Area',
                        options: areaOptions
                    })
                ]),
                div({ className: 'col-md-4' }, [
                    Components.formField({
                        type: 'select',
                        id: 'export-crew-filter',
                        name: 'crew',
                        label: 'Crew',
                        options: crewOptions
                    })
                ])
            ])
        );
    }
    
    // ========================================
    // FILTER MANAGEMENT
    // ========================================
    
    /**
     * Reset all filters to default state
     */
    function handleReset(state) {
        // Clear all form fields by directly setting values
        const clientField = byId('export-client-filter');
        const marketField = byId('export-market-filter');
        const slocField = byId('export-sloc-filter');
        const areaField = byId('export-area-filter');
        const crewField = byId('export-crew-filter');
        
        if (clientField) clientField.value = '';
        if (marketField) marketField.value = '';
        if (slocField) slocField.value = '';
        if (areaField) areaField.value = '';
        if (crewField) crewField.value = '';
        
        // Reset cascading dropdowns to show all options
        populateExportDropdown('export-market-filter', state.markets, 'All Markets');
        populateExportDropdown('export-sloc-filter', state.slocs, 'All SLOCs');
        populateExportDropdown('export-area-filter', state.areas, 'All Areas');
        
        Components.showToast('Filters reset', 'info');
    }
    
    /**
     * Handle export operation with current filters
     */
    async function handleExport(state) {
        try {
            // Get filter values from DOM
            const selectedClient = byId('export-client-filter')?.value || '';
            const selectedMarket = byId('export-market-filter')?.value || '';
            const selectedSloc = byId('export-sloc-filter')?.value || '';
            const selectedArea = byId('export-area-filter')?.value || '';
            const selectedCrew = byId('export-crew-filter')?.value || '';
            
            // Get filter values
            const filters = {
                clientId: selectedClient ? parseInt(selectedClient) : null,
                marketId: selectedMarket ? parseInt(selectedMarket) : null,
                slocId: selectedSloc ? parseInt(selectedSloc) : null,
                areaId: selectedArea ? parseInt(selectedArea) : null,
                crewId: selectedCrew ? parseInt(selectedCrew) : null
            };
            
            // Get filter names for display
            const filterNames = {
                client: selectedClient ? state.clients.find(c => c.id === parseInt(selectedClient))?.name : 'All',
                market: selectedMarket ? state.markets.find(m => m.id === parseInt(selectedMarket))?.name : 'All',
                sloc: selectedSloc ? state.slocs.find(s => s.id === parseInt(selectedSloc))?.name : 'All',
                area: selectedArea ? state.areas.find(a => a.id === parseInt(selectedArea))?.name : 'All',
                crew: selectedCrew ? state.crews.find(c => c.id === parseInt(selectedCrew))?.name : 'All'
            };
            
            await ImportExportService.exportFilteredDataToExcel(filters, filterNames);
        } catch (error) {
            console.error('Export error:', error);
            Components.showToast('Export failed', 'error');
        }
    }
    
    // ========================================
    // PUBLIC API
    // ========================================
    
    return {
        // Form building
        buildExportForm,
        
        // Filter management
        handleReset,
        handleExport,
        
        // Cascading handlers (exposed for testing/reuse)
        handleClientChange,
        handleMarketChange,
        handleSlocChange,
        populateExportDropdown
    };
})();

// Expose to global scope
window.ExportDataHelpers = ExportDataHelpers;

/**
 * Import/Export Service
 * Handle data import and export operations
 */

const ImportExportService = (() => {
    
    // Export inventory to Excel
    const exportInventoryToExcel = (inventory = null) => {
        const state = Store.getState();
        const data = inventory || state.inventory;
        
        if (data.length === 0) {
            Components.showToast('No data to export', 'warning');
            return;
        }
        
        // Prepare data for export
        const exportData = data.map(item => ({
            'ID': item.id,
            'Item Type': item.item_type_name,
            'Inventory Type': item.inventory_type_name,
            'Manufacturer SN': item.mfgrsn || '',
            'Tilson SN': item.tilsonsn || '',
            'Quantity': item.quantity,
            'Status': item.status_name,
            'Location': item.location_name,
            'Location Type': item.location_type_name,
            'Crew': item.crew_name || '',
            'Area': item.area_name || '',
            'SLOC': item.sloc_name || '',
            'Created': new Date(item.created_at).toLocaleString(),
            'Updated': new Date(item.updated_at).toLocaleString()
        }));
        
        // Create workbook
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Add worksheet to workbook
        XLSX.utils.book_append_sheet(wb, ws, 'Inventory');
        
        // Generate filename
        const filename = `inventory_export_${getLocalDateString()}.xlsx`;
        
        // Save file
        XLSX.writeFile(wb, filename);
        
        Components.showToast('Inventory exported successfully', 'success');
    };
    
    // Export transactions to Excel
    const exportTransactionsToExcel = (transactions = null) => {
        const state = Store.getState();
        const data = transactions || state.transactions;
        
        if (data.length === 0) {
            Components.showToast('No transactions to export', 'warning');
            return;
        }
        
        const exportData = data.map(tx => ({
            'ID': tx.id,
            'Type': tx.transaction_type,
            'Action': tx.action,
            'Item': tx.item_type_name || '',
            'Quantity': tx.quantity || '',
            'From Location': tx.from_location_name || '',
            'To Location': tx.to_location_name || '',
            'Status': tx.status_name || '',
            'User': tx.user_name,
            'Date/Time': new Date(tx.date_time).toLocaleString(),
            'Notes': tx.notes || ''
        }));
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        XLSX.utils.book_append_sheet(wb, ws, 'Transactions');
        
        const filename = `transactions_export_${getLocalDateString()}.xlsx`;
        XLSX.writeFile(wb, filename);
        
        Components.showToast('Transactions exported successfully', 'success');
    };
    
    // Export database to JSON
    const exportDatabaseToJSON = () => {
        const data = {
            exported_at: getLocalTimestamp(),
            version: '1.0',
            clients: Queries.getAllClients().value || [],
            markets: Queries.getAllMarkets().value || [],
            slocs: Queries.getAllSlocs().value || [],
            crews: Queries.getAllCrews().value || [],
            areas: Queries.getAllAreas().value || [],
            item_types: Queries.getAllItemTypes().value || [],
            inventory: Queries.getAllInventory().value || [],
            transactions: Queries.getAllTransactions(1000).value || []
        };
        
        const json = JSON.stringify(data, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `database_export_${getLocalDateString()}.json`;
        a.click();
        
        URL.revokeObjectURL(url);
        Components.showToast('Database exported successfully', 'success');
    };
    
    // Export entire database to Excel (each table as a sheet)
    const exportDatabaseToExcel = async () => {
        try {
            const state = Store.getState();
            
            // Create workbook
            const wb = XLSX.utils.book_new();
            
            // Helper function to add a sheet
            const addSheet = (data, sheetName) => {
                if (data && data.length > 0) {
                    const ws = XLSX.utils.json_to_sheet(data);
                    XLSX.utils.book_append_sheet(wb, ws, sheetName);
                }
            };
            
            // Export all tables
            addSheet(state.clients || [], 'Clients');
            addSheet(state.markets || [], 'Markets');
            addSheet(state.slocs || [], 'SLOCs');
            addSheet(state.crews || [], 'Crews');
            addSheet(state.areas || [], 'Areas');
            addSheet(state.itemTypes || [], 'Item Types');
            addSheet(state.inventory || [], 'Inventory');
            addSheet(state.transactions || [], 'Transactions');
            addSheet(state.sequentials || [], 'Sequentials');
            addSheet(state.locations || [], 'Locations');
            addSheet(state.locationTypes || [], 'Location Types');
            addSheet(state.statuses || [], 'Statuses');
            addSheet(state.categories || [], 'Categories');
            addSheet(state.inventoryTypes || [], 'Inventory Types');
            addSheet(state.unitsOfMeasure || [], 'Units of Measure');
            addSheet(state.providers || [], 'Providers');
            addSheet(state.actionTypes || [], 'Action Types');
            addSheet(state.actionStatuses || [], 'Action Statuses');
            addSheet(state.itemTypeMarkets || [], 'Item Type Markets');
            addSheet(state.config || [], 'Config');
            
            // Generate filename
            const filename = `full_database_export_${getLocalDateString()}.xlsx`;
            
            // Save file
            XLSX.writeFile(wb, filename);
            
            Components.showToast('Database exported to Excel successfully', 'success');
            return Result.ok(true);
        } catch (error) {
            console.error('Export database to Excel error:', error);
            Components.showToast('Failed to export database', 'error');
            return Result.error(error.message);
        }
    };
    
    // Import from Excel
    const importFromExcel = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    resolve(Result.ok(jsonData));
                } catch (error) {
                    reject(Result.error(error));
                }
            };
            
            reader.onerror = () => reject(Result.error(new Error('File read error')));
            reader.readAsArrayBuffer(file);
        });
    };
    
    // Import from JSON
    const importFromJSON = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    resolve(Result.ok(json));
                } catch (error) {
                    reject(Result.error(error));
                }
            };
            
            reader.onerror = () => reject(Result.error(new Error('File read error')));
            reader.readAsText(file);
        });
    };
    
    // Export template
    const exportTemplate = (templateType = 'inventory') => {
        const templates = {
            inventory: [
                { 'Item Type ID': '', 'Quantity': '', 'Manufacturer SN': '', 'Notes': '' }
            ],
            item_types: [
                { 'Name': '', 'Inventory Type (1=Serialized, 2=Bulk)': '', 'Manufacturer': '', 
                  'Part Number': '', 'Unit of Measure ID': '', 'Units Per Package': '', 
                  'Description': '', 'Provider ID': '', 'Category ID': '', 'Market ID': '' }
            ],
            crews: [
                { 'Name': '', 'Market ID': '' }
            ]
        };
        
        const templateData = templates[templateType] || templates.inventory;
        
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(templateData);
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        
        const filename = `${templateType}_template.xlsx`;
        XLSX.writeFile(wb, filename);
        
        Components.showToast('Template downloaded', 'success');
    };
    
    // Backup database to file
    const backupDatabase = () => {
        const data = Database.exportDb();
        if (!data) {
            Components.showToast('No database to backup', 'error');
            return;
        }
        
        const blob = new Blob([data], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `inventory_backup_${getLocalDateString()}.db`;
        a.click();
        
        URL.revokeObjectURL(url);
        Components.showToast('Database backed up successfully', 'success');
    };
    
    // Restore database from file
    const restoreDatabase = (file) => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const result = Database.importDb(data);
                    
                    if (result.isOk) {
                        Components.showToast('Database restored successfully', 'success');
                        resolve(result);
                    } else {
                        reject(result);
                    }
                } catch (error) {
                    reject(Result.error(error));
                }
            };
            
            reader.onerror = () => reject(Result.error(new Error('File read error')));
            reader.readAsArrayBuffer(file);
        });
    };
    
    // Export filtered data to Excel with multiple sheets
    const exportFilteredDataToExcel = async (filters, filterNames) => {
        try {
            const state = Store.getState();
            
            // Filter inventory
            let filteredInventory = state.inventory;
            
            if (filters.clientId) {
                const clientSlocs = state.slocs.filter(s => {
                    const market = state.markets.find(m => m.id === s.market_id);
                    return market && market.client_id === filters.clientId;
                }).map(s => s.id);
                filteredInventory = filteredInventory.filter(i => clientSlocs.includes(i.sloc_id));
            }
            
            if (filters.marketId) {
                const marketSlocs = state.slocs.filter(s => s.market_id === filters.marketId).map(s => s.id);
                filteredInventory = filteredInventory.filter(i => marketSlocs.includes(i.sloc_id));
            }
            
            if (filters.slocId) {
                filteredInventory = filteredInventory.filter(i => i.sloc_id === filters.slocId);
            }
            
            if (filters.areaId) {
                filteredInventory = filteredInventory.filter(i => i.area_id === filters.areaId);
            }
            
            if (filters.crewId) {
                filteredInventory = filteredInventory.filter(i => i.assigned_crew_id === filters.crewId);
            }
            
            // Filter transactions with same logic
            let filteredTransactions = state.transactions;
            
            if (filters.clientId || filters.marketId || filters.slocId) {
                const slocNames = [];
                if (filters.slocId) {
                    const sloc = state.slocs.find(s => s.id === filters.slocId);
                    if (sloc) slocNames.push(sloc.name);
                } else if (filters.marketId) {
                    state.slocs.filter(s => s.market_id === filters.marketId).forEach(s => slocNames.push(s.name));
                } else if (filters.clientId) {
                    const clientMarkets = state.markets.filter(m => m.client_id === filters.clientId).map(m => m.id);
                    state.slocs.filter(s => clientMarkets.includes(s.market_id)).forEach(s => slocNames.push(s.name));
                }
                filteredTransactions = filteredTransactions.filter(tx => slocNames.includes(tx.sloc));
            }
            
            if (filters.areaId) {
                const areaName = state.areas.find(a => a.id === filters.areaId)?.name;
                if (areaName) {
                    filteredTransactions = filteredTransactions.filter(tx => tx.area_name === areaName);
                }
            }
            
            if (filters.crewId) {
                const crewName = state.crews.find(c => c.id === filters.crewId)?.name;
                if (crewName) {
                    filteredTransactions = filteredTransactions.filter(tx => tx.assigned_crew_name === crewName);
                }
            }
            
            // Create workbook using ExcelJS
            const workbook = new ExcelJS.Workbook();
            
            // Get user info
            let userName = 'Unknown';
            if (state.user) {
                userName = state.user.email || state.user.name || state.user.id || 'Unknown';
            }
            
            // CONTROL sheet
            const wsControl = workbook.addWorksheet('CONTROL');
            wsControl.columns = [
                { width: 25 },
                { width: 40 }
            ];
            
            wsControl.addRows([
                ['Export Information'],
                [''],
                ['Export Date/Time', new Date().toLocaleString()],
                ['User', userName],
                [''],
                ['Filter Settings'],
                ['Client', filterNames.client],
                ['Market', filterNames.market],
                ['SLOC', filterNames.sloc],
                ['Area', filterNames.area],
                ['Crew', filterNames.crew],
                [''],
                ['Export Summary'],
                ['Total Inventory Records', filteredInventory.length],
                ['Total Transaction Records', filteredTransactions.length],
                ['Total Item Types', state.itemTypes.length],
                [''],
                ['Sheet Descriptions'],
                ['CONTROL', 'Export metadata and filter information'],
                ['INVENTORY', 'Filtered inventory records based on selected criteria'],
                ['ITEM_TYPES', 'Complete list of all item types in the system'],
                ['TRANSACTIONS', 'Filtered transaction history matching inventory filters']
            ]);
            
            // INVENTORY sheet
            if (filteredInventory.length > 0) {
                const wsInventory = workbook.addWorksheet('INVENTORY');
                
                // Build inventory data rows
                const inventoryRows = filteredInventory.map(item => {
                    const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
                    const sloc = state.slocs.find(s => s.id === item.sloc_id);
                    const market = sloc ? state.markets.find(m => m.id === sloc.market_id) : null;
                    const client = market ? state.clients.find(c => c.id === market.client_id) : null;
                    const area = state.areas.find(a => a.id === item.area_id);
                    const crew = state.crews.find(c => c.id === item.assigned_crew_id);
                    const status = state.statuses.find(s => s.id === item.status_id);
                    const location = state.locations.find(l => l.id === item.location_id);
                    const locationType = location ? state.locationTypes.find(lt => lt.id === location.loc_type_id) : null;
                    const inventoryType = itemType ? state.inventoryTypes.find(it => it.id === itemType.inventory_type_id) : null;
                    const uom = itemType ? state.unitsOfMeasure.find(u => u.id === itemType.unit_of_measure_id) : null;
                    const provider = itemType ? state.providers.find(p => p.id === itemType.provider_id) : null;
                    const category = itemType ? state.categories.find(c => c.id === itemType.category_id) : null;
                    
                    return [
                        item.id,
                        client?.name || '',
                        market?.name || '',
                        sloc?.name || '',
                        item.sloc_id || '',
                        area?.name || '',
                        item.area_id || '',
                        crew?.name || '',
                        item.assigned_crew_id || '',
                        itemType?.name || '',
                        item.item_type_id,
                        inventoryType?.name || '',
                        itemType?.manufacturer || '',
                        itemType?.part_number || '',
                        itemType?.description || '',
                        uom?.name || '',
                        itemType?.units_per_package || '',
                        provider?.name || '',
                        category?.name || '',
                        item.mfgrsn || '',
                        item.tilsonsn || '',
                        item.quantity || 1,
                        status?.name || '',
                        item.status_id,
                        location?.name || '',
                        item.location_id,
                        locationType?.name || '',
                        new Date(item.created_at).toLocaleString(),
                        new Date(item.updated_at).toLocaleString()
                    ];
                });
                
                // Add table with data
                wsInventory.addTable({
                    name: 'InventoryTable',
                    ref: `A1:AC${inventoryRows.length + 1}`,
                    headerRow: true,
                    totalsRow: false,
                    style: {
                        theme: 'TableStyleMedium9',
                        showRowStripes: true
                    },
                    columns: [
                        { name: 'ID', filterButton: true },
                        { name: 'Client', filterButton: true },
                        { name: 'Market', filterButton: true },
                        { name: 'SLOC', filterButton: true },
                        { name: 'SLOC ID', filterButton: true },
                        { name: 'Area', filterButton: true },
                        { name: 'Area ID', filterButton: true },
                        { name: 'Crew', filterButton: true },
                        { name: 'Crew ID', filterButton: true },
                        { name: 'Item Type', filterButton: true },
                        { name: 'Item Type ID', filterButton: true },
                        { name: 'Inventory Type', filterButton: true },
                        { name: 'Manufacturer', filterButton: true },
                        { name: 'Part Number', filterButton: true },
                        { name: 'Description', filterButton: true },
                        { name: 'Unit of Measure', filterButton: true },
                        { name: 'Units Per Package', filterButton: true },
                        { name: 'Provider', filterButton: true },
                        { name: 'Category', filterButton: true },
                        { name: 'Manufacturer SN', filterButton: true },
                        { name: 'Tilson SN', filterButton: true },
                        { name: 'Quantity', filterButton: true },
                        { name: 'Status', filterButton: true },
                        { name: 'Status ID', filterButton: true },
                        { name: 'Location', filterButton: true },
                        { name: 'Location ID', filterButton: true },
                        { name: 'Location Type', filterButton: true },
                        { name: 'Created At', filterButton: true },
                        { name: 'Updated At', filterButton: true }
                    ],
                    rows: inventoryRows
                });
                
                // Set column widths
                wsInventory.getColumn(1).width = 8;   // ID
                wsInventory.getColumn(2).width = 15;  // Client
                wsInventory.getColumn(3).width = 15;  // Market
                wsInventory.getColumn(4).width = 15;  // SLOC
                wsInventory.getColumn(10).width = 25; // Item Type
                wsInventory.getColumn(13).width = 20; // Manufacturer
                wsInventory.getColumn(14).width = 20; // Part Number
                wsInventory.getColumn(15).width = 30; // Description
            } else {
                const wsInventory = workbook.addWorksheet('INVENTORY');
                wsInventory.addRow(['No inventory records match the selected filters']);
            }
            
            // ITEM_TYPES sheet
            const wsItemTypes = workbook.addWorksheet('ITEM_TYPES');
            
            // Build item types data rows
            const itemTypesRows = state.itemTypes.map(it => {
                const market = state.markets.find(m => m.id === it.market_id);
                const client = market ? state.clients.find(c => c.id === market.client_id) : null;
                const inventoryType = state.inventoryTypes.find(invt => invt.id === it.inventory_type_id);
                const uom = state.unitsOfMeasure.find(u => u.id === it.unit_of_measure_id);
                const provider = state.providers.find(p => p.id === it.provider_id);
                const category = state.categories.find(c => c.id === it.category_id);
                
                return [
                    it.id,
                    it.name,
                    inventoryType?.name || '',
                    it.inventory_type_id,
                    it.manufacturer || '',
                    it.part_number || '',
                    it.description || '',
                    uom?.name || '',
                    it.unit_of_measure_id,
                    it.units_per_package || '',
                    provider?.name || '',
                    it.provider_id,
                    category?.name || '',
                    it.category_id || '',
                    it.low_units_quantity || '',
                    it.image_path || '',
                    it.meta || '',
                    market?.name || '',
                    it.market_id,
                    client?.name || '',
                    new Date(it.created_at).toLocaleString(),
                    new Date(it.updated_at).toLocaleString()
                ];
            });
            
            // Add table with data
            wsItemTypes.addTable({
                name: 'ItemTypesTable',
                ref: `A1:V${itemTypesRows.length + 1}`,
                headerRow: true,
                totalsRow: false,
                style: {
                    theme: 'TableStyleMedium9',
                    showRowStripes: true
                },
                columns: [
                    { name: 'ID', filterButton: true },
                    { name: 'Name', filterButton: true },
                    { name: 'Inventory Type', filterButton: true },
                    { name: 'Inventory Type ID', filterButton: true },
                    { name: 'Manufacturer', filterButton: true },
                    { name: 'Part Number', filterButton: true },
                    { name: 'Description', filterButton: true },
                    { name: 'Unit of Measure', filterButton: true },
                    { name: 'Unit of Measure ID', filterButton: true },
                    { name: 'Units Per Package', filterButton: true },
                    { name: 'Provider', filterButton: true },
                    { name: 'Provider ID', filterButton: true },
                    { name: 'Category', filterButton: true },
                    { name: 'Category ID', filterButton: true },
                    { name: 'Low Units Quantity', filterButton: true },
                    { name: 'Image Path', filterButton: true },
                    { name: 'Meta', filterButton: true },
                    { name: 'Market', filterButton: true },
                    { name: 'Market ID', filterButton: true },
                    { name: 'Client', filterButton: true },
                    { name: 'Created At', filterButton: true },
                    { name: 'Updated At', filterButton: true }
                ],
                rows: itemTypesRows
            });
            
            // Set column widths
            wsItemTypes.getColumn(1).width = 8;   // ID
            wsItemTypes.getColumn(2).width = 25;  // Name
            wsItemTypes.getColumn(5).width = 20;  // Manufacturer
            wsItemTypes.getColumn(6).width = 20;  // Part Number
            wsItemTypes.getColumn(7).width = 30;  // Description
            
            // TRANSACTIONS sheet
            if (filteredTransactions.length > 0) {
                const wsTransactions = workbook.addWorksheet('TRANSACTIONS');
                
                // Build transactions data rows
                const transactionsRows = filteredTransactions.map(tx => {
                    // Parse user_name JSON if it's a JSON string
                    let userDisplay = tx.user_name || 'Unknown';
                    try {
                        const userInfo = JSON.parse(tx.user_name);
                        userDisplay = userInfo.email || userInfo.name || 'Unknown';
                    } catch {
                        // Not JSON, use as-is
                        userDisplay = tx.user_name || 'Unknown';
                    }
                    
                    return [
                        tx.id,
                        new Date(tx.date_time).toLocaleString(),
                        tx.transaction_type,
                        tx.action,
                        tx.client || '',
                        tx.market || '',
                        tx.sloc || '',
                        tx.area_name || '',
                        tx.assigned_crew_name || '',
                        tx.item_type_name || '',
                        tx.inventory_type_name || '',
                        tx.manufacturer || '',
                        tx.part_number || '',
                        tx.description || '',
                        tx.unit_of_measure || '',
                        tx.units_per_package || '',
                        tx.provider_name || '',
                        tx.category_name || '',
                        tx.mfgrsn || '',
                        tx.tilsonsn || '',
                        tx.quantity || '',
                        tx.old_quantity || '',
                        tx.from_location_name || '',
                        tx.from_location_type || '',
                        tx.to_location_name || '',
                        tx.to_location_type || '',
                        tx.old_status_name || '',
                        tx.status_name || '',
                        userDisplay,
                        tx.user_name || '',
                        tx.session_id || '',
                        tx.notes || '',
                        tx.ip_address || '',
                        tx.user_agent || '',
                        tx.before_state || '',
                        tx.after_state || '',
                        tx.inventory_id || ''
                    ];
                });
                
                // Add table with data
                wsTransactions.addTable({
                    name: 'TransactionsTable',
                    ref: `A1:AK${transactionsRows.length + 1}`,
                    headerRow: true,
                    totalsRow: false,
                    style: {
                        theme: 'TableStyleMedium9',
                        showRowStripes: true
                    },
                    columns: [
                        { name: 'ID', filterButton: true },
                        { name: 'Date/Time', filterButton: true },
                        { name: 'Transaction Type', filterButton: true },
                        { name: 'Action', filterButton: true },
                        { name: 'Client', filterButton: true },
                        { name: 'Market', filterButton: true },
                        { name: 'SLOC', filterButton: true },
                        { name: 'Area', filterButton: true },
                        { name: 'Crew', filterButton: true },
                        { name: 'Item Type', filterButton: true },
                        { name: 'Inventory Type', filterButton: true },
                        { name: 'Manufacturer', filterButton: true },
                        { name: 'Part Number', filterButton: true },
                        { name: 'Description', filterButton: true },
                        { name: 'Unit of Measure', filterButton: true },
                        { name: 'Units Per Package', filterButton: true },
                        { name: 'Provider', filterButton: true },
                        { name: 'Category', filterButton: true },
                        { name: 'Manufacturer SN', filterButton: true },
                        { name: 'Tilson SN', filterButton: true },
                        { name: 'Quantity', filterButton: true },
                        { name: 'Old Quantity', filterButton: true },
                        { name: 'From Location', filterButton: true },
                        { name: 'From Location Type', filterButton: true },
                        { name: 'To Location', filterButton: true },
                        { name: 'To Location Type', filterButton: true },
                        { name: 'Old Status', filterButton: true },
                        { name: 'Status', filterButton: true },
                        { name: 'User', filterButton: true },
                        { name: 'User JSON', filterButton: true },
                        { name: 'Session ID', filterButton: true },
                        { name: 'Notes', filterButton: true },
                        { name: 'IP Address', filterButton: true },
                        { name: 'User Agent', filterButton: true },
                        { name: 'Before State', filterButton: true },
                        { name: 'After State', filterButton: true },
                        { name: 'Inventory ID', filterButton: true }
                    ],
                    rows: transactionsRows
                });
                
                // Set column widths
                wsTransactions.getColumn(1).width = 8;   // ID
                wsTransactions.getColumn(2).width = 20;  // Date/Time
                wsTransactions.getColumn(10).width = 25; // Item Type
                wsTransactions.getColumn(32).width = 40; // Notes
            } else {
                const wsTransactions = workbook.addWorksheet('TRANSACTIONS');
                wsTransactions.addRow(['No transaction records match the selected filters']);
            }
            
            // Generate filename
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
            const filterSuffix = filters.slocId ? `_${filterNames.sloc}` : 
                                 filters.marketId ? `_${filterNames.market}` :
                                 filters.clientId ? `_${filterNames.client}` : '';
            const filename = `inventory_export${filterSuffix}_${timestamp}.xlsx`;
            
            // Write file
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            a.click();
            window.URL.revokeObjectURL(url);
            
            Components.showToast(`Exported ${filteredInventory.length} inventory records and ${filteredTransactions.length} transactions`, 'success');
        } catch (error) {
            console.error('Export error:', error);
            Components.showToast('Export failed: ' + error.message, 'error');
            throw error;
        }
    };
    
    // Generate Item Types Import Template using ExcelJS
    const generateItemTypesTemplate = async () => {
        try {
            const state = Store.getState();
            
            // Create workbook using ExcelJS
            const workbook = new ExcelJS.Workbook();
            workbook.creator = state.user?.email || 'Inventory System';
            workbook.created = new Date();
            
            // Get unique values for dropdowns
            const categories = [...new Set(state.categories.map(c => c.name))].sort();
            const uoms = [...new Set((state.unitsOfMeasure || []).map(u => u.name))].sort();
            const providers = [...new Set((state.providers || []).map(p => p.name))].sort();
            const inventoryTypes = [...new Set((state.inventoryTypes || []).map(it => it.name))].sort();
            const markets = [...new Set(state.markets.map(m => m.name))].sort();
            const clients = [...new Set(state.clients.map(c => c.name))].sort();
            
            // ====================
            // CONTROL SHEET
            // ====================
            const controlSheet = workbook.addWorksheet('CONTROL', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Set column widths
            controlSheet.columns = [
                { width: 25 },
                { width: 12 },
                { width: 50 },
                { width: 40 }
            ];
            
            // Add control data
            const controlData = [
                ['ITEM TYPES IMPORT TEMPLATE'],
                ['Generated:', new Date().toLocaleString()],
                ['User:', state.user?.email || 'Unknown'],
                [''],
                ['INSTRUCTIONS:'],
                ['This template has four sheets:'],
                [''],
                ['1. CONTROL (this sheet)'],
                ['   - Instructions and field explanations'],
                [''],
                ['2. EXISTING_ITEM_TYPES'],
                ['   - Lists all existing item types with their markets'],
                ['   - Check the checkbox in the first column to apply an existing item type to a different market'],
                ['   - Enter the new Market Name in the "New Market Name" column'],
                ['   - This creates a copy of the item type for the new market'],
                [''],
                ['3. NEW_ITEM_TYPES'],
                ['   - Add new item types here (formatted as Excel Table with dropdowns)'],
                ['   - Red headers indicate REQUIRED fields'],
                ['   - Use dropdowns for lookup values (Category, UOM, Provider, Inventory Type, Market, Client)'],
                [''],
                ['4. LOOKUP_VALUES'],
                ['   - Reference sheet with all valid dropdown values'],
                [''],
                ['FIELD EXPLANATIONS FOR NEW ITEM TYPES:'],
                [''],
                ['Field Name', 'Required?', 'Description', 'Notes'],
                ['Name', 'YES', 'Item type name', 'Must be unique within the market'],
                ['Manufacturer', 'NO', 'Item manufacturer', 'Select from dropdown'],
                ['Part Number', 'NO', 'Manufacturer part number', ''],
                ['Description', 'NO', 'Detailed description of the item', ''],
                ['Units per Package', 'YES', 'Number of units in standard package', 'Required - enter 1 if sold individually'],
                ['Low Units Quantity', 'NO', 'Minimum quantity threshold for alerts', 'Leave blank if not applicable'],
                ['Inventory Type', 'YES', 'Serialized or Bulk', 'Select from dropdown - determines tracking method'],
                ['Unit of Measure', 'YES', 'How the item is measured', 'Select from dropdown (e.g., Each, Foot, Roll)'],
                ['Provider', 'YES', 'Item provider/supplier', 'Select from dropdown'],
                ['Category', 'YES', 'Item category', 'Select from dropdown (e.g., Cable, Hardware, Equipment)'],
                [''],
                ['IMPORTANT NOTES:'],
                ['• Do not modify the CONTROL sheet or column headers'],
                ['• Required fields must be filled in for each new item type'],
                ['• Dropdown values come from your current database'],
                ['• Invalid values will cause import errors'],
                ['• Duplicate names within the same market will be rejected']
            ];
            
            controlData.forEach((row, idx) => {
                controlSheet.addRow(row);
                if (idx === 0) {
                    // Title row - bold and larger
                    controlSheet.getRow(idx + 1).font = { bold: true, size: 14 };
                } else if (row[0] && row[0].includes(':') && row[0].length < 30) {
                    // Section headers
                    controlSheet.getRow(idx + 1).font = { bold: true };
                }
            });
            
            // ====================
            // EXISTING ITEM TYPES SHEET
            // ====================
            const existingSheet = workbook.addWorksheet('EXISTING_ITEM_TYPES', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Build data rows array
            const existingRows = state.itemTypes.map(itemType => {
                const market = state.markets.find(m => m.id === itemType.market_id);
                const client = state.clients.find(c => c.id === market?.client_id);
                const category = state.categories.find(c => c.id === itemType.category_id);
                const uom = state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id);
                const provider = state.providers?.find(p => p.id === itemType.inventory_provider_id);
                const invType = state.inventoryTypes?.find(it => it.id === itemType.inventory_type_id);
                
                return [
                    itemType.id,
                    itemType.name,
                    provider?.name || '',
                    itemType.part_number || '',
                    itemType.description || '',
                    itemType.units_per_package || '',
                    itemType.low_units_qty || '',
                    invType?.name || '',
                    uom?.name || '',
                    category?.name || '',
                    market?.name || '',
                    client?.name || ''
                ];
            });
            
            // Ensure at least one data row
            if (existingRows.length === 0) {
                existingRows.push(['', '', '', '', '', '', '', '', '', '', '', '']);
            }
            
            // Add table with data
            existingSheet.addTable({
                name: 'ExistingItemTypes',
                ref: `A1:L${existingRows.length + 1}`,
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true
                },
                columns: [
                    { name: 'Item Type ID' },
                    { name: 'Name' },
                    { name: 'Manufacturer' },
                    { name: 'Part Number' },
                    { name: 'Description' },
                    { name: 'Units per Package' },
                    { name: 'Low Units Quantity' },
                    { name: 'Inventory Type' },
                    { name: 'Unit of Measure' },
                    { name: 'Category' },
                    { name: 'Current Market' },
                    { name: 'Current Client' }
                ],
                rows: existingRows
            });
            
            // Style header row
            existingSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            existingSheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
            
            // Set column widths
            existingSheet.getColumn(1).width = 12;  // Item Type ID
            existingSheet.getColumn(2).width = 30;  // Name
            existingSheet.getColumn(3).width = 20;  // Manufacturer
            existingSheet.getColumn(4).width = 20;  // Part Number
            existingSheet.getColumn(5).width = 40;  // Description
            existingSheet.getColumn(6).width = 18;  // Units per Package
            existingSheet.getColumn(7).width = 18;  // Low Units Quantity
            existingSheet.getColumn(8).width = 18;  // Inventory Type
            existingSheet.getColumn(9).width = 18;  // Unit of Measure
            existingSheet.getColumn(10).width = 20; // Category
            existingSheet.getColumn(11).width = 25; // Current Market
            existingSheet.getColumn(12).width = 25; // Current Client
            
            // ====================
            // NEW ITEM TYPES SHEET
            // ====================
            const newItemsSheet = workbook.addWorksheet('NEW_ITEM_TYPES', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Create 20 empty rows
            const newItemRows = [];
            for (let i = 0; i < 20; i++) {
                newItemRows.push(['', '', '', '', '', '', '', '', '', '']);
            }
            
            // Add table with data
            newItemsSheet.addTable({
                name: 'NewItemTypes',
                ref: 'A1:J21',
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium9',
                    showRowStripes: true
                },
                columns: [
                    { name: 'Name' },
                    { name: 'Manufacturer' },
                    { name: 'Part Number' },
                    { name: 'Description' },
                    { name: 'Units per Package' },
                    { name: 'Low Units Quantity' },
                    { name: 'Inventory Type' },
                    { name: 'Unit of Measure' },
                    { name: 'Provider' },
                    { name: 'Category' }
                ],
                rows: newItemRows
            });
            
            // Style headers - red for required, blue for optional
            const requiredCols = [1, 5, 7, 8, 9, 10]; // Name, Units per Package, Inventory Type, UOM, Provider, Category
            const optionalCols = [2, 3, 4, 6]; // Manufacturer, Part Number, Description, Low Units Quantity
            
            requiredCols.forEach(col => {
                newItemsSheet.getCell(1, col).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFFF0000' }
                };
                newItemsSheet.getCell(1, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            });
            
            optionalCols.forEach(col => {
                newItemsSheet.getCell(1, col).fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF4472C4' }
                };
                newItemsSheet.getCell(1, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            });
            
            // Set column widths
            newItemsSheet.getColumn(1).width = 30;  // Name
            newItemsSheet.getColumn(2).width = 20;  // Manufacturer
            newItemsSheet.getColumn(3).width = 20;  // Part Number
            newItemsSheet.getColumn(4).width = 40;  // Description
            newItemsSheet.getColumn(5).width = 18;  // Units per Package
            newItemsSheet.getColumn(6).width = 18;  // Low Units Quantity
            newItemsSheet.getColumn(7).width = 18;  // Inventory Type
            newItemsSheet.getColumn(8).width = 18;  // Unit of Measure
            newItemsSheet.getColumn(9).width = 20;  // Provider
            newItemsSheet.getColumn(10).width = 20; // Category
            
            // Add data validation
            for (let i = 2; i <= 21; i++) {
                // Manufacturer (column B)
                newItemsSheet.getCell(`B${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${providers.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Manufacturer',
                    error: 'Please select a valid manufacturer from the list'
                };
                
                // Inventory Type (column G)
                newItemsSheet.getCell(`G${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${inventoryTypes.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Inventory Type',
                    error: 'Please select a valid inventory type from the list'
                };
                
                // Unit of Measure (column H)
                newItemsSheet.getCell(`H${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${uoms.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Unit of Measure',
                    error: 'Please select a valid unit of measure from the list'
                };
                
                // Provider (column I - duplicate of Manufacturer for backwards compatibility)
                newItemsSheet.getCell(`I${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${providers.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Provider',
                    error: 'Please select a valid provider from the list'
                };
                
                // Category (column J)
                newItemsSheet.getCell(`J${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: false,
                    formulae: [`"${categories.join(',')}"`],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Category',
                    error: 'Please select a valid category from the list'
                };
            }
            
            // ====================
            // LOOKUP VALUES SHEET
            // ====================
            const lookupSheet = workbook.addWorksheet('LOOKUP_VALUES');
            
            // Build lookup rows
            const maxLen = Math.max(
                categories.length,
                uoms.length,
                providers.length,
                inventoryTypes.length,
                markets.length,
                clients.length,
                1
            );
            
            const lookupRows = [];
            for (let i = 0; i < maxLen; i++) {
                lookupRows.push([
                    categories[i] || '',
                    uoms[i] || '',
                    providers[i] || '',
                    inventoryTypes[i] || '',
                    markets[i] || '',
                    clients[i] || '',
                    i < 2 ? ['TRUE', 'FALSE'][i] : ''
                ]);
            }
            
            // Add table with data
            lookupSheet.addTable({
                name: 'LookupValues',
                ref: `A1:G${lookupRows.length + 1}`,
                headerRow: true,
                style: {
                    theme: 'TableStyleLight1',
                    showRowStripes: true
                },
                columns: [
                    { name: 'Categories' },
                    { name: 'Units of Measure' },
                    { name: 'Providers' },
                    { name: 'Inventory Types' },
                    { name: 'Markets' },
                    { name: 'Clients' },
                    { name: 'Allow PDF Options' }
                ],
                rows: lookupRows
            });
            
            // Set column widths
            lookupSheet.getColumn(1).width = 20;
            lookupSheet.getColumn(2).width = 20;
            lookupSheet.getColumn(3).width = 20;
            lookupSheet.getColumn(4).width = 20;
            lookupSheet.getColumn(5).width = 25;
            lookupSheet.getColumn(6).width = 25;
            lookupSheet.getColumn(7).width = 12;
            
            // ====================
            // GENERATE AND DOWNLOAD
            // ====================
            const filename = `item_types_import_template_${new Date().toISOString().split('T')[0]}.xlsx`;
            
            // Generate buffer and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
            
            Components.showToast('Item Types template downloaded successfully', 'success');
        } catch (error) {
            console.error('Template generation error:', error);
            Components.showToast('Failed to generate template: ' + error.message, 'error');
        }
    };
    
    // Generate Inventory Update Template with CONTROL, Serialized, and Bulk sheets
    const generateInventoryUpdateTemplate = async () => {
        try {
            const state = Store.getState();
            const selectedSloc = state.selectedSloc;
            
            if (!selectedSloc) {
                Components.showToast('Please select a SLOC first', 'warning');
                return;
            }
            
            // Create workbook using ExcelJS
            const workbook = new ExcelJS.Workbook();
            workbook.creator = state.user?.email || 'Inventory System';
            workbook.created = new Date();
            
            // Filter inventory to selected SLOC
            const slocInventory = state.inventory.filter(inv => inv.sloc_id === selectedSloc.id);
            
            // Separate serialized and bulk inventory
            const serializedInventory = slocInventory.filter(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                return itemType && itemType.inventory_type_id === 1; // Serialized
            });
            
            const bulkInventory = slocInventory.filter(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                return itemType && itemType.inventory_type_id === 2; // Bulk
            });
            
            // Calculate summary statistics
            const totalSerializedItems = serializedInventory.length;
            const totalBulkItems = bulkInventory.length;
            const totalBulkQuantity = bulkInventory.reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            // Get status counts
            const availableStatus = state.statuses?.find(s => s.name === 'Available');
            const issuedStatus = state.statuses?.find(s => s.name === 'Issued');
            const installedStatus = state.statuses?.find(s => s.name === 'Installed');
            const rejectedStatus = state.statuses?.find(s => s.name === 'Rejected');
            
            const serializedAvailable = serializedInventory.filter(inv => inv.status_id === availableStatus?.id).length;
            const serializedIssued = serializedInventory.filter(inv => inv.status_id === issuedStatus?.id).length;
            const serializedInstalled = serializedInventory.filter(inv => inv.status_id === installedStatus?.id).length;
            const serializedRejected = serializedInventory.filter(inv => inv.status_id === rejectedStatus?.id).length;
            
            const bulkAvailable = bulkInventory.filter(inv => inv.status_id === availableStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            const bulkIssued = bulkInventory.filter(inv => inv.status_id === issuedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            const bulkInstalled = bulkInventory.filter(inv => inv.status_id === installedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            const bulkRejected = bulkInventory.filter(inv => inv.status_id === rejectedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0);
            
            // ====================
            // CONTROL SHEET
            // ====================
            const controlSheet = workbook.addWorksheet('CONTROL', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            controlSheet.columns = [
                { width: 30 },
                { width: 20 },
                { width: 50 }
            ];
            
            // Add control data
            const controlRows = [
                ['INVENTORY UPDATE TEMPLATE'],
                [''],
                ['Generated:', new Date().toLocaleString()],
                ['User:', state.user?.email || 'Unknown'],
                ['SLOC:', selectedSloc.name],
                ['Market:', state.markets.find(m => m.id === selectedSloc.market_id)?.name || 'Unknown'],
                ['Client:', state.clients.find(c => {
                    const market = state.markets.find(m => m.id === selectedSloc.market_id);
                    return market && c.id === market.client_id;
                })?.name || 'Unknown'],
                [''],
                ['INVENTORY SUMMARY FOR THIS SLOC:'],
                [''],
                ['Serialized Items:'],
                ['  Total Items', totalSerializedItems],
                ['  Available', serializedAvailable],
                ['  Issued', serializedIssued],
                ['  Installed', serializedInstalled],
                ['  Rejected', serializedRejected],
                [''],
                ['Bulk Items:'],
                ['  Total Items', totalBulkItems],
                ['  Total Quantity', totalBulkQuantity],
                ['  Available', bulkAvailable],
                ['  Issued', bulkIssued],
                ['  Installed', bulkInstalled],
                ['  Rejected', bulkRejected],
                [''],
                ['INSTRUCTIONS:'],
                [''],
                ['This template has four sheets:'],
                [''],
                ['1. CONTROL (this sheet)'],
                ['   - Summary statistics and instructions'],
                ['   - Read-only reference information'],
                [''],
                ['2. SERIALIZED_INVENTORY'],
                ['   - One row per serialized item (with serial numbers)'],
                ['   - ONLY EDIT THE QUANTITY COLUMN (highlighted in yellow)'],
                ['   - Quantity for serialized items is typically 1'],
                ['   - Use this sheet to update quantities for serialized items'],
                [''],
                ['3. BULK_INVENTORY'],
                ['   - One row per bulk inventory record'],
                ['   - ONLY EDIT THE QUANTITY COLUMN (highlighted in yellow)'],
                ['   - Update quantities as needed for bulk materials'],
                [''],
                ['4. NEW_INVENTORY'],
                ['   - Add new inventory items (not quantity adjustments)'],
                ['   - Required columns: Name, Location, Quantity, Status'],
                ['   - Optional columns: mfgrSN, tilsonSN (for serialized items)'],
                ['   - Name must match an existing Item Type'],
                ['   - Location and Status must match existing records'],
                [''],
                ['IMPORTANT NOTES:'],
                [''],
                ['• Each row includes an ID field - DO NOT MODIFY THIS'],
                ['• Only the Quantity column (highlighted yellow) should be edited'],
                ['• All other columns are for reference only'],
                ['• After editing, save and import this file back into the system'],
                ['• Changes will update the corresponding inventory records by ID'],
                [''],
                ['FILTERED DATA:'],
                ['• This template only includes inventory for the selected SLOC'],
                ['• Serialized items shown: items currently in Manage Serialized Items view'],
                ['• Bulk items shown: items currently in Manage Bulk Items view']
            ];
            
            controlRows.forEach((row, idx) => {
                const excelRow = controlSheet.getRow(idx + 1);
                excelRow.values = row;
                
                // Bold headers
                if (idx === 0 || row[0]?.includes(':') || row[0]?.includes('SUMMARY') || 
                    row[0]?.includes('INSTRUCTIONS') || row[0]?.includes('NOTES') || row[0]?.includes('FILTERED')) {
                    excelRow.font = { bold: true };
                }
            });
            
            // ====================
            // SERIALIZED INVENTORY SHEET
            // ====================
            const serializedSheet = workbook.addWorksheet('SERIALIZED_INVENTORY', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Build serialized data rows
            const serializedRows = serializedInventory.map(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                const status = state.statuses.find(s => s.id === inv.status_id);
                const location = state.locations.find(l => l.id === inv.location_id);
                const locationType = location ? state.locationTypes?.find(lt => lt.id === location.location_type_id) : null;
                const crew = inv.assigned_crew_id ? state.crews.find(c => c.id === inv.assigned_crew_id) : null;
                const area = inv.area_id ? state.areas?.find(a => a.id === inv.area_id) : null;
                const category = itemType?.category_id ? state.categories.find(c => c.id === itemType.category_id) : null;
                
                return [
                    inv.id,
                    itemType?.name || '',
                    category?.name || '',
                    inv.mfgrsn || '',
                    inv.tilsonsn || '',
                    inv.quantity || 1,
                    status?.name || '',
                    location?.name || '',
                    locationType?.name || '',
                    crew?.name || '',
                    area?.name || ''
                ];
            });
            
            // Ensure at least one data row
            if (serializedRows.length === 0) {
                serializedRows.push(['', '', '', '', '', '', '', '', '', '', '']);
            }
            
            // Add table
            serializedSheet.addTable({
                name: 'SerializedInventory',
                ref: `A1:K${serializedRows.length + 1}`,
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true
                },
                columns: [
                    { name: 'ID' },
                    { name: 'Item Type' },
                    { name: 'Category' },
                    { name: 'Manufacturer SN' },
                    { name: 'Tilson SN' },
                    { name: 'Quantity' },
                    { name: 'Status' },
                    { name: 'Location' },
                    { name: 'Location Type' },
                    { name: 'Crew' },
                    { name: 'Area' }
                ],
                rows: serializedRows
            });
            
            // Set column widths
            serializedSheet.getColumn(1).width = 10;  // ID
            serializedSheet.getColumn(2).width = 30;  // Item Type
            serializedSheet.getColumn(3).width = 15;  // Category
            serializedSheet.getColumn(4).width = 20;  // Manufacturer SN
            serializedSheet.getColumn(5).width = 20;  // Tilson SN
            serializedSheet.getColumn(6).width = 12;  // Quantity
            serializedSheet.getColumn(7).width = 15;  // Status
            serializedSheet.getColumn(8).width = 20;  // Location
            serializedSheet.getColumn(9).width = 15;  // Location Type
            serializedSheet.getColumn(10).width = 20; // Crew
            serializedSheet.getColumn(11).width = 20; // Area
            
            // Highlight Quantity column (column F/6) with yellow background
            serializedSheet.getColumn(6).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFF00' } // Yellow
                    };
                }
            });
            
            // Make header row bold and colored
            const serializedHeaderRow = serializedSheet.getRow(1);
            serializedHeaderRow.font = { bold: true };
            serializedHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' } // Blue
            };
            serializedHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            
            // ====================
            // BULK INVENTORY SHEET
            // ====================
            const bulkSheet = workbook.addWorksheet('BULK_INVENTORY', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Build bulk data rows
            const bulkRows = bulkInventory.map(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                const status = state.statuses.find(s => s.id === inv.status_id);
                const location = state.locations.find(l => l.id === inv.location_id);
                const locationType = location ? state.locationTypes?.find(lt => lt.id === location.location_type_id) : null;
                const crew = inv.assigned_crew_id ? state.crews.find(c => c.id === inv.assigned_crew_id) : null;
                const area = inv.area_id ? state.areas?.find(a => a.id === inv.area_id) : null;
                const category = itemType?.category_id ? state.categories.find(c => c.id === itemType.category_id) : null;
                const uom = itemType?.unit_of_measure_id ? state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id) : null;
                
                return [
                    inv.id,
                    itemType?.name || '',
                    category?.name || '',
                    itemType?.part_number || '',
                    inv.quantity || 0,
                    uom?.name || '',
                    status?.name || '',
                    location?.name || '',
                    locationType?.name || '',
                    crew?.name || '',
                    area?.name || ''
                ];
            });
            
            // Ensure at least one data row
            if (bulkRows.length === 0) {
                bulkRows.push(['', '', '', '', '', '', '', '', '', '', '']);
            }
            
            // Add table
            bulkSheet.addTable({
                name: 'BulkInventory',
                ref: `A1:K${bulkRows.length + 1}`,
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true
                },
                columns: [
                    { name: 'ID' },
                    { name: 'Item Type' },
                    { name: 'Category' },
                    { name: 'Part Number' },
                    { name: 'Quantity' },
                    { name: 'Unit of Measure' },
                    { name: 'Status' },
                    { name: 'Location' },
                    { name: 'Location Type' },
                    { name: 'Crew' },
                    { name: 'Area' }
                ],
                rows: bulkRows
            });
            
            // Set column widths
            bulkSheet.getColumn(1).width = 10;  // ID
            bulkSheet.getColumn(2).width = 30;  // Item Type
            bulkSheet.getColumn(3).width = 15;  // Category
            bulkSheet.getColumn(4).width = 20;  // Part Number
            bulkSheet.getColumn(5).width = 12;  // Quantity
            bulkSheet.getColumn(6).width = 15;  // Unit of Measure
            bulkSheet.getColumn(7).width = 15;  // Status
            bulkSheet.getColumn(8).width = 20;  // Location
            bulkSheet.getColumn(9).width = 15;  // Location Type
            bulkSheet.getColumn(10).width = 20; // Crew
            bulkSheet.getColumn(11).width = 20; // Area
            
            // Highlight Quantity column (column E/5) with yellow background
            bulkSheet.getColumn(5).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 1) { // Skip header
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'FFFFFF00' } // Yellow
                    };
                }
            });
            
            // Make header row bold and colored
            const bulkHeaderRow = bulkSheet.getRow(1);
            bulkHeaderRow.font = { bold: true };
            bulkHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' } // Blue
            };
            bulkHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            
            // ====================
            // NEW INVENTORY SHEET
            // ====================
            const newInventorySheet = workbook.addWorksheet('NEW_INVENTORY', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
            });
            
            // Build empty row for template
            const newInventoryRows = [
                ['', '', '', '', '', '', '', ''] // Empty template row
            ];
            
            // Add table
            newInventorySheet.addTable({
                name: 'NewInventory',
                ref: `A1:H${newInventoryRows.length + 1}`,
                headerRow: true,
                style: {
                    theme: 'TableStyleMedium2',
                    showRowStripes: true
                },
                columns: [
                    { name: 'Name' },
                    { name: 'Location' },
                    { name: 'Area' },
                    { name: 'Crew' },
                    { name: 'mfgrSN' },
                    { name: 'tilsonSN' },
                    { name: 'Quantity' },
                    { name: 'Status' }
                ],
                rows: newInventoryRows
            });
            
            // Set column widths
            newInventorySheet.getColumn(1).width = 30;  // Name
            newInventorySheet.getColumn(2).width = 25;  // Location
            newInventorySheet.getColumn(3).width = 20;  // Area
            newInventorySheet.getColumn(4).width = 20;  // Crew
            newInventorySheet.getColumn(5).width = 20;  // mfgrSN
            newInventorySheet.getColumn(6).width = 20;  // tilsonSN
            newInventorySheet.getColumn(7).width = 12;  // Quantity
            newInventorySheet.getColumn(8).width = 15;  // Status
            
            // Highlight required columns (Name, Location, Quantity, Status) with light red
            [1, 2, 7, 8].forEach(colNum => {
                newInventorySheet.getColumn(colNum).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                    if (rowNumber > 1) { // Skip header
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFFEEEE' } // Light red for required
                        };
                    }
                });
            });
            
            // Highlight optional columns (Area, Crew, mfgrSN, tilsonSN) with light blue
            [3, 4, 5, 6].forEach(colNum => {
                newInventorySheet.getColumn(colNum).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                    if (rowNumber > 1) { // Skip header
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFEEEEFF' } // Light blue for optional
                        };
                    }
                });
            });
            
            // Make header row bold and colored
            const newInventoryHeaderRow = newInventorySheet.getRow(1);
            newInventoryHeaderRow.font = { bold: true };
            newInventoryHeaderRow.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' } // Blue
            };
            newInventoryHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            
            // ====================
            // GENERATE AND DOWNLOAD
            // ====================
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_update_template_${selectedSloc.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.xlsx`;
            
            // Generate buffer and download
            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.click();
            window.URL.revokeObjectURL(url);
            
            Components.showToast(`Inventory update template downloaded (${totalSerializedItems} serialized, ${totalBulkItems} bulk items)`, 'success');
        } catch (error) {
            console.error('Template generation error:', error);
            Components.showToast('Failed to generate inventory update template: ' + error.message, 'error');
        }
    };
    
    return {
        exportInventoryToExcel,
        exportTransactionsToExcel,
        exportDatabaseToJSON,
        exportDatabaseToExcel,
        exportFilteredDataToExcel,
        importFromExcel,
        importFromJSON,
        exportTemplate,
        backupDatabase,
        restoreDatabase,
        generateItemTypesTemplate,
        generateInventoryUpdateTemplate
    };
})();

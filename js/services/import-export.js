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
    
    // Sheet builder helpers
    const addControlSheet = (workbook, state, filterNames, inventoryCount, transactionCount) => {
        const ws = workbook.addWorksheet('CONTROL');
        ws.columns = [{ width: 25 }, { width: 40 }];
        
        const userName = state.user ? (state.user.email || state.user.name || state.user.id || 'Unknown') : 'Unknown';
        
        ws.addRows([
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
            ['Total Inventory Records', inventoryCount],
            ['Total Transaction Records', transactionCount],
            ['Total Item Types', state.itemTypes.length],
            [''],
            ['Sheet Descriptions'],
            ['CONTROL', 'Export metadata and filter information'],
            ['INVENTORY', 'Filtered inventory records based on selected criteria'],
            ['ITEM_TYPES', 'Complete list of all item types in the system'],
            ['TRANSACTIONS', 'Filtered transaction history matching inventory filters']
        ]);
    };
    
    const addInventorySheet = (workbook, rows) => {
        const ws = workbook.addWorksheet('INVENTORY');
        const helpers = window.ExportHelpers;
        
        if (!helpers) {
            console.error('ExportHelpers not available on window object');
            throw new Error('Export helpers not properly initialized');
        }
        
        if (!helpers.INVENTORY_COLUMNS) {
            console.error('INVENTORY_COLUMNS not available in ExportHelpers');
            console.log('Available ExportHelpers keys:', Object.keys(helpers));
            throw new Error('INVENTORY_COLUMNS not found in export helpers');
        }
        
        ws.addTable({
            name: 'InventoryTable',
            ref: `A1:AC${rows.length + 1}`,
            headerRow: true,
            totalsRow: false,
            style: { theme: 'TableStyleMedium9', showRowStripes: true },
            columns: helpers.INVENTORY_COLUMNS,
            rows: rows
        });
        
        // Set key column widths
        ws.getColumn(1).width = 8;   // ID
        ws.getColumn(2).width = 15;  // Client
        ws.getColumn(3).width = 15;  // Market
        ws.getColumn(4).width = 15;  // SLOC
        ws.getColumn(10).width = 25; // Item Type
        ws.getColumn(13).width = 20; // Manufacturer
        ws.getColumn(14).width = 20; // Part Number
        ws.getColumn(15).width = 30; // Description
    };
    
    const addItemTypesSheet = (workbook, state) => {
        const ws = workbook.addWorksheet('ITEM_TYPES');
        const helpers = window.ExportHelpers;
        
        const rows = state.itemTypes.map(it => {
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
        
        ws.addTable({
            name: 'ItemTypesTable',
            ref: `A1:V${rows.length + 1}`,
            headerRow: true,
            totalsRow: false,
            style: { theme: 'TableStyleMedium9', showRowStripes: true },
            columns: helpers.ITEM_TYPES_COLUMNS,
            rows: rows
        });
        
        ws.getColumn(1).width = 8;   // ID
        ws.getColumn(2).width = 25;  // Name
        ws.getColumn(5).width = 20;  // Manufacturer
        ws.getColumn(6).width = 20;  // Part Number
        ws.getColumn(7).width = 30;  // Description
    };
    
    const addTransactionsSheet = (workbook, rows) => {
        const ws = workbook.addWorksheet('TRANSACTIONS');
        const helpers = window.ExportHelpers;
        
        ws.addTable({
            name: 'TransactionsTable',
            ref: `A1:AK${rows.length + 1}`,
            headerRow: true,
            totalsRow: false,
            style: { theme: 'TableStyleMedium9', showRowStripes: true },
            columns: helpers.TRANSACTION_COLUMNS,
            rows: rows
        });
        
        ws.getColumn(1).width = 8;   // ID
        ws.getColumn(2).width = 20;  // Date/Time
        ws.getColumn(10).width = 25; // Item Type
        ws.getColumn(32).width = 40; // Notes
    };
    
    const addEmptySheet = (workbook, sheetName, message) => {
        const ws = workbook.addWorksheet(sheetName);
        ws.addRow([message]);
    };
    
    const saveWorkbook = async (workbook, filename) => {
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        window.URL.revokeObjectURL(url);
    };
    
    // Template sheet builders
    const addTemplateControlSheet = (workbook, instructions) => {
        const ws = workbook.addWorksheet('CONTROL', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });
        
        ws.columns = [{ width: 25 }, { width: 12 }, { width: 50 }, { width: 40 }];
        
        instructions.forEach((row, idx) => {
            ws.addRow(row);
            if (idx === 0) {
                ws.getRow(idx + 1).font = { bold: true, size: 14 };
            } else if (row[0] && row[0].includes(':') && row[0].length < 30) {
                ws.getRow(idx + 1).font = { bold: true };
            }
        });
    };
    
    const addExistingItemTypesSheet = (workbook, rows) => {
        const ws = workbook.addWorksheet('EXISTING_ITEM_TYPES', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });
        
        const dataRows = rows.length > 0 ? rows : [['', '', '', '', '', '', '', '', '', '', '']];
        
        ws.addTable({
            name: 'ExistingItemTypes',
            ref: `A1:K${dataRows.length + 1}`,
            headerRow: true,
            style: { theme: 'TableStyleMedium2', showRowStripes: true },
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
                { name: 'Current Markets' }
            ],
            rows: dataRows
        });
        
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        
        [12, 30, 20, 20, 40, 18, 18, 18, 18, 20, 40].forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
    };
    
    const addNewItemTypesSheet = (workbook, dropdowns) => {
        const ws = workbook.addWorksheet('NEW_ITEM_TYPES', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 5 }]
        });
        
        // Add instructions at the top
        ws.mergeCells('A1:J1');
        ws.getCell('A1').value = 'INSTRUCTIONS FOR MARKET ASSIGNMENT';
        ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FF000000' } };
        ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEB9C' } };
        ws.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
        
        ws.mergeCells('A2:J2');
        ws.getCell('A2').value = 'For each new item type, enter "X" or "Yes" in the market columns (green headers) to assign that item type to those markets.';
        ws.getCell('A2').font = { size: 11 };
        ws.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        ws.getRow(2).height = 30;
        
        ws.mergeCells('A3:J3');
        ws.getCell('A3').value = 'You can assign each item type to multiple markets at once. Leave market cells blank if the item type does not apply to that market.';
        ws.getCell('A3').font = { size: 11 };
        ws.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        ws.getRow(3).height = 30;
        
        // Empty row for spacing
        ws.getRow(4).height = 10;
        
        // Build columns: standard fields + market columns
        const standardColumns = [
            { name: 'Name' }, { name: 'Manufacturer' }, { name: 'Part Number' },
            { name: 'Description' }, { name: 'Units per Package' }, { name: 'Low Units Quantity' },
            { name: 'Inventory Type' }, { name: 'Unit of Measure' }, { name: 'Provider' }, { name: 'Category' }
        ];
        
        // Sanitize market names for Excel column headers
        const marketColumns = dropdowns.markets.map(market => ({ 
            name: String(market).replace(/[^\w\s-]/g, '').substring(0, 50) 
        }));
        const allColumns = [...standardColumns, ...marketColumns];
        
        // Create empty rows with correct number of columns
        const emptyRows = Array(20).fill().map(() => Array(allColumns.length).fill(''));
        
        // Calculate ref range (A5 to last column, row 25) - starting at row 5 now
        const lastColLetter = getExcelColumnLetter(allColumns.length);
        const tableRef = `A5:${lastColLetter}25`;
        
        ws.addTable({
            name: 'NewItemTypes',
            ref: tableRef,
            headerRow: true,
            style: { theme: 'TableStyleMedium9', showRowStripes: true },
            columns: allColumns,
            rows: emptyRows
        });
        
        // Style required (red) columns: Name, Units per Package, Inventory Type, UOM, Provider, Category
        [1, 5, 7, 8, 9, 10].forEach(col => {
            ws.getCell(5, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
            ws.getCell(5, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        
        // Style optional (blue) columns: Manufacturer, Part Number, Description, Low Units Quantity
        [2, 3, 4, 6].forEach(col => {
            ws.getCell(5, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
            ws.getCell(5, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        });
        
        // Style market columns (green)
        for (let col = 11; col <= allColumns.length; col++) {
            ws.getCell(5, col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF70AD47' } };
            ws.getCell(5, col).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        }
        
        // Set column widths
        const widths = [30, 20, 20, 40, 18, 18, 18, 18, 20, 20, ...Array(marketColumns.length).fill(12)];
        widths.forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
        
        // Add data validation dropdowns for standard fields (starting at row 6 now)
        const validations = [
            { col: 'B', list: dropdowns.providers, title: 'Manufacturer' },
            { col: 'G', list: dropdowns.inventoryTypes, title: 'Inventory Type' },
            { col: 'H', list: dropdowns.uoms, title: 'Unit of Measure' },
            { col: 'I', list: dropdowns.providers, title: 'Provider' },
            { col: 'J', list: dropdowns.categories, title: 'Category' }
        ];
        
        for (let i = 6; i <= 25; i++) {
            validations.forEach(({ col, list, title }) => {
                if (list && list.length > 0) {
                    ws.getCell(`${col}${i}`).dataValidation = {
                        type: 'list',
                        allowBlank: false,
                        formulae: [`"${list.join(',')}"`],
                        showErrorMessage: true,
                        errorTitle: `Invalid ${title}`,
                        error: `Please select a valid ${title.toLowerCase()} from the list`
                    };
                }
            });
            
            // Add data validation for market columns (X, Yes, or blank)
            for (let col = 11; col <= allColumns.length; col++) {
                const colLetter = getExcelColumnLetter(col);
                ws.getCell(`${colLetter}${i}`).dataValidation = {
                    type: 'list',
                    allowBlank: true,
                    formulae: ['"X,Yes"'],
                    showErrorMessage: true,
                    errorTitle: 'Invalid Value',
                    error: 'Enter X or Yes to assign to this market, or leave blank'
                };
            }
        }
    };
    
    // Helper function to convert column number to Excel letter (1=A, 27=AA, etc)
    const getExcelColumnLetter = (colNum) => {
        let letter = '';
        while (colNum > 0) {
            const mod = (colNum - 1) % 26;
            letter = String.fromCharCode(65 + mod) + letter;
            colNum = Math.floor((colNum - mod) / 26);
        }
        return letter;
    };
    
    const addLookupValuesSheet = (workbook, dropdowns) => {
        const ws = workbook.addWorksheet('LOOKUP_VALUES');
        
        const maxLen = Math.max(
            dropdowns.categories.length,
            dropdowns.uoms.length,
            dropdowns.providers.length,
            dropdowns.inventoryTypes.length,
            dropdowns.markets.length,
            dropdowns.clients.length,
            1
        );
        
        const rows = [];
        for (let i = 0; i < maxLen; i++) {
            rows.push([
                dropdowns.categories[i] || '',
                dropdowns.uoms[i] || '',
                dropdowns.providers[i] || '',
                dropdowns.inventoryTypes[i] || '',
                dropdowns.markets[i] || '',
                dropdowns.clients[i] || '',
                i < 2 ? ['TRUE', 'FALSE'][i] : ''
            ]);
        }
        
        ws.addTable({
            name: 'LookupValues',
            ref: `A1:G${rows.length + 1}`,
            headerRow: true,
            style: { theme: 'TableStyleLight1', showRowStripes: true },
            columns: [
                { name: 'Categories' }, { name: 'Units of Measure' }, { name: 'Providers' },
                { name: 'Inventory Types' }, { name: 'Markets' }, { name: 'Clients' }, { name: 'Allow PDF Options' }
            ],
            rows: rows
        });
        
        [20, 20, 20, 20, 25, 25, 12].forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
    };
    
    const addSerializedInventorySheet = (workbook, rows) => {
        const ws = workbook.addWorksheet('SERIALIZED_INVENTORY', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });
        
        const dataRows = rows.length > 0 ? rows : [['', '', '', '', '', '', '', '', '', '', '']];
        
        ws.addTable({
            name: 'SerializedInventory',
            ref: `A1:K${dataRows.length + 1}`,
            headerRow: true,
            style: { theme: 'TableStyleMedium2', showRowStripes: true },
            columns: [
                { name: 'ID' }, { name: 'Item Type' }, { name: 'Category' }, { name: 'Manufacturer SN' },
                { name: 'Tilson SN' }, { name: 'Quantity' }, { name: 'Status' }, { name: 'Location' },
                { name: 'Location Type' }, { name: 'Crew' }, { name: 'Area' }
            ],
            rows: dataRows
        });
        
        [10, 30, 15, 20, 20, 12, 15, 20, 15, 20, 20].forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
        
        // Yellow highlight for Quantity column
        ws.getColumn(6).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            }
        });
        
        // Blue header
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    };
    
    const addBulkInventorySheet = (workbook, rows) => {
        const ws = workbook.addWorksheet('BULK_INVENTORY', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 1 }]
        });
        
        const dataRows = rows.length > 0 ? rows : [['', '', '', '', '', '', '', '', '', '', '']];
        
        ws.addTable({
            name: 'BulkInventory',
            ref: `A1:K${dataRows.length + 1}`,
            headerRow: true,
            style: { theme: 'TableStyleMedium2', showRowStripes: true },
            columns: [
                { name: 'ID' }, { name: 'Item Type' }, { name: 'Category' }, { name: 'Part Number' },
                { name: 'Quantity' }, { name: 'Unit of Measure' }, { name: 'Status' }, { name: 'Location' },
                { name: 'Location Type' }, { name: 'Crew' }, { name: 'Area' }
            ],
            rows: dataRows
        });
        
        [10, 30, 15, 20, 12, 15, 15, 20, 15, 20, 20].forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
        
        // Yellow highlight for Quantity column
        ws.getColumn(5).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 1) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
            }
        });
        
        // Blue header
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    };
    
    const addNewInventorySheet = (workbook, state, sloc) => {
        const ws = workbook.addWorksheet('NEW_INVENTORY', {
            views: [{ state: 'frozen', xSplit: 0, ySplit: 9 }]
        });
        
        // Get bulk item types for selected SLOC's market
        const helpers = window.ExportHelpers;
        const marketId = sloc?.market_id;
        let bulkItemTypes = state.itemTypes.filter(it => it.inventory_type_id === 2);
        
        // Filter by market
        if (marketId && state.itemTypeMarkets) {
            const marketItemTypeIds = state.itemTypeMarkets
                .filter(itm => itm.market_id === marketId)
                .map(itm => itm.item_type_id);
            bulkItemTypes = bulkItemTypes.filter(it => marketItemTypeIds.includes(it.id));
        }
        
        // Add Client/Market/SLOC info section (rows 1-8)
        const client = state.clients.find(c => c.id === sloc?.client_id);
        const market = state.markets.find(m => m.id === sloc?.market_id);
        
        ws.getCell('A1').value = 'Template Information';
        ws.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
        ws.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
        ws.mergeCells('A1:F1');
        
        ws.getCell('A2').value = 'Client:';
        ws.getCell('A2').font = { bold: true };
        ws.getCell('B2').value = client?.name || '';
        
        ws.getCell('A3').value = 'Market:';
        ws.getCell('A3').font = { bold: true };
        ws.getCell('B3').value = market?.name || '';
        
        ws.getCell('A4').value = 'SLOC:';
        ws.getCell('A4').font = { bold: true };
        ws.getCell('B4').value = sloc?.name || '';
        
        ws.getCell('A6').value = 'Instructions:';
        ws.getCell('A6').font = { bold: true };
        ws.getCell('A7').value = 'Enter quantities to receive for each item type below. This sheet can be printed for manual physical inventory.';
        ws.getCell('A7').alignment = { wrapText: true };
        ws.mergeCells('A7:F7');
        
        // Generate rows from bulk item types
        const itemTypeRows = bulkItemTypes.map(it => helpers.bulkItemTypeToNewInventoryRow(it, state));
        
        // Add table starting at row 9
        const lastRow = 9 + itemTypeRows.length;
        ws.addTable({
            name: 'NewInventory',
            ref: `A9:F${lastRow}`,
            headerRow: true,
            style: { theme: 'TableStyleMedium2', showRowStripes: true },
            columns: [
                { name: 'Name', key: 'name', header: 'Name' },
                { name: 'Part Number', key: 'part_number', header: 'Part Number' },
                { name: 'Description', key: 'description', header: 'Description' },
                { name: 'Unit of Measure', key: 'unit_of_measure', header: 'Unit of Measure' },
                { name: 'Category', key: 'category', header: 'Category' },
                { name: 'Quantity', key: 'quantity', header: 'Quantity' }
            ],
            rows: itemTypeRows
        });
        
        // Set column widths
        [35, 20, 50, 15, 20, 12].forEach((width, idx) => {
            ws.getColumn(idx + 1).width = width;
        });
        
        // Light blue for informational columns (Name, Part Number, Description, UOM, Category)
        [1, 2, 3, 4, 5].forEach(col => {
            ws.getColumn(col).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
                if (rowNumber > 9) {
                    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEEEFF' } };
                }
            });
        });
        
        // Light red for Quantity column (required)
        ws.getColumn(6).eachCell({ includeEmpty: false }, (cell, rowNumber) => {
            if (rowNumber > 9) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFEEEE' } };
            }
        });
        
        // Blue header row
        ws.getRow(9).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        ws.getRow(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4472C4' } };
    };
    
    // Export filtered data to Excel with multiple sheets
    const exportFilteredDataToExcel = async (filters, filterNames) => {
        try {
            const state = Store.getState();
            const helpers = window.ExportHelpers;
            
            // Filter data using hierarchy
            const validSlocIds = helpers.buildValidSlocIds(state, filters);
            const filteredInventory = helpers.filterInventory(state, filters, validSlocIds);
            const filteredTransactions = helpers.filterTransactions(state, filters, validSlocIds);
            
            // Create workbook
            const workbook = new ExcelJS.Workbook();
            
            // Add CONTROL sheet
            addControlSheet(workbook, state, filterNames, filteredInventory.length, filteredTransactions.length);
            
            // Add INVENTORY sheet
            if (filteredInventory.length > 0) {
                const enriched = filteredInventory.map(item => helpers.enrichInventoryItem(item, state));
                const rows = enriched.map(item => helpers.inventoryItemToExportRow(item));
                addInventorySheet(workbook, rows);
            } else {
                addEmptySheet(workbook, 'INVENTORY', 'No inventory records match the selected filters');
            }
            
            // Add ITEM_TYPES sheet
            addItemTypesSheet(workbook, state);
            
            // Add TRANSACTIONS sheet
            if (filteredTransactions.length > 0) {
                const rows = filteredTransactions.map(tx => helpers.transactionToExportRow(tx, state));
                addTransactionsSheet(workbook, rows);
            } else {
                addEmptySheet(workbook, 'TRANSACTIONS', 'No transaction records match the selected filters');
            }
            
            // Save file
            const filename = helpers.generateExportFilename(filters, filterNames);
            await saveWorkbook(workbook, filename);
            
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
            const helpers = window.ExportHelpers;
            
            // Create workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = state.user?.email || 'Inventory System';
            workbook.created = new Date();
            
            // Get dropdown values
            const dropdowns = helpers.getTemplateDropdowns(state);
            
            // Add sheets
            const instructions = helpers.getItemTypesTemplateInstructions(state);
            addTemplateControlSheet(workbook, instructions);
            
            const existingRows = state.itemTypes.map(it => helpers.itemTypeToTemplateRow(it, state));
            addExistingItemTypesSheet(workbook, existingRows);
            
            addNewItemTypesSheet(workbook, dropdowns);
            addLookupValuesSheet(workbook, dropdowns);
            
            // Save file
            const filename = `item_types_import_template_${new Date().toISOString().split('T')[0]}.xlsx`;
            await saveWorkbook(workbook, filename);
            
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
            const helpers = window.ExportHelpers;
            const selectedSloc = state.selectedSloc;
            
            if (!selectedSloc) {
                Components.showToast('Please select a SLOC first', 'warning');
                return;
            }
            
            // Create workbook
            const workbook = new ExcelJS.Workbook();
            workbook.creator = state.user?.email || 'Inventory System';
            workbook.created = new Date();
            
            // Filter and categorize inventory
            const slocInventory = state.inventory.filter(inv => inv.sloc_id === selectedSloc.id);
            const serializedInventory = slocInventory.filter(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                return itemType && itemType.inventory_type_id === 1;
            });
            const bulkInventory = slocInventory.filter(inv => {
                const itemType = state.itemTypes.find(it => it.id === inv.item_type_id);
                return itemType && itemType.inventory_type_id === 2;
            });
            
            // Calculate summary
            const summary = helpers.calculateInventorySummary(serializedInventory, bulkInventory, state);
            
            // Add sheets
            const instructions = helpers.getInventoryUpdateInstructions(state, selectedSloc, summary);
            addTemplateControlSheet(workbook, instructions);
            
            const serializedRows = serializedInventory.map(inv => helpers.serializedInventoryToRow(inv, state));
            addSerializedInventorySheet(workbook, serializedRows);
            
            const bulkRows = bulkInventory.map(inv => helpers.bulkInventoryToRow(inv, state));
            addBulkInventorySheet(workbook, bulkRows);
            
            addNewInventorySheet(workbook, state, selectedSloc);
            
            // Save file
            const timestamp = new Date().toISOString().split('T')[0];
            const filename = `inventory_update_template_${selectedSloc.name.replace(/[^a-z0-9]/gi, '_')}_${timestamp}.xlsx`;
            await saveWorkbook(workbook, filename);
            
            Components.showToast(`Inventory update template downloaded (${summary.totalSerializedItems} serialized, ${summary.totalBulkItems} bulk items)`, 'success');
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

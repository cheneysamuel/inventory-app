/**
 * Export Helper Functions
 * Reusable utilities for data export operations
 */

(() => {
    'use strict';

    // ========================================
    // HIERARCHY FILTERING
    // ========================================

    /**
     * Build list of valid SLOC IDs based on cascading hierarchy filters
     */
    function buildValidSlocIds(state, filters) {
        let validSlocIds = state.slocs.map(s => s.id);
        
        // Filter by client (if selected, limit to markets under that client, then SLOCs under those markets)
        if (filters.clientId) {
            const clientMarketIds = state.markets
                .filter(m => m.client_id === filters.clientId)
                .map(m => m.id);
            validSlocIds = validSlocIds.filter(slocId => {
                const sloc = state.slocs.find(s => s.id === slocId);
                return sloc && clientMarketIds.includes(sloc.market_id);
            });
        }
        
        // Filter by market (if selected, limit to SLOCs under that market)
        if (filters.marketId) {
            validSlocIds = validSlocIds.filter(slocId => {
                const sloc = state.slocs.find(s => s.id === slocId);
                return sloc && sloc.market_id === filters.marketId;
            });
        }
        
        // Filter by SLOC (if selected, limit to just that SLOC)
        if (filters.slocId) {
            validSlocIds = validSlocIds.filter(slocId => slocId === filters.slocId);
        }
        
        return validSlocIds;
    }

    /**
     * Filter inventory based on hierarchy and additional filters
     */
    function filterInventory(state, filters, validSlocIds) {
        let filtered = state.inventory.filter(i => validSlocIds.includes(i.sloc_id));
        
        if (filters.areaId) {
            filtered = filtered.filter(i => i.area_id === filters.areaId);
        }
        
        if (filters.crewId) {
            filtered = filtered.filter(i => i.assigned_crew_id === filters.crewId);
        }
        
        return filtered;
    }

    /**
     * Filter transactions based on hierarchy and additional filters
     */
    function filterTransactions(state, filters, validSlocIds) {
        const validSlocNames = validSlocIds
            .map(slocId => state.slocs.find(s => s.id === slocId)?.name)
            .filter(Boolean);
        
        let filtered = state.transactions.filter(tx => 
            validSlocNames.includes(tx.sloc)
        );
        
        if (filters.areaId) {
            const areaName = state.areas.find(a => a.id === filters.areaId)?.name;
            if (areaName) {
                filtered = filtered.filter(tx => tx.area_name === areaName);
            }
        }
        
        if (filters.crewId) {
            const crewName = state.crews.find(c => c.id === filters.crewId)?.name;
            if (crewName) {
                filtered = filtered.filter(tx => tx.assigned_crew_name === crewName);
            }
        }
        
        return filtered;
    }

    // ========================================
    // DATA ENRICHMENT
    // ========================================

    /**
     * Enrich inventory item with all related entity lookups
     */
    function enrichInventoryItem(item, state) {
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
        
        return {
            ...item,
            itemType,
            sloc,
            market,
            client,
            area,
            crew,
            status,
            location,
            locationType,
            inventoryType,
            uom,
            provider,
            category
        };
    }

    /**
     * Convert enriched inventory item to export row array
     */
    function inventoryItemToExportRow(enriched) {
        return [
            enriched.id,
            enriched.client?.name || '',
            enriched.market?.name || '',
            enriched.sloc?.name || '',
            enriched.itemType?.name || '',
            enriched.itemType?.description || '',
            enriched.category?.name || '',
            enriched.inventoryType?.name || '',
            enriched.uom?.name || '',
            enriched.provider?.name || '',
            enriched.mfgrsn || '',
            enriched.tilsonsn || '',
            enriched.quantity || 1,
            enriched.status?.name || '',
            enriched.location?.name || '',
            enriched.locationType?.name || '',
            enriched.crew?.name || '',
            enriched.area?.name || '',
            enriched.item_catalog_number || '',
            enriched.itemType?.attributes?.['item-category'] || '',
            enriched.itemType?.attributes?.['class'] || '',
            enriched.itemType?.attributes?.['material-group'] || '',
            enriched.itemType?.attributes?.['material-type'] || '',
            enriched.itemType?.attributes?.['procurement-type'] || '',
            enriched.itemType?.attributes?.['special-procurement-type'] || '',
            enriched.itemType?.attributes?.['profit-center'] || '',
            enriched.created_at,
            enriched.updated_at,
            enriched.sequential_number || ''
        ];
    }

    /**
     * Parse transaction user JSON safely
     */
    function parseTransactionUser(tx) {
        try {
            return tx.user ? JSON.parse(tx.user) : null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Convert transaction to export row array
     */
    function transactionToExportRow(tx, state) {
        const userObj = parseTransactionUser(tx);
        const itemType = state.itemTypes.find(it => it.name === tx.item_type_name);
        const category = itemType ? state.categories.find(c => c.id === itemType.category_id) : null;
        const inventoryType = itemType ? state.inventoryTypes.find(it => it.id === itemType.inventory_type_id) : null;
        const fromLocation = state.locations.find(l => l.name === tx.from_location_name);
        const toLocation = state.locations.find(l => l.name === tx.to_location_name);
        const fromLocationType = fromLocation ? state.locationTypes.find(lt => lt.id === fromLocation.loc_type_id) : null;
        const toLocationType = toLocation ? state.locationTypes.find(lt => lt.id === toLocation.loc_type_id) : null;
        
        return [
            tx.id,
            tx.transaction_type || '',
            tx.action || '',
            tx.item_type_name || '',
            category?.name || '',
            inventoryType?.name || '',
            tx.quantity || '',
            tx.old_quantity || '',
            tx.mfgrsn || '',
            tx.tilsonsn || '',
            tx.sloc || '',
            tx.from_location_name || '',
            fromLocationType?.name || '',
            tx.to_location_name || '',
            toLocationType?.name || '',
            tx.old_status_name || '',
            tx.status_name || '',
            tx.assigned_crew_name || '',
            tx.old_assigned_crew_name || '',
            tx.area_name || '',
            tx.old_area_name || '',
            userObj?.name || tx.user_name || '',
            userObj?.email || '',
            tx.date_time,
            tx.notes || '',
            tx.sequential_number || '',
            tx.before_state || '',
            tx.after_state || ''
        ];
    }

    // ========================================
    // FILENAME GENERATION
    // ========================================

    /**
     * Generate export filename with filter information
     */
    function generateExportFilename(filters, filterNames) {
        const parts = ['export'];
        
        if (filterNames.client) parts.push(filterNames.client.replace(/\s+/g, '_'));
        if (filterNames.market) parts.push(filterNames.market.replace(/\s+/g, '_'));
        if (filterNames.sloc) parts.push(filterNames.sloc.replace(/\s+/g, '_'));
        if (filterNames.area) parts.push(filterNames.area.replace(/\s+/g, '_'));
        if (filterNames.crew) parts.push(filterNames.crew.replace(/\s+/g, '_'));
        
        parts.push(getLocalDateString());
        
        return parts.join('_') + '.xlsx';
    }

    // ========================================
    // EXCEL COLUMN DEFINITIONS
    // ========================================

    const INVENTORY_COLUMNS = [
        { name: 'ID', header: 'ID', key: 'id', width: 10 },
        { name: 'Client', header: 'Client', key: 'client', width: 20 },
        { name: 'Market', header: 'Market', key: 'market', width: 25 },
        { name: 'SLOC', header: 'SLOC', key: 'sloc', width: 20 },
        { name: 'Item Type', header: 'Item Type', key: 'item_type', width: 40 },
        { name: 'Description', header: 'Description', key: 'description', width: 50 },
        { name: 'Category', header: 'Category', key: 'category', width: 20 },
        { name: 'Inventory Type', header: 'Inventory Type', key: 'inventory_type', width: 15 },
        { name: 'UOM', header: 'UOM', key: 'uom', width: 10 },
        { name: 'Provider', header: 'Provider', key: 'provider', width: 20 },
        { name: 'Manufacturer SN', header: 'Manufacturer SN', key: 'mfgrsn', width: 25 },
        { name: 'Tilson SN', header: 'Tilson SN', key: 'tilsonsn', width: 25 },
        { name: 'Quantity', header: 'Quantity', key: 'quantity', width: 10 },
        { name: 'Status', header: 'Status', key: 'status', width: 15 },
        { name: 'Location', header: 'Location', key: 'location', width: 25 },
        { name: 'Location Type', header: 'Location Type', key: 'location_type', width: 15 },
        { name: 'Crew', header: 'Crew', key: 'crew', width: 20 },
        { name: 'Area', header: 'Area', key: 'area', width: 20 },
        { name: 'Catalog #', header: 'Catalog #', key: 'catalog', width: 20 },
        { name: 'Item Category', header: 'Item Category', key: 'item_category', width: 15 },
        { name: 'Class', header: 'Class', key: 'class', width: 15 },
        { name: 'Material Group', header: 'Material Group', key: 'material_group', width: 20 },
        { name: 'Material Type', header: 'Material Type', key: 'material_type', width: 20 },
        { name: 'Procurement Type', header: 'Procurement Type', key: 'procurement_type', width: 20 },
        { name: 'Special Procurement', header: 'Special Procurement', key: 'special_procurement', width: 20 },
        { name: 'Profit Center', header: 'Profit Center', key: 'profit_center', width: 15 },
        { name: 'Created', header: 'Created', key: 'created', width: 20 },
        { name: 'Updated', header: 'Updated', key: 'updated', width: 20 },
        { name: 'Sequential #', header: 'Sequential #', key: 'sequential', width: 15 }
    ];

    const TRANSACTION_COLUMNS = [
        { name: 'ID', header: 'ID', key: 'id', width: 10 },
        { name: 'Type', header: 'Type', key: 'type', width: 15 },
        { name: 'Action', header: 'Action', key: 'action', width: 15 },
        { name: 'Item Type', header: 'Item Type', key: 'item_type', width: 40 },
        { name: 'Category', header: 'Category', key: 'category', width: 20 },
        { name: 'Inventory Type', header: 'Inventory Type', key: 'inventory_type', width: 15 },
        { name: 'Quantity', header: 'Quantity', key: 'quantity', width: 10 },
        { name: 'Old Quantity', header: 'Old Quantity', key: 'old_quantity', width: 12 },
        { name: 'Manufacturer SN', header: 'Manufacturer SN', key: 'mfgrsn', width: 25 },
        { name: 'Tilson SN', header: 'Tilson SN', key: 'tilsonsn', width: 25 },
        { name: 'SLOC', header: 'SLOC', key: 'sloc', width: 20 },
        { name: 'From Location', header: 'From Location', key: 'from_location', width: 25 },
        { name: 'From Location Type', header: 'From Location Type', key: 'from_location_type', width: 18 },
        { name: 'To Location', header: 'To Location', key: 'to_location', width: 25 },
        { name: 'To Location Type', header: 'To Location Type', key: 'to_location_type', width: 18 },
        { name: 'Old Status', header: 'Old Status', key: 'old_status', width: 15 },
        { name: 'Status', header: 'Status', key: 'status', width: 15 },
        { name: 'Crew', header: 'Crew', key: 'crew', width: 20 },
        { name: 'Old Crew', header: 'Old Crew', key: 'old_crew', width: 20 },
        { name: 'Area', header: 'Area', key: 'area', width: 20 },
        { name: 'Old Area', header: 'Old Area', key: 'old_area', width: 20 },
        { name: 'User', header: 'User', key: 'user', width: 25 },
        { name: 'User Email', header: 'User Email', key: 'user_email', width: 30 },
        { name: 'Date/Time', header: 'Date/Time', key: 'date_time', width: 20 },
        { name: 'Notes', header: 'Notes', key: 'notes', width: 50 },
        { name: 'Sequential #', header: 'Sequential #', key: 'sequential', width: 15 },
        { name: 'Before State', header: 'Before State', key: 'before_state', width: 30 },
        { name: 'After State', header: 'After State', key: 'after_state', width: 30 }
    ];

    const ITEM_TYPES_COLUMNS = [
        { name: 'ID', header: 'ID', key: 'id', width: 10 },
        { name: 'Name', header: 'Name', key: 'name', width: 40 },
        { name: 'Inventory Type', header: 'Inventory Type', key: 'inventory_type', width: 15 },
        { name: 'Inventory Type ID', header: 'Inventory Type ID', key: 'inventory_type_id', width: 15 },
        { name: 'Manufacturer', header: 'Manufacturer', key: 'manufacturer', width: 20 },
        { name: 'Part Number', header: 'Part Number', key: 'part_number', width: 20 },
        { name: 'Description', header: 'Description', key: 'description', width: 50 },
        { name: 'UOM', header: 'UOM', key: 'uom', width: 10 },
        { name: 'UOM ID', header: 'UOM ID', key: 'uom_id', width: 10 },
        { name: 'Units Per Package', header: 'Units Per Package', key: 'units_per_package', width: 15 },
        { name: 'Provider', header: 'Provider', key: 'provider', width: 20 },
        { name: 'Provider ID', header: 'Provider ID', key: 'provider_id', width: 15 },
        { name: 'Category', header: 'Category', key: 'category', width: 20 },
        { name: 'Category ID', header: 'Category ID', key: 'category_id', width: 15 },
        { name: 'Low Units Quantity', header: 'Low Units Quantity', key: 'low_units_quantity', width: 15 },
        { name: 'Image Path', header: 'Image Path', key: 'image_path', width: 30 },
        { name: 'Meta', header: 'Meta', key: 'meta', width: 20 },
        { name: 'Market', header: 'Market', key: 'market', width: 20 },
        { name: 'Market ID', header: 'Market ID', key: 'market_id', width: 15 },
        { name: 'Client', header: 'Client', key: 'client', width: 20 },
        { name: 'Created', header: 'Created', key: 'created', width: 20 },
        { name: 'Updated', header: 'Updated', key: 'updated', width: 20 }
    ];

    // ========================================
    // TEMPLATE HELPERS
    // ========================================

    /**
     * Get unique sorted dropdown values for templates
     */
    function getTemplateDropdowns(state) {
        return {
            categories: [...new Set(state.categories.map(c => c.name))].sort(),
            uoms: [...new Set((state.unitsOfMeasure || []).map(u => u.name))].sort(),
            providers: [...new Set((state.providers || []).map(p => p.name))].sort(),
            inventoryTypes: [...new Set((state.inventoryTypes || []).map(it => it.name))].sort(),
            markets: [...new Set(state.markets.map(m => m.name))].sort(),
            clients: [...new Set(state.clients.map(c => c.name))].sort()
        };
    }

    /**
     * Build item type row for template
     */
    function itemTypeToTemplateRow(itemType, state) {
        const category = state.categories.find(c => c.id === itemType.category_id);
        const uom = state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id);
        const provider = state.providers?.find(p => p.id === itemType.inventory_provider_id);
        const invType = state.inventoryTypes?.find(it => it.id === itemType.inventory_type_id);
        
        // Get all markets for this item type from item_type_markets table
        const itemTypeMarkets = (state.itemTypeMarkets || []).filter(itm => itm.item_type_id === itemType.id);
        const marketNames = itemTypeMarkets
            .map(itm => {
                const market = state.markets.find(m => m.id === itm.market_id);
                return market?.name;
            })
            .filter(name => name)
            .join(', ');
        
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
            marketNames
        ];
    }

    /**
     * Create control sheet instructions for item types template
     */
    function getItemTypesTemplateInstructions(state) {
        const marketList = state.markets.map(m => m.name).join(', ');
        
        return [
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
            ['   - Blue headers indicate OPTIONAL fields'],
            ['   - Green headers indicate MARKET ASSIGNMENT columns'],
            ['   - Enter X or Yes in market columns to assign the item type to those markets'],
            ['   - You can assign each item type to multiple markets at once'],
            ['   - Use dropdowns for lookup values (Category, UOM, Provider, Inventory Type)'],
            [''],
            ['4. LOOKUP_VALUES'],
            ['   - Reference sheet with all valid dropdown values'],
            [''],
            ['FIELD EXPLANATIONS FOR NEW ITEM TYPES:'],
            [''],
            ['Field Name', 'Required?', 'Description', 'Notes'],
            ['Name', 'YES', 'Item type name', 'Must be unique within each market'],
            ['Manufacturer', 'NO', 'Item manufacturer', 'Select from dropdown'],
            ['Part Number', 'NO', 'Manufacturer part number', ''],
            ['Description', 'NO', 'Detailed description of the item', ''],
            ['Units per Package', 'YES', 'Number of units in standard package', 'Required - enter 1 if sold individually'],
            ['Low Units Quantity', 'NO', 'Minimum quantity threshold for alerts', 'Leave blank if not applicable'],
            ['Inventory Type', 'YES', 'Serialized or Bulk', 'Select from dropdown - determines tracking method'],
            ['Unit of Measure', 'YES', 'How the item is measured', 'Select from dropdown (e.g., Each, Foot, Roll)'],
            ['Provider', 'YES', 'Item provider/supplier', 'Select from dropdown'],
            ['Category', 'YES', 'Item category', 'Select from dropdown (e.g., Cable, Hardware, Equipment)'],
            ['Market Columns', 'OPTIONAL', 'One column per market', `Enter X or Yes to assign. Available markets: ${marketList}`],
            [''],
            ['IMPORTANT NOTES:'],
            ['• Do not modify the CONTROL sheet or column headers'],
            ['• Required fields must be filled in for each new item type'],
            ['• Dropdown values come from your current database'],
            ['• Invalid values will cause import errors'],
            ['• Duplicate names within the same market will be rejected']
        ];
    }

    /**
     * Calculate inventory summary statistics
     */
    function calculateInventorySummary(serializedInv, bulkInv, state) {
        const availableStatus = state.statuses?.find(s => s.name === 'Available');
        const issuedStatus = state.statuses?.find(s => s.name === 'Issued');
        const installedStatus = state.statuses?.find(s => s.name === 'Installed');
        const rejectedStatus = state.statuses?.find(s => s.name === 'Rejected');
        
        return {
            totalSerializedItems: serializedInv.length,
            totalBulkItems: bulkInv.length,
            totalBulkQuantity: bulkInv.reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            serializedAvailable: serializedInv.filter(inv => inv.status_id === availableStatus?.id).length,
            serializedIssued: serializedInv.filter(inv => inv.status_id === issuedStatus?.id).length,
            serializedInstalled: serializedInv.filter(inv => inv.status_id === installedStatus?.id).length,
            serializedRejected: serializedInv.filter(inv => inv.status_id === rejectedStatus?.id).length,
            bulkAvailable: bulkInv.filter(inv => inv.status_id === availableStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            bulkIssued: bulkInv.filter(inv => inv.status_id === issuedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            bulkInstalled: bulkInv.filter(inv => inv.status_id === installedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0),
            bulkRejected: bulkInv.filter(inv => inv.status_id === rejectedStatus?.id).reduce((sum, inv) => sum + (inv.quantity || 0), 0)
        };
    }

    /**
     * Get inventory update template instructions
     */
    function getInventoryUpdateInstructions(state, sloc, summary) {
        const market = state.markets.find(m => m.id === sloc.market_id);
        const client = market ? state.clients.find(c => c.id === market.client_id) : null;
        
        return [
            ['INVENTORY UPDATE TEMPLATE'],
            [''],
            ['Generated:', new Date().toLocaleString()],
            ['User:', state.user?.email || 'Unknown'],
            ['SLOC:', sloc.name],
            ['Market:', market?.name || 'Unknown'],
            ['Client:', client?.name || 'Unknown'],
            [''],
            ['INVENTORY SUMMARY FOR THIS SLOC:'],
            [''],
            ['Serialized Items:'],
            ['  Total Items', summary.totalSerializedItems],
            ['  Available', summary.serializedAvailable],
            ['  Issued', summary.serializedIssued],
            ['  Installed', summary.serializedInstalled],
            ['  Rejected', summary.serializedRejected],
            [''],
            ['Bulk Items:'],
            ['  Total Items', summary.totalBulkItems],
            ['  Total Quantity', summary.totalBulkQuantity],
            ['  Available', summary.bulkAvailable],
            ['  Issued', summary.bulkIssued],
            ['  Installed', summary.bulkInstalled],
            ['  Rejected', summary.bulkRejected],
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
    }

    /**
     * Convert serialized inventory item to template row
     */
    function serializedInventoryToRow(inv, state) {
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
    }

    /**
     * Convert bulk inventory item to template row
     */
    function bulkInventoryToRow(inv, state) {
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
    }

    /**
     * Convert bulk item type to NEW_INVENTORY row for template
     */
    function bulkItemTypeToNewInventoryRow(itemType, state) {
        const category = itemType?.category_id ? state.categories.find(c => c.id === itemType.category_id) : null;
        const uom = itemType?.unit_of_measure_id ? state.unitsOfMeasure?.find(u => u.id === itemType.unit_of_measure_id) : null;
        
        return [
            itemType.name || '',
            itemType.part_number || '',
            itemType.description || '',
            uom?.name || '',
            category?.name || '',
            '' // Empty quantity for user to fill in
        ];
    }

    // ========================================
    // EXPOSE TO GLOBAL SCOPE
    // ========================================

    window.ExportHelpers = {
        // Hierarchy filtering
        buildValidSlocIds,
        filterInventory,
        filterTransactions,
        
        // Data enrichment
        enrichInventoryItem,
        inventoryItemToExportRow,
        transactionToExportRow,
        
        // Utilities
        generateExportFilename,
        
        // Template helpers
        getTemplateDropdowns,
        itemTypeToTemplateRow,
        getItemTypesTemplateInstructions,
        calculateInventorySummary,
        getInventoryUpdateInstructions,
        serializedInventoryToRow,
        bulkInventoryToRow,
        bulkItemTypeToNewInventoryRow,
        
        // Column definitions
        INVENTORY_COLUMNS,
        TRANSACTION_COLUMNS,
        ITEM_TYPES_COLUMNS
    };

})();

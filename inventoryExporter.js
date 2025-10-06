// Inventory Export Module
// Provides XLSX export functionality for inventory items filtered by location types

window.exportInventory = async function() {
    // Create the workbook for all the worksheets
    const wb = XLSX.utils.book_new();

    // Helper: fetch inventory data for a location type
    async function fetchInventoryForLocType(locType) {
        // Fetch inventory records with all necessary joins
        // Supabase does not support SQL joins in the client, so we fetch and join in JS
        // 1. Get all inventory records for this location type
        const { data: inventory, error: invError } = await supabase
            .from('inventory')
            .select(`
                *,
                item_types:item_types (
                    name, manufacturer, part_number, description, units_per_package, unit_of_measure_id, provider_id, category_id, inventory_type_id
                ),
                locations:locations (
                    name, loc_type_id
                ),
                dfn:dfns(name),
                crew:crews(name),
                status:statuses(name)
            `);

        if (invError) {
            throw new Error(`Failed to fetch inventory: ${invError.message}`);
        }
        if (!inventory || inventory.length === 0) return [];

        // 2. Fetch all lookup tables needed for mapping
        const locationTypes = getCachedTable('location_types');
        const uoms = getCachedTable('units_of_measure');
        const providers = getCachedTable('inventory_providers');
        const categories = getCachedTable('categories');
        const inventoryTypes = getCachedTable('inventory_types');

        // 3. Filter inventory by location type
        const filtered = inventory.filter(row => {
            // Find the location type name for this row
            const locTypeId = row.locations?.loc_type_id;
            const locTypeObj = locationTypes?.find(lt => lt.id === locTypeId);
            return locTypeObj && locTypeObj.name === locType;
        });

        // 4. Map inventory to export format
        return filtered.map(row => {
            const item = row.item_types || {};
            const location = row.locations || {};
            const dfn = row.dfn || {};
            const crew = row.crew || {};
            const status = row.status || {};

            const uom = uoms?.find(u => u.id === item.unit_of_measure_id) || {};
            const provider = providers?.find(p => p.id === item.provider_id) || {};
            const category = categories?.find(c => c.id === item.category_id) || {};
            const invType = inventoryTypes?.find(it => it.id === item.inventory_type_id) || {};
            const locTypeObj = locationTypes?.find(lt => lt.id === location.loc_type_id) || {};

            return {
                Item: item.name || '',
                Manufacturer: item.manufacturer || '',
                PartNumber: item.part_number || '',
                Description: item.description || '',
                UnitOfMeasure: uom.name || '',
                UnitsPerPackage: item.units_per_package || '',
                Provider: provider.name || '',
                Category: category.name || '',
                Location: location.name || '',
                LocationType: locTypeObj.name || '',
                DFN: dfn.name || '',
                Crew: crew.name || '',
                ManufacturerSN: row.mfgrSN || '',
                TilsonSN: row.tilsonSN || '',
                Quantity: row.quantity || '',
                Status: status.name || '',
                InventoryType: invType.name || ''
            };
        });
    }

    // Export inventory by location type
    for (const locType of ['Storage', 'Outgoing', 'Field', 'Install']) {
        try {
            const inventoryData = await fetchInventoryForLocType(locType);

            if (!inventoryData || inventoryData.length === 0) {
                console.log(`No data found for location type: ${locType}`);
                continue;
            }

            // Create worksheet
            const ws = XLSX.utils.json_to_sheet(inventoryData);

            // Set column widths for better readability
            ws['!cols'] = [
                { wch: 25 }, // Item
                { wch: 20 }, // Manufacturer
                { wch: 15 }, // PartNumber
                { wch: 30 }, // Description
                { wch: 12 }, // UnitOfMeasure
                { wch: 12 }, // UnitsPerPackage
                { wch: 15 }, // Provider
                { wch: 15 }, // Category
                { wch: 20 }, // Location
                { wch: 15 }, // LocationType
                { wch: 15 }, // DFN
                { wch: 15 }, // Crew
                { wch: 20 }, // ManufacturerSN
                { wch: 20 }, // TilsonSN
                { wch: 10 }, // Quantity
                { wch: 12 }, // Status
                { wch: 15 }  // InventoryType
            ];

            // Add worksheet to workbook
            XLSX.utils.book_append_sheet(wb, ws, locType);

        } catch (error) {
            console.error('❌ Error during inventory export:', error);
            alert(`Export failed: ${error.message}\n\nPlease check the console for details.`);
        }
    }

    // Export the transactions table as a separate sheet
    try {
        const { data: transactions, error: txError } = await supabase
            .from('transactions')
            .select(`
                id,
                inventory_id,
                transaction_type,
                action,
                item_type_name,
                inventory_type_name,
                manufacturer,
                part_number,
                description,
                unit_of_measure,
                units_per_package,
                provider_name,
                category_name,
                mfgrSN,
                tilsonSN,
                from_location_name,
                from_location_type,
                to_location_name,
                to_location_type,
                assigned_crew_name,
                dfn_name,
                status_name,
                old_status_name,
                quantity,
                old_quantity,
                user_name,
                date_time,
                session_id,
                notes,
                ip_address,
                user_agent,
                before_state,
                after_state
            `)
            .order('date_time', { ascending: false });

        if (txError) {
            throw new Error(`Failed to fetch transactions: ${txError.message}`);
        }

        if (transactions && transactions.length > 0) {
            const wsTx = XLSX.utils.json_to_sheet(transactions);

            // Optionally set column widths for readability
            wsTx['!cols'] = Object.keys(transactions[0]).map(() => ({ wch: 18 }));

            XLSX.utils.book_append_sheet(wb, wsTx, 'Transactions');
        } else {
            console.log('No transaction records found for export.');
        }
    } catch (error) {
        console.error('❌ Error exporting transactions:', error);
        alert(`Export of transactions failed: ${error.message}`);
    }

    // Generate filename with current date
    const now = new Date();
    const dateStr = now.getFullYear() +
        String(now.getMonth() + 1).padStart(2, '0') +
        String(now.getDate()).padStart(2, '0') + '_' +
        String(now.getHours()).padStart(2, '0') +
        String(now.getMinutes()).padStart(2, '0');

    const filename = `Inventory_Export_${dateStr}.xlsx`;

    // Save the file
    XLSX.writeFile(wb, filename);

    // Show success message to user
    alert(`Inventory export completed successfully!\n\nFile: ${filename}\nRecords exported: \n\nLocation types included: Storage, Outgoing, Field, Install\nSorted by: Item → Location → DFN → Crew`);
};

// Initialize export functionality when the DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    // console.log('✅ Inventory export module loaded');
});
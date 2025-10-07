// ============================================================================
// --- Serialized Issue State ---
let serializedIssueState = 'idle'; // 'idle' | 'selecting' | 'confirming'
let selectedSerializedForIssue = [];

// Move buttonRequirements outside and before any function definitions
const buttonRequirements = {
    'receiveBtn': {
        basic: ['location_id', 'item_type_id'],
        serialized: ['mfgrsn', 'tilsonsn'],
        crew: false
    },
    'issueBtn': {
        basic: ['location_id', 'item_type_id'],
        serialized: ['mfgrsn', 'tilsonsn'],
        crew: true
    },
    'bulkReceiveBtn': {
        basic: ['location_id'],
        serialized: [],
        crew: false,
        bulk: true
    },
    'bulkIssueBtn': {
        basic: ['location_id'],
        serialized: [],
        crew: true,
        bulk: true
    }
};

// anon/public key for client-side access - REPLACE with your actual key
const supabaseUrl = 'https://jhvtntafqbhmuseqmwns.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpodnRudGFmcWJobXVzZXFtd25zIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk1NzM4NjQsImV4cCI6MjA3NTE0OTg2NH0.Gu6M3ewKrc1qv5tbpHd6CeFawRDQJnw5PYSrWK-QjWU';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);


async function testSupabaseAuth() {
    const { data, error } = await supabase.auth.signUp({
      email: 'user@email.com',
      password: 'your-password'
    });

    const { data: { user } } = await supabase.auth.getUser();
    // ...do something with user or error
    console.log(data, error, user);
}

//testSupabaseAuth();

// for error messages
function showError(message) {
    alert(message); // Or display in a custom error div if you prefer
}

function isUserLoggedIn() {
    return !!(window.currentUser && window.currentUser.id);
}

// Example: sign in
async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
    else alert('Logged in!');
}

// Example: sign out
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) alert(error.message);
    else alert('Logged out!');
}

// ============================================================================
// --- Lookup Table Cache ---
const LOOKUP_TABLES = [
    'action_statuses', 'categories', 'inv_action_types', 'inventory_providers',
    'inventory_types', 'item_types', 'location_types', 'locations', 'statuses', 'units_of_measure',
    'crews', 'dfns', 'clients'
];

window.lookupCache = {}; // { tableName: [rows...] }

/**
 * Load all lookup tables into cache (call once at app startup)
 */
async function cacheLookupTables() {

    if (!isUserLoggedIn()) {
        console.warn('User not logged in. Skipping Supabase call.');
        return;
    }
    for (const table of LOOKUP_TABLES) {
        const { data, error } = await supabase.from(table).select('*');
        window.lookupCache[table] = error ? [] : (data || []);
    }
}

/**
 * Get all rows for a cached table
 */
function getCachedTable(tableName) {
    return window.lookupCache[tableName] || [];
}

/**
 * Get a row by primary key from a cached table
 */
function getCachedRow(tableName, id) {
    return (window.lookupCache[tableName] || []).find(row => row.id == id) || null;
}

/**
 * Get a row by a specific field value from a cached table
 */
function getCachedRowByField(tableName, field, value) {
    return (window.lookupCache[tableName] || []).find(row => row[field] == value) || null;
}

// Expose globally
window.cacheLookupTables = cacheLookupTables;
window.getCachedTable = getCachedTable;
window.getCachedRow = getCachedRow;
window.getCachedRowByField = getCachedRowByField;


// ============================================================================
// TILSON SERIAL NUMBER UTILITY FUNCTIONS
// ============================================================================

/**
 * Get the current Tilson SN counter from config
 * @param {Object} database - Database instance
 * @returns {number} Current Tilson SN counter
 */
async function getCurrentTilsonSN() {
    try {
        const { data, error } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'currentTilsonSN')
            .single();
        if (error) throw error;
        if (data && data.value) {
            return parseInt(data.value) || 1;
        }
        return 1;
    } catch (error) {
        console.error('Error getting current Tilson SN:', error);
        return 1;
    }
}

/**
 * Generate a single Tilson SN with T- prefix and padding
 * @param {number} counter - The counter value
 * @returns {string} Formatted Tilson SN (e.g., "T-0001")
 */
function formatTilsonSN(counter) {
    return `T-${counter.toString().padStart(4, '0')}`;
}

/**
 * Generate sequential Tilson SNs for a batch
 * @param {Object} database - Database instance
 * @param {number} count - Number of SNs to generate
 * @returns {Array<string>} Array of formatted Tilson SNs
 */
async function generateTilsonSNs(count) {
    const startCounter = await getCurrentTilsonSN();
    const tilsonsns = [];
    for (let i = 0; i < count; i++) {
        tilsonsns.push(formatTilsonSN(startCounter + i));
    }
    return tilsonsns;
}

/**
 * Reserve Tilson SNs for a batch of manufacturer SNs
 * @param {Object} database - Database instance
 * @param {Array<string>} mfgrsns - Array of manufacturer serial numbers
 * @returns {Object} Map of mfgrsn -> tilsonsn pairs
 */
async function reserveTilsonSNs(mfgrsns) {
    const tilsonsns = await generateTilsonSNs(mfgrsns.length);
    const snPairs = {};
    mfgrsns.forEach((mfgrsn, index) => {
        snPairs[mfgrsn] = tilsonsns[index];
    });
    return snPairs;
}

/**
 * Update the Tilson SN counter after successful batch operation
 * @param {Object} database - Database instance
 * @param {number} count - Number of SNs that were used
 */
async function updateTilsonSNCounter(count) {
    try {
        const currentCounter = await getCurrentTilsonSN();
        const newCounter = currentCounter + count;
        const { error } = await supabase
            .from('config')
            .update({ value: newCounter.toString() })
            .eq('key', 'currentTilsonSN');
        if (error) throw error;
    } catch (error) {
        console.error('Error updating Tilson SN counter:', error);
        throw error;
    }
}

/**
 * Generate automatic Tilson SN for single item receiving
 * @param {Object} database - Database instance
 * @returns {string} Generated Tilson SN
 */
function generateAutoTilsonSN(database) {
    const counter = getCurrentTilsonSN(database);
    const tilsonsn = formatTilsonSN(counter);
    updateTilsonSNCounter(database, 1);
    return tilsonsn;
}

// ============================================================================
// INVENTORY INSERTION UTILITIES - Compartmentalized for reuse
// ============================================================================

/**
 * Get status ID from status name
 * @param {string} statusName - Status name (e.g., 'Received', 'Available')
 * @returns {number|null} - Status ID or null if not found
 */
function getStatusId(statusName) {
    const row = getCachedRowByField('statuses', 'name', statusName);
    return row ? row.id : null;
}

/**
 * Get or create the "With Crew" location for issued items
 * @returns {number} - Location ID of "With Crew" location
 */
function getWithCrewLocationId() {
    const row = getCachedRowByField('locations', 'name', 'With Crew');
    return row ? row.id : null;
}

/**
 * Get location ID by name
 * @param {string} locationName - Location name (e.g., 'With Crew', 'Field Installed')
 * @returns {number|null} - Location ID or null if not found
 */
function getLocationId(locationName) {
    const row = getCachedRowByField('locations', 'name', locationName);
    return row ? row.id : null;
}

/**
 * Validate inventory data before insertion
 * @param {Object} inventoryData - Inventory data object
 * @param {Object} itemTypeInfo - Item type information
 * @returns {Object} - {isValid: boolean, errors: string[]}
 */
function validateInventoryData(inventoryData, itemTypeInfo) {
    const errors = [];
    
    // Check required fields
    if (!inventoryData.location_id) {
        errors.push('Location is required');
    }
    if (!inventoryData.item_type_id) {
        errors.push('Item type is required');
    }
    if (!inventoryData.status_id) {
        errors.push('Status is required');
    }
    
    // Check serialized item requirements
    if (itemTypeInfo.isSerializedType) {
        if (!inventoryData.mfgrsn) {
            errors.push('Manufacturer Serial Number is required for serialized items');
        }
        if (!inventoryData.tilsonsn) {
            errors.push('Tilson Serial Number is required for serialized items');
        }
    }
    
    // Check quantity
    if (!inventoryData.quantity || inventoryData.quantity <= 0) {
        errors.push('Quantity must be greater than 0');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

/**
 * Prepare inventory data for database insertion
 * @param {Object} rawData - Raw form data or input data
 * @param {string} action - Action type ('receive', 'issue')
 * @returns {Object} - Prepared inventory data
 */
async function getItemTypeInfo(itemTypeId) {
    if (!isUserLoggedIn()) {
        console.warn('User not logged in. Skipping Supabase call.');
        return;
    }
    if (!itemTypeId) return { isSerializedType: false, unitsPerPackage: 1 };
    const { data, error } = await supabase
        .from('item_types')
        .select('units_per_package, inventory_type_id')
        .eq('id', itemTypeId)
        .eq('market_id', window.selectedMarketId)
        .single();
    if (error || !data) return { isSerializedType: false, unitsPerPackage: 1 };
    // Use cache for inventory_types
    const invType = getCachedRow('inventory_types', data.inventory_type_id);
    return {
        isSerializedType: invType && invType.name === 'Serialized',
        unitsPerPackage: data.units_per_package || 1
    };
}

/**
 * Insert a single inventory record

 * @param {Object} inventoryData - Prepared inventory data
 * @returns {Promise<Object>} - {success: boolean, error?: string, insertId?: number}
 */
async function insertInventoryRecord(inventoryData) {
    try {
        // Validate data before insertion
        const validation = validateInventoryData(inventoryData, inventoryData.itemTypeInfo);
        if (!validation.isValid) {
            return {
                success: false,
                error: 'Validation failed: ' + validation.errors.join(', ')
            };
        }
        // Prepare fields and values for insertion, excluding null values
        const insertData = {};
        ['location_id', 'assigned_crew_id', 'dfn_id', 'item_type_id', 'mfgrsn', 'tilsonsn', 'quantity', 'status_id', 'sloc_id'].forEach(field => {
            if (inventoryData[field] !== null && inventoryData[field] !== undefined && inventoryData[field] !== '') {
                insertData[field] = inventoryData[field];
            }
        });
        const { data, error } = await supabase
            .from('inventory')
            .insert([insertData])
            .select('id')
            .single();
        if (error) {
            return { success: false, error: error.message };
        }
        // Log transaction for inventory creation and wait for completion
        if (window.transactionLogger && data && data.id) {
            try {
                let logData = { ...inventoryData };
                if (inventoryData.batch_note) {
                    logData.notes = (logData.notes ? logData.notes + ' | ' : '') + `Batch Note: ${inventoryData.batch_note}`;
                }
                await window.transactionLogger.logInventoryCreated(data.id, logData);
            } catch (logError) {
                console.warn('Failed to log inventory creation transaction:', logError);
            }
        }
        // Update config with Tilson SN counter if serialized
        if (inventoryData.itemTypeInfo.isSerializedType && inventoryData.tilsonsn) {
            await supabase
                .from('config')
                .update({ value: inventoryData.tilsonsn.replace('T-', '') })
                .eq('key', 'last_tilson_sn');
            await updateTilsonSNCounter(1);
        }
        return {
            success: true,
            insertId: data.id || null
        };
    } catch (error) {
        console.error('Insert failed:', error.message);
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Insert multiple inventory records (for bulk operations)
 * @param {Array} inventoryDataArray - Array of prepared inventory data
 * @returns {Promise<Object>} - {success: boolean, results: Array, errors: Array}
 */
async function insertBulkInventoryRecords(inventoryDataArray) {
    const results = [];
    const errors = [];
    
    for (let index = 0; index < inventoryDataArray.length; index++) {
        const inventoryData = inventoryDataArray[index];
        const result = await insertInventoryRecord(inventoryData);
        if (result.success) {
            results.push({
                index: index,
                insertId: result.insertId,
                data: inventoryData
            });
        } else {
            errors.push({
                index: index,
                error: result.error,
                data: inventoryData
            });
        }
    }
    
    return {
        success: errors.length === 0,
        results: results,
        errors: errors,
        successCount: results.length,
        errorCount: errors.length
    };
}

/**
 * Complete inventory processing (insert + combine bulk + save)
 * @param {Object|Array} inventoryData - Single inventory data or array for bulk
 * @returns {Promise<Object>} - {success: boolean, error?: string}
 */
async function processInventoryInsertion(inventoryData, action) {

    console.log("Processing inventory insertion:", inventoryData);

    try {
        let result;
        console.log("inventoryData:", inventoryData);

        if (action === 'receive') {

            if (Array.isArray(inventoryData)) {
                // Bulk insertion
                result = await insertBulkInventoryRecords(inventoryData);
            } else {
                // Single insertion
                result = await insertInventoryRecord(inventoryData);
            }

        } else if (action === 'issue') {

            console.log("Processing inventory issuance...");

            // we've ensured that all issued quantities have corresponding available quantities.  We need to reduce the available quantities accordingly.
            if (Array.isArray(inventoryData)) {

                // multiple. use for each 
                console.log("batch issue called...");
                result = await reduceAvailableQuantityBatch(inventoryData);
            } else {
                // Single issuance
                console.log("single issue called...");
                result = await reduceAvailableQuantity(inventoryData, 1, 0);
            }

        }

        if (result.success) {
            // Combine bulk inventory and save database
            window.combineBulkInventory();
            
            // Return the full result including results array for bulk operations
            return {
                success: true,
                results: result.results || [result], // For single insertions, wrap in array
                successCount: result.successCount || 1,
                errorCount: result.errorCount || 0
            };
        } else {
            return { 
                success: false, 
                error: result.error,
                results: [],
                errors: result.errors || [result.error]
            };
        }

    } catch (error) {
        console.error('Process inventory insertion failed:', error);
        return { 
            success: false, 
            error: error.message,
            results: [],
            errors: [error.message]
        };
    }
}

// ============================================================================
// END INVENTORY INSERTION UTILITIES
// ============================================================================

// ============================================================================
// RECEIVE MULTIPLE BULK ITEMS UTILITIES
// ============================================================================

/**
 * Get all bulk item types
 * @returns {Array<Object>} - Array of bulk item types
 */
async function getBulkItemTypes() {
    if (!isUserLoggedIn()) {
        console.warn('User not logged in. Skipping Supabase call.');
        return;
    }
    const res = await supabase
        .from('item_types')
        .select(`
            id,
            name,
            description,
            part_number,
            categories(name),
            units_of_measure(name),
            inventory_providers(name)
        `)
        .eq('inventory_type_id', 1)
        .eq('market_id', window.selectedMarketId);

    if (!res.data) return [];

    return res.data.map(row => ({
        id: row.id,
        name: row.name,
        description: row.description,
        part_number: row.part_number,
        category: row.category || '',
        unit_of_measure: row.unit_of_measure || '',
        provider: row.provider || ''
    }));
}


/**
 * Get aggregated inventory quantities by status for bulk items
 * @param {number} itemTypeId - Item type ID
 * @returns {Object} - Object with status quantities
 */
async function getBulkInventoryAggregates(itemTypeId) {
    // Fetch all inventory rows for this item type and SLOC, including status name
    const { data, error } = await supabase
        .from('inventory')
        .select('quantity, statuses(name)')
        .eq('item_type_id', itemTypeId)
        .eq('sloc_id', window.selectedSlocId);

    const aggregates = {
        'Available': 0,
        'Issued': 0,
        'Installed': 0,
        'Rejected': 0,
    };

    if (error) {
        console.error('Supabase error:', error);
        return aggregates;
    }

    if (data && Array.isArray(data)) {
        data.forEach(row => {
            const status = row.statuses?.name;
            if (status && aggregates.hasOwnProperty(status)) {
                aggregates[status] += row.quantity || 0;
            }
        });
    }

    return aggregates;
}

/**
 * Generate bulk item types table
 * @returns {HTMLTableElement} - Generated table element
 */
async function generateBulkItemTypesTable() {
    const bulkItemTypes = await getBulkItemTypes();
    
    console.log("Generating bulk item types table with " + bulkItemTypes.length + " item types");

    // if the table already exists, delete the table first
    const existingTable = document.getElementById('bulkItemTypesMatrix');
    if (existingTable) {
        existingTable.remove();
    }
    
    const table = document.createElement('table');
    table.id = 'bulkItemTypesMatrix';
    table.style.marginTop = '20px';
    
    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    const headers = [
        'Available', 'Issued', 'Installed', 'Rejected', , 
        'Quantity', 'Item', 'Description', 'Mfgr Part #', 'Category', 'Unit of Measure', 'Provider'
    ];
    
    headers.forEach(header => {
        const th = document.createElement('th');
        th.textContent = header;
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create body
    const tbody = document.createElement('tbody');

    bulkItemTypes.forEach(itemType => {
        const row = document.createElement('tr');
        row.dataset.itemTypeId = itemType.id;
        
        // Status quantity columns first
        const aggregates = getBulkInventoryAggregates(itemType.id);
        ['Available', 'Issued', 'Installed', 'Rejected'].forEach(status => {
            const statusCell = document.createElement('td');
            statusCell.textContent = formatNumberWithCommas(aggregates[status]);
            statusCell.style.textAlign = 'center';
            row.appendChild(statusCell);
        });
        
        // Quantity input column
        const quantityCell = document.createElement('td');
        const quantityInput = document.createElement('input');
        quantityInput.type = 'number';
        quantityInput.min = '0';
        quantityInput.step = '1';
        quantityInput.placeholder = '0';
        quantityInput.name = `quantity_${itemType.id}`;
        quantityInput.className = 'bulk-quantity-input';
        quantityInput.style.width = '80px';
        quantityInput.disabled = true;
        
        quantityInput.addEventListener('focus', function() {
            // when input is focused, select the text within the input
            this.select();
        });

        // Add event listener for quantity validation
        quantityInput.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, ''); // Only allow digits

            // if user is using the bulk receive process or bulk issue process
            if ($('.bulk-manage-container').hasClass('inBulkReceiveMode')) {
                // Handle bulk receive specific logic
                let errors = evaluateBulkReceiveQuantities();
                updateBulkButtonProcessStates(errors);

            } else if ($('.bulk-manage-container').hasClass('inBulkIssueMode')) {
                // Handle bulk issue specific logic
                let errors = evaluateBulkIssueQuantities();
                updateBulkButtonProcessStates(errors);

            }

        });

        updateBulkButtonStates();

        
        quantityCell.appendChild(quantityInput);
        row.appendChild(quantityCell);
        
        // Item type info columns after quantity
        const itemTypeCell = document.createElement('td');
        itemTypeCell.textContent = itemType.name;
        itemTypeCell.className = 'bulk-item-name-cell';
        row.appendChild(itemTypeCell);
        
        const descriptionCell = document.createElement('td');
        descriptionCell.textContent = itemType.description;
        row.appendChild(descriptionCell);
        
        const mfgrPartCell = document.createElement('td');
        mfgrPartCell.textContent = itemType.part_number;
        row.appendChild(mfgrPartCell);
        
        const categoryCell = document.createElement('td');
        categoryCell.textContent = itemType.category;
        row.appendChild(categoryCell);
        
        const unitCell = document.createElement('td');
        unitCell.textContent = itemType.unit_of_measure;
        row.appendChild(unitCell);
        
        const providerCell = document.createElement('td');
        providerCell.textContent = itemType.provider;
        row.appendChild(providerCell);
        
        tbody.appendChild(row);
    });
    
    table.appendChild(tbody);

    return table;
}

/**
 * Get bulk inventory data from the form
 * @returns {Array<Object>} - Array of inventory items to process
 */
function getBulkInventoryData() {

    const form = document.getElementById('bulkReceiveForm');
    const bulkIssueForm = document.getElementById('bulkIssueForm');

    let assignedCrewId = null;
    let dfnId = null;

    const formData = new FormData(form);
    const inventoryItems = [];
    
    // if using bulk issue form, get the assigned crew and dfn from that dropdowns
    if ($('.bulk-manage-container').hasClass('inBulkIssueMode')) {
        assignedCrewId = bulkIssueForm.querySelector('#bulk_issue_assigned_crew_id').value;
        dfnId = bulkIssueForm.querySelector('#bulk_issue_dfn_id').value;
    } else {
        assignedCrewId = formData.get('assigned_crew_id');
        dfnId = formData.get('dfn_id');
    }


    const quantityInputs = document.querySelectorAll('.bulk-quantity-input');
    
    quantityInputs.forEach(input => {
        const quantity = parseInt(input.value, 10) || 0;
        if (quantity > 0) {
            const itemTypeId = input.name.replace('quantity_', '');
            inventoryItems.push({
                location_id: formData.get('location_id'),
                assigned_crew_id: assignedCrewId || null,
                dfn_id: dfnId || null,
                item_type_id: itemTypeId,
                quantity: quantity,
                batch_note: formData.get('batch_note') || null
            });
        }
    });
    
    return inventoryItems;
}

function addBulkInventorySearchBar() {
    // Insert search bar above the table
    const table = document.getElementById('bulkItemTypesMatrix');
    if (!table) return;
    let searchDiv = document.getElementById('bulkInventorySearchDiv');
    if (!searchDiv) {
        searchDiv = document.createElement('div');
        searchDiv.id = 'bulkInventorySearchDiv';
        searchDiv.style.marginBottom = '8px';
        searchDiv.innerHTML = `
            <input type="text" id="bulkInventorySearchInput" placeholder="Search items..." style="width: 250px; padding: 4px;">
        `;
        table.parentNode.insertBefore(searchDiv, table);
    }

    const searchInput = document.getElementById('bulkInventorySearchInput');
    searchInput.addEventListener('input', function() {
        const filter = this.value.trim().toLowerCase();
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const nameCell = row.querySelector('.bulk-item-name-cell');
            const descriptionCell = row.children[7]; // Description column
            const mfgrPartCell = row.children[8];    // Mfgr Part # column
            const categoryCell = row.children[9];    // Category column
            const input = row.querySelector('.bulk-quantity-input');
            const qty = input ? parseInt(input.value) || 0 : 0;

            // Gather all searchable text
            const text = [
                nameCell ? nameCell.textContent : '',
                descriptionCell ? descriptionCell.textContent : '',
                mfgrPartCell ? mfgrPartCell.textContent : '',
                categoryCell ? categoryCell.textContent : ''
            ].join(' ').toLowerCase();

            // Remove previous search class
            row.classList.remove('hidden-by-search');

            if (qty > 0) {
                // Always show, gray out text except input
                row.querySelectorAll('td').forEach(td => {
                    if (!td.contains(input)) {
                        td.style.color = 'gray';
                    } else {
                        input.style.color = '';
                    }
                });
            } else if (text.includes(filter)) {
                // Show and normal color
                row.querySelectorAll('td').forEach(td => td.style.color = '');
            } else {
                // Hide by search
                row.classList.add('hidden-by-search');
            }
        });
    });
}


/**
 * Process bulk inventory insertion
 * @param {string} action - Action type ('receive', 'issue')
 * @returns {Promise<void>}
 */
async function processBulkInventoryInsertion(action) {
    console.log(`Processing bulk inventory ${action}...`);
    try {
        const inventoryItems = getBulkInventoryData();
        
        if (inventoryItems.length === 0) {
            alert('Please enter quantities for at least one item type.');
            return;
        }
        
        // Prepare inventory data for each item
        const preparedData = await Promise.all(inventoryItems.map(item => prepareInventoryData(item, action)));
        
        // Process bulk insertion
        console.log("preparedData:", preparedData);
        const result = await processInventoryInsertion(preparedData, action);
        console.log("result: ", result);
        if (result.success) {
            console.log(`Successfully processed ${result.results.length} bulk inventory items`);
            
            // Clear quantity inputs
            document.querySelectorAll('.bulk-quantity-input').forEach(input => {
                input.value = '';
            });

            // Reset the process buttons:
            resetBulkReceiveAndIssueProcessForms();

            // Refresh the bulk table
            refreshBulkItemTypesTable();
            
            // Refresh the inventory list
            loadInventoryList();
            
            // Update button states
            updateBulkButtonStates();

            
            //alert(`Bulk ${action} completed! ${result.results.length} items processed successfully.`);
        } else {
            console.error('Bulk inventory processing failed:', result.error);
            alert('Bulk inventory processing failed: ' + result.error);
        }
        
    } catch (error) {
        console.error('Error in bulk inventory processing:', error);
        alert('Error in bulk inventory processing: ' + error.message);
    }

        
}

/**
 * Refresh the bulk item types table
 */
async function refreshBulkItemTypesTable(createTable = true) {
    console.log("Refreshing bulk item types table...");

    if(createTable === true){
        const tableContainer = document.getElementById('bulkItemTypesTable');
        const existingTable = tableContainer.querySelector('#bulkItemTypesMatrix');
        if (existingTable) {
            existingTable.remove();

            // if selectedMarketId is not set, do not attempt to regenerate the table
            if (!window.selectedMarketId) {
                console.warn("selectedMarketId is not set. Skipping bulk item types table regeneration.");
                return;
            }

        }
        const newTable = await generateBulkItemTypesTable();
        tableContainer.appendChild(newTable);

        setTimeout(addBulkInventorySearchBar, 0);

        // Re-apply availability filter if in issue mode
        if ($('.bulk-manage-container').hasClass('inBulkIssueMode')) {
            filterBulkIssueRowsByAvailability(true);
        }
    }
    else{
        // remove any existing table and search filter values:
        const tableContainer = document.getElementById('bulkItemTypesTable');
        const existingTable = tableContainer.querySelector('#bulkItemTypesMatrix');
        if (existingTable) {
            existingTable.remove();
        }
        // Clear search filter values
        const searchInputs = tableContainer.querySelectorAll('.bulk-item-search-input');
        searchInputs.forEach(input => {
            input.value = '';
        });
    }


}

/**
 * Update bulk button states based on form values
 */
function updateBulkButtonStates() {
    const form = document.getElementById('bulkReceiveForm');
    const quantityInputs = document.querySelectorAll('.bulk-quantity-input');
    const location = 1;

    console.log("assignedCrewID: " + form.querySelector('select[id="bulk_assigned_crew_id"]').value);

    const crew = form.querySelector('select[id="bulk_assigned_crew_id"]').value;

    // Check if any quantity is entered
    const hasQuantity = Array.from(quantityInputs).some(input => {
        const qty = parseInt(input.value, 10) || 0;
        return qty > 0;
    });
    
    // Get button references
    const bulkReceiveBtn = document.getElementById('bulkItemReceiveBtn');
    const bulkIssueBtn = document.getElementById('bulkItemIssueBtn');
    
    // Base requirement: location and at least one quantity
    const baseRequired = hasQuantity;
    
    // If a crew is selected, disable Receive
    if (crew) {
        bulkReceiveBtn.disabled = true;
    } else {
        bulkReceiveBtn.disabled = !baseRequired;
    }
    
    bulkIssueBtn.disabled = !(baseRequired && crew);
    
    // Button appearance is handled by CSS classes automatically via :disabled pseudo-class
}

/**
 * Load and display both serialized and bulk inventory lists
 */
async function loadInventoryList(loadIt = true) {
    if (!loadIt) return;
    console.log("Loading inventory lists...");
    await Promise.all([
        loadSerializedInventoryList(),
        loadBulkInventoryList()
    ]);
}

/**
 * Load and display serialized inventory in hierarchical format (items with serial numbers)
 */
async function loadSerializedInventoryList() {
    if (!isUserLoggedIn()) {
        console.warn('User not logged in. Skipping Supabase call.');
        return;
    }
    if (!window.selectedSlocId) {
        console.warn('No SLOC selected. Skipping serialized inventory query.');
        return;
    }
    try {
        const inventorySection = document.getElementById('serializedInventorySection');
        if (!inventorySection) return;

        // Clear the existing hierarchy
        const existingHierarchy = inventorySection.querySelector('#serializedInventoryHierarchy');
        if (existingHierarchy) {
            existingHierarchy.innerHTML = '';
        }

        // Get current sort configuration
        const orderBy = getInventoryOrderBy();
        console.log("orderBy: ", orderBy);
        // Supabase query with joins
        const { data, error } = await supabase
            .from('inventory')
            .select(`
                id,
                location_id,
                status_id,
                item_type_id,
                mfgrsn,
                tilsonsn,
                quantity,
                locations(name, location_types(name)),
                crews(name),
                dfns(name),
                item_types(name, categories(name, id)),
                statuses(name)
            `)
            .eq('sloc_id', window.selectedSlocId)
            .not('mfgrsn', 'is', null)
            .not('mfgrsn', 'eq', '')
            .order(orderBy.column, { ascending: orderBy.direction === 'ASC' });

        if (error) {
            console.error('Supabase error:', error);
            showError('Failed to load serialized inventory: ' + error.message);
            return;
        }

        // Filter out statuses 'Installed' and 'Removed' and location type 'Outgoing'
        const filtered = (data || []).filter(row =>
            row.statuses?.name !== 'Installed' &&
            row.statuses?.name !== 'Removed' &&
            (!row.locations?.location_types || row.locations.location_types.name !== 'Outgoing')
        );

        // Map to match your original structure
        const mapped = filtered.map(row => ({
            id: row.id,
            location_id: row.location_id,
            status_id: row.status_id,
            item_type_id: row.item_type_id,
            location_name: row.locations?.name || '',
            crew_name: row.crews?.name || '',
            dfn_name: row.dfns?.name || '',
            item_name: row.item_types?.name || '',
            category_name: row.item_types?.categories?.name || '',
            category_id: row.item_types?.categories?.id || '',
            mfgrsn: row.mfgrsn,
            tilsonsn: row.tilsonsn,
            quantity: row.quantity,
            status_name: row.statuses?.name || ''
        }));

        // Create hierarchical structure
        await createSerializedInventoryHierarchy(mapped);
        console.log(`Loaded ${mapped.length} serialized inventory items in hierarchy`);

    } catch (error) {
        console.error('Error loading serialized inventory:', error);
        showError('Failed to load serialized inventory: ' + error.message);
    }
}



/**
 * Create hierarchical display for serialized inventory
 */
async function createSerializedInventoryHierarchy(data) {
    const hierarchyContainer = document.getElementById('serializedInventoryHierarchy');
    if (!hierarchyContainer) return;
    
    hierarchyContainer.innerHTML = '';
    
    if (data.length === 0) {
        hierarchyContainer.innerHTML = '<div style="text-align: center; padding: 20px; color: #666;">No serialized inventory items found</div>';
        return;
    }
    
    // Group data by category, then by item type
    const grouped = {};
    
    data.forEach(item => {
        const categoryName = item.category_name || 'Uncategorized';
        const itemName = item.item_name || 'Unknown Item';
        
        if (!grouped[categoryName]) {
            grouped[categoryName] = {};
        }
        
        if (!grouped[categoryName][itemName]) {
            grouped[categoryName][itemName] = [];
        }
        
        grouped[categoryName][itemName].push(item);
    });
    
    // Create hierarchy structure
    Object.keys(grouped).sort().forEach(categoryName => {
        const categoryDiv = document.createElement('div');
        categoryDiv.className = 'inventory-category-group';
        
        // Category header
        const categoryHeader = document.createElement('div');
        categoryHeader.className = 'inventory-category-header';
        categoryHeader.innerHTML = `
            <span class="category-toggle">▼</span>
            <strong>${categoryName}</strong>
            <span class="category-count">(${Object.values(grouped[categoryName]).reduce((sum, items) => sum + items.length, 0)} items)</span>
        `;
        
        const categoryContent = document.createElement('div');
        categoryContent.className = 'inventory-category-content';
        
        // Create item type groups within category
        Object.keys(grouped[categoryName]).sort().forEach(itemName => {
            const itemTypeDiv = document.createElement('div');
            itemTypeDiv.className = 'inventory-item-type-group';
            
            // Item type header
            const itemTypeHeader = document.createElement('div');
            itemTypeHeader.className = 'inventory-item-type-header';
            itemTypeHeader.innerHTML = `
                <span class="item-type-toggle">▼</span>
                <span class="item-type-name">${itemName}</span>
                <span class="item-type-count">(${grouped[categoryName][itemName].length} units)</span>
            `;
            
            // Item type content with individual items
            const itemTypeContent = document.createElement('div');
            itemTypeContent.className = 'inventory-item-type-content';
            
            // Create table for items
            const table = document.createElement('table');
            table.className = 'inventory-items-table';
            
            const thead = document.createElement('thead');
            thead.innerHTML = `
                <tr>
                    <th>Location</th>
                    <th>Crew</th>
                    <th>DFN</th>
                    <th>Mfgr. SN</th>
                    <th>Tilson SN</th>
                    <th>Quantity</th>
                    <th>Status</th>
                </tr>
            `;
            table.appendChild(thead);
            
            const tbody = document.createElement('tbody');
            
            grouped[categoryName][itemName].forEach(item => {
                const row = document.createElement('tr');
   
                row.className = 'inventory-item-row';
                row.dataset.inventoryId = item.id;
                row.dataset.locationId = item.location_id;
                row.dataset.crewId = item.crew_id;
                row.dataset.dfnId = item.dfn_id;
                row.dataset.quantity = item.quantity;
                row.dataset.statusId = item.status_id;
                row.dataset.itemTypeId = item.item_type_id;
                row.dataset.status = item.status_name || ''; // Add status name for styling
                
                row.innerHTML = `
                    <td>${item.location_name || ''}</td>
                    <td>${item.crew_name || ''}</td>
                    <td>${item.dfn_name || ''}</td>
                    <td>${item.mfgrsn || ''}</td>
                    <td>${item.tilsonsn || ''}</td>
                    <td>${item.quantity || ''}</td>
                    <td>${item.status_name || ''}</td>
                `;
                
                // Add mouse click functionality (similar to bulk inventory)
                row.addEventListener('click', (event) => {
                        handleInventoryRowClick(row, event);
                });
                
                // Make row look clickable
                row.style.cursor = 'pointer';
                
                tbody.appendChild(row);
            });
            
            table.appendChild(tbody);
            itemTypeContent.appendChild(table);
            
            itemTypeDiv.appendChild(itemTypeHeader);
            itemTypeDiv.appendChild(itemTypeContent);
            categoryContent.appendChild(itemTypeDiv);
            
            // Add toggle functionality for item types
            itemTypeHeader.addEventListener('click', () => {
                const toggle = itemTypeHeader.querySelector('.item-type-toggle');
                const content = itemTypeContent;
                
                if (content.style.display === 'none') {
                    content.style.display = 'block';
                    toggle.textContent = '▼';
                } else {
                    content.style.display = 'none';
                    toggle.textContent = '▶';
                }
            });
        });
        
        categoryDiv.appendChild(categoryHeader);
        categoryDiv.appendChild(categoryContent);
        hierarchyContainer.appendChild(categoryDiv);
        
        // Add toggle functionality for categories
        categoryHeader.addEventListener('click', () => {
            const toggle = categoryHeader.querySelector('.category-toggle');
            const content = categoryContent;
            
            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                content.style.display = 'none';
                toggle.textContent = '▶';
            }
        });
    });
}

/**
 * Load and display bulk inventory (items without serial numbers)
 */
async function loadBulkInventoryList() {
    if (!isUserLoggedIn()) {
        console.warn('User not logged in. Skipping Supabase call.');
        return;
    }
    if (!window.selectedSlocId) {
        console.warn('No SLOC selected. Skipping bulk inventory query.');
        return;
    }
    try {
        const inventorySection = document.getElementById('bulkInventorySection');
        if (!inventorySection) return;

        // Clear the existing table
        const existingTable = inventorySection.querySelector('#bulkInventoryTable');
        if (existingTable) {
            existingTable.remove();

            // If selectedSlocId is not set, do not attempt to regenerate the table
            if (!window.selectedSlocId || window.selectedMarketId === null) {
                console.warn("selectedSlocId or selectedMarketId is not set. Skipping bulk inventory table regeneration.");
                return;
            }
        }

        // Get current sort configuration
        const orderBy = getInventoryOrderBy();
        console.log("orderBy: ", orderBy);
        // Supabase query with joins
        const { data, error } = await supabase
            .from('inventory')
            .select(`
                id,
                location_id,
                status_id,
                item_type_id,
                mfgrsn,
                tilsonsn,
                quantity,
                locations(name),
                crews(name),
                dfns(name),
                item_types(name, categories(name)),
                statuses(name)
            `)
            .eq('sloc_id', window.selectedSlocId)
            .or('mfgrsn.is.null,mfgrsn.eq.""') // Only bulk items (no serial number)
            .order(orderBy.column, { ascending: orderBy.direction === 'ASC' });

        if (error) {
            console.error('Supabase error:', error);
            showError('Failed to load bulk inventory: ' + error.message);
            return;
        }

        // Filter out statuses 'Installed' and 'Removed'
        const filtered = (data || []).filter(row =>
            row.statuses?.name !== 'Installed' &&
            row.statuses?.name !== 'Removed'
        );

        // Map to match your original structure
        const mapped = filtered.map(row => ({
            id: row.id,
            location_id: row.location_id,
            status_id: row.status_id,
            item_type_id: row.item_type_id,
            location_name: row.locations?.name || '',
            crew_name: row.crews?.name || '',
            dfn_name: row.dfns?.name || '',
            item_name: row.item_types?.name || '',
            category_name: row.item_types?.categories?.name || '',
            mfgrsn: row.mfgrsn,
            tilsonsn: row.tilsonsn,
            quantity: row.quantity,
            status_name: row.statuses?.name || ''
        }));

        // Create the table and populate it
        const table = createInventoryTable('bulkInventoryTable', 'bulk');
        inventorySection.appendChild(table);
        populateInventoryTable(mapped, 'bulkInventoryBody', 'bulk');
        //console.log(`Loaded ${mapped.length} bulk inventory items`);

    } catch (error) {
        console.error('Error loading bulk inventory:', error);
        showError('Failed to load bulk inventory: ' + error.message);
    }
}

/**
 * Create an inventory table with specified ID and type
 */
function createInventoryTable(tableId, inventoryType) {
    const table = document.createElement('table');
    table.id = tableId;
    table.className = 'table table-striped';
    
    // Create header with sortable columns
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    
    // Column configurations based on inventory type
    let columns;
    if (inventoryType === 'serialized') {
        columns = [
            ['Location', 'l.name'],
            ['Crew', 'c.name'],
            ['DFN', 'd.name'],
            ['Item', 'it.name'],
            ['Category', 'cat.name'],
            ['Mfgr. SN', 'i.mfgrsn'],
            ['Tilson SN', 'i.tilsonsn'],
            ['Status', 's.name'],
            ['Actions', null]
        ];
    } else {
        columns = [
            ['Location', 'l.name'],
            ['Crew', 'c.name'],
            ['DFN', 'd.name'],
            ['Item', 'it.name'],
            ['Category', 'cat.name'],
            ['Quantity', 'i.quantity'],
            ['Status', 's.name']
        ];
    }
    
    const currentSort = getInventorySortconfig();
    
    columns.forEach(([displayName, columnName]) => {
        const th = document.createElement('th');
        if (columnName) {
            th.className = 'sortable-header';
            
            // Create the header content with arrows
            const headerContent = document.createElement('div');
            headerContent.className = 'header-content';
            
            const headerText = document.createElement('span');
            headerText.textContent = displayName;
            headerContent.appendChild(headerText);
            
            const arrowContainer = document.createElement('div');
            arrowContainer.className = 'sort-arrows';
            
            // Up arrow
            const upArrow = document.createElement('span');
            upArrow.innerHTML = '▲';
            upArrow.className = 'sort-arrow';
            upArrow.classList.add(
                (currentSort.column === columnName && currentSort.direction === 'ASC') ? 'active' : 'inactive'
            );
            
            // Down arrow
            const downArrow = document.createElement('span');
            downArrow.innerHTML = '▼';
            downArrow.className = 'sort-arrow';
            downArrow.classList.add(
                (currentSort.column === columnName && currentSort.direction === 'DESC') ? 'active' : 'inactive'
            );
            
            arrowContainer.appendChild(upArrow);
            arrowContainer.appendChild(downArrow);
            headerContent.appendChild(arrowContainer);
            
            th.appendChild(headerContent);
            
            // Add click event to trigger sorting
            th.addEventListener('click', () => {
                if (currentSort.column === columnName) {
                    // Same column clicked, toggle direction
                    currentSort.direction = currentSort.direction === 'ASC' ? 'DESC' : 'ASC';
                } else {
                    // Different column clicked, set to ASC
                    currentSort.column = columnName;
                    currentSort.direction = 'ASC';
                }
                
                // Store new sort configuration
                setInventorySortconfig(currentSort.column, currentSort.direction);
                
                // Reload the inventory
                loadInventoryList();
            });
        } else {
            th.textContent = displayName;
        }
        
        headerRow.appendChild(th);
    });
    
    thead.appendChild(headerRow);
    table.appendChild(thead);
    
    // Create tbody
    const tbody = document.createElement('tbody');
    tbody.id = inventoryType === 'serialized' ? 'serializedInventoryBody' : 'bulkInventoryBody';
    table.appendChild(tbody);
    
    return table;
}

/**
 * Populate an inventory table with data
 */
function populateInventoryTable(data, tbodyId, inventoryType) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    if (data.length === 0) {
        const colspan = inventoryType === 'serialized' ? 9 : 7;
        tbody.innerHTML = `<tr><td colspan="${colspan}" style="text-align: center; padding: 20px; color: #666;">No ${inventoryType} inventory items found</td></tr>`;
        return;
    }
    
    data.forEach(item => {
        const row = document.createElement('tr');
        
        // Add data attributes for row functionality
        row.dataset.inventoryId = item.id;
        row.dataset.locationId = item.location_id;
        row.dataset.statusId = item.status_id;
        row.dataset.itemTypeId = item.item_type_id;
        row.dataset.status = item.status_name || '';  // Add status name for CSS styling
        
        if (inventoryType === 'serialized') {
            row.innerHTML = `
                <td>${item.location_name || ''}</td>
                <td>${item.crew_name || ''}</td>
                <td>${item.dfn_name || ''}</td>
                <td>${item.item_name || ''}</td>
                <td>${item.category_name || ''}</td>
                <td>${item.mfgrsn || ''}</td>
                <td>${item.tilsonsn || ''}</td>
                <td>${item.status_name || ''}</td>
            `;
        } else {
            // Bulk inventory without Actions column, but with mouse click functionality
            row.innerHTML = `
                <td>${item.location_name || ''}</td>
                <td>${item.crew_name || ''}</td>
                <td>${item.dfn_name || ''}</td>
                <td>${item.item_name || ''}</td>
                <td>${item.category_name || ''}</td>
                <td>${formatNumberWithCommas(item.quantity || 0)}</td>
                <td>${item.status_name || ''}</td>
            `;
            
            // Add mouse down event for bulk inventory rows
            row.style.cursor = 'pointer';
            row.addEventListener('mousedown', (event) => {
                handleInventoryRowClick(row, event);
            });
        }
        
        tbody.appendChild(row);
    });
}

/**
 * Format number with commas for thousands separator
 * @param {number} num - Number to format
 * @returns {string} Formatted number string
 */
function formatNumberWithCommas(num) {
    if (num === null || num === undefined || num === 0) return '';
    return Number(num).toLocaleString();
}


/**
 * Get the current sort configuration from localStorage (per user)
 * @returns {Object} - {column: string, direction: 'ASC'|'DESC'}
 */
function getInventorySortconfig() {
    let config = null;
    try {
        const raw = localStorage.getItem('inventory_sort_config');
        if (raw) config = JSON.parse(raw);
    } catch (e) {
        console.warn('Could not parse inventory_sort_config from localStorage:', e);
    }
    // If not set, use default sort by id ascending
    if (!config || !config.column || !config.direction) {
        return { column: "id", direction: "ASC" };
    }
    return config;
}

/**
 * Save the sort configuration to config table
 * @param {string} column - Column to sort by
 * @param {string} direction - 'ASC' or 'DESC'
 */
async function saveInventorySortconfig(column, direction) {
    try {
        const config = JSON.stringify({ column, direction });
        const { error } = await supabase
            .from('config')
            .upsert([
                { key: 'inventory_sort', value: config }
            ], { onConflict: ['key'] });
        if (error) {
            console.error('Supabase error saving sort config:', error);
        }
    } catch (error) {
        console.error('Error saving sort config:', error);
    }
}

/**
 * Save the sort configuration to localStorage (per user)
 * @param {string} column - Column to sort by
 * @param {string} direction - 'ASC' or 'DESC'
 */
function setInventorySortconfig(column, direction) {
    try {
        const config = JSON.stringify({ column, direction });
        localStorage.setItem('inventory_sort_config', config);
    } catch (e) {
        console.error('Error saving inventory_sort_config to localStorage:', e);
    }
}

/**
 * Refresh all tables on the page after database changes
 */
function refreshAllTables() {
    console.log("Refreshing all tables...");
    try {

        // if a SLOC is selected, reload the inventory lists
        if (window.selectedSlocId  && window.selectedMarketId) {
            loadInventoryList();
            refreshBulkItemTypesTable();
        }
        else{
            // if no SLOC is selected, just clear the inventory lists and bulk table
            loadInventoryList(false);
            refreshBulkItemTypesTable(false);
        }


    } catch (error) {
        console.error('Error refreshing tables:', error);
    }
}

window.refreshDropdowns = function() {
    // Reload lookups from cached tables
    const updatedLookups = {
        location_id: getCachedTable('locations').map(row => [row.id, row.name]),
        assigned_crew_id: getCachedTable('crews').filter(row => row.market_id == window.selectedMarketId).map(row => [row.id, row.name]),
        dfn_id: getCachedTable('dfns').filter(row => row.sloc_id == window.selectedSlocId).map(row => [row.id, row.name]),
        item_type_id: getCachedTable('item_types').filter(row => row.market_id == window.selectedMarketId).map(row => [row.id, row.name]),
        status_id: getCachedTable('statuses').map(row => [row.id, row.name])
    };

    // Clear and repopulate all dropdowns except bulkSerializedItemType
    ['location_id', 'assigned_crew_id', 'dfn_id', 'item_type_id'].forEach(field => {
        const selects = document.querySelectorAll(`select[name="${field}"]:not(#bulkSerializedItemType)`);
        selects.forEach(select => {
            if (select && updatedLookups[field] && Array.isArray(updatedLookups[field])) {
                const currentValue = select.value;
                // Clear existing options
                select.innerHTML = '';
                // Add default placeholder
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = `Select ${field.replace('_id', '').replace('_', ' ')}`;
                select.appendChild(defaultOption);
                // Add new options
                updatedLookups[field].forEach(([id, label]) => {
                    const option = document.createElement('option');
                    option.value = id;
                    option.textContent = label || id;
                    select.appendChild(option);
                });
                // Restore value if it still exists
                if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
                    select.value = currentValue;
                }
            }
        });
    });

    // Refresh bulk receive crew dropdown
    const bulkCrewSelect = document.getElementById('bulk_assigned_crew_id');
    if (bulkCrewSelect && updatedLookups.assigned_crew_id && Array.isArray(updatedLookups.assigned_crew_id)) {
        const currentValue = bulkCrewSelect.value;
        bulkCrewSelect.innerHTML = '<option value="">Select Crew</option>';
        updatedLookups.assigned_crew_id.forEach(([id, label]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = label || id;
            bulkCrewSelect.appendChild(option);
        });
        if (currentValue && bulkCrewSelect.querySelector(`option[value="${currentValue}"]`)) {
            bulkCrewSelect.value = currentValue;
        }
    }

    // Refresh bulk receive DFN dropdown
    const bulkDfnSelect = document.getElementById('bulk_dfn_id');
    if (bulkDfnSelect && updatedLookups.dfn_id && Array.isArray(updatedLookups.dfn_id)) {
        const currentValue = bulkDfnSelect.value;
        bulkDfnSelect.innerHTML = '<option value="">Select DFN</option>';
        updatedLookups.dfn_id.forEach(([id, label]) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = label || id;
            bulkDfnSelect.appendChild(option);
        });
        if (currentValue && bulkDfnSelect.querySelector(`option[value="${currentValue}"]`)) {
            bulkDfnSelect.value = currentValue;
        }
    }
};

/**
 * Get the column and direction for Supabase .order() call
 * @returns {Object} - {column: string, direction: 'ASC'|'DESC'}
 */
function getInventoryOrderBy() {
    const config = getInventorySortconfig();
    if (config && config.column && config.direction) {
        return { column: config.column, direction: config.direction };
    }
    // Default: sort by id ascending
    return { column: "id", direction: "ASC" };
}


function resetSerializedIssueProcess() {
    serializedIssueState = 'idle';
    selectedSerializedForIssue = [];
    document.getElementById('serializedIssueSelectionInstructions').style.display = 'none';
    document.getElementById('completeSerializedIssueBtn').style.display = 'none';
    document.getElementById('cancelSerializedIssueBtn').style.display = 'none';
    updateSelectedSerializedForIssueDisplay();
    updateSerializedIssueButtons();
    document.querySelectorAll('.inventory-item-row').forEach(row => {
        row.classList.remove('selectable-for-issue', 'selected-for-issue');
        row.style.display = ""; // Reset any display:none from search filtering
    });
}



// ============================================================================
// END RECEIVE MULTIPLE BULK ITEMS UTILITIES
// ============================================================================

// Event listener for DOM content loaded
document.addEventListener('DOMContentLoaded', async () => {
    // Minimal setup: login/logout listeners
    document.getElementById('login-button').addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            document.getElementById('login-error').textContent = error.message;
        } else {
            document.getElementById('login-container').style.display = 'none';
            document.getElementById('app-content').style.display = '';
            location.reload();
        }
    });

    document.getElementById('logout-button').addEventListener('click', async () => {
        await supabase.auth.signOut();
        location.reload();
    });

    // Check login status and run full initialization only if logged in
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-content').style.display = '';
        window.currentUser = {
            id: user.id,
            name: user.user_metadata?.full_name || user.email || 'Unknown User',
            email: user.email
        };

        // Wait for SLOC selection before running full initialization
        await initializeClientMarketSlocDropdowns();

        // Listen for SLOC selection changes
        const slocSelect = document.getElementById('slocSelect');
        if (slocSelect) {
            slocSelect.addEventListener('change', async function () {
                if (this.value) {
                    window.selectedSlocId = parseInt(this.value, 10);
                    await runFullInitialization();
                }
            });

            // If SLOC is already selected, run initialization immediately
            if (slocSelect.value) {
                window.selectedSlocId = parseInt(slocSelect.value, 10);
                await runFullInitialization();
            }
        }
    } else {
        document.getElementById('login-container').style.display = '';
        document.getElementById('app-content').style.display = 'none';
        window.currentUser = { id: null, name: 'Unknown User', email: '' };
    }

    // Sidebar navigation event listeners
    document.getElementById('viewInventoryBtn').addEventListener('click', async () => {
        setActiveSidebarButton('viewInventoryBtn');
        await showSections({serializedInventory: true, bulkInventory: true});
    });
    document.getElementById('viewTransactionHistoryBtn').addEventListener('click', () => {
        setActiveSidebarButton('viewTransactionHistoryBtn');
        window.open('transactionHistory.html', '_blank');
    });
    document.getElementById('receiveNavBtn').addEventListener('click', async () => {
        setActiveSidebarButton('receiveNavBtn');
        await showSections({inventoryReceiving: true});
    });
    document.getElementById('bulkReceiveNavBtn').addEventListener('click', async () => {
        setActiveSidebarButton('bulkReceiveNavBtn');
        await showSections({bulkReceive: true});
    });
    document.getElementById('manageDFNsBtn').addEventListener('click', () => {
        setActiveSidebarButton('manageDFNsBtn');
        openTableManager('DFNS');
    });
    document.getElementById('manageItemTypesBtn').addEventListener('click', () => {
        setActiveSidebarButton('manageItemTypesBtn');
        openTableManager('ITEM_TYPES');
    });
    document.getElementById('manageCrewsBtn').addEventListener('click', () => {
        setActiveSidebarButton('manageCrewsBtn');
        openTableManager('CREWS');
    });
    document.getElementById('manageOthersSelect').addEventListener('change', (e) => {
        if (e.target.value) {
            // Clear active state from buttons since dropdown selection doesn't have a specific button
            document.querySelectorAll('nav.sidebar button').forEach(btn => {
                btn.classList.remove('active');
            });
            openTableManager(e.target.value);
        }
    });

    // Import/Export functionality
    document.getElementById('exportTemplateBtn').addEventListener('click', () => {
        setActiveSidebarButton('exportTemplateBtn');
        if (typeof window.exportTemplate === 'function') {
            window.exportTemplate(db);
        } else {
            alert('Export template functionality not available');
        }
    });
    
    document.getElementById('exportInventoryBtn').addEventListener('click', () => {
        setActiveSidebarButton('exportInventoryBtn');
        if (typeof window.exportInventory === 'function') {
            window.exportInventory(db);
        } else {
            alert('Export inventory functionality not available');
        }
    });
    
    document.getElementById('importExcelBtn').addEventListener('click', () => {
        setActiveSidebarButton('importExcelBtn');
        if (typeof window.importFromExcel === 'function') {
            window.importFromExcel(db);
        } else {
            alert('Import Excel functionality not available');
        }
    });

    document.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            // Disabled toggle functionality - sections stay open
            // const section = this.parentElement;
            // section.classList.toggle('active');
        });
    });

    // Sub-accordion functionality
    document.querySelectorAll('.sub-accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            const content = this.nextElementSibling;
            const isActive = content.classList.contains('active');
            
            // Close all sub-accordion sections in the same parent
            const parentSection = this.closest('.receive-form-section');
            if (parentSection) {
                parentSection.querySelectorAll('.sub-accordion-content').forEach(c => {
                    c.classList.remove('active');
                });
                parentSection.querySelectorAll('.sub-accordion-header').forEach(h => {
                    h.classList.remove('active');
                });
            }
            
            // Open clicked section if it wasn't already active
            if (!isActive) {
                content.classList.add('active');
                this.classList.add('active');
            }
        });
    });


    
    
});

async function runFullInitialization() {
    try {
        displaySlocValue();
        await setCurrentUserFromSupabase();
        await cacheLookupTables();
        populateManageOthersDropdown();
        window.transactionLogger = new TransactionLogger();

        // Populate initial dropdowns
        populateAllDropdowns();

        // Inventory and bulk tables
        await loadSerializedInventoryList();
        await loadBulkInventoryList();

        window.refreshDropdowns();
        populateBulkSerializedDropdowns();

        // Bulk receive form setup
        setupBulkForms();

        // Sidebar navigation event listeners
        setupSidebarNavigation();

        // Import/Export functionality
        setupImportExportButtons();

        // Accordion and other UI listeners
        setupAccordionListeners();

        // Serialized Issue buttons
        setupSerializedIssueButtons();

        // Item type history and bulk receiving
        initializeItemTypeHistory();
        initializeBulkSerializedReceiving();
        initializeBulkReceiving();

        // Set initial active button (default to View Inventory)
        setActiveSidebarButton('viewInventoryBtn');
        refreshAllTables();

        // Populate Manage Others dropdown with remaining lookup tables
        const managedTables = ['dfns','item_types','crews'];
        const allTables = window.getTableNames();
        const othersSelect = document.getElementById('manageOthersSelect');
        allTables.filter(t => !managedTables.includes(t)).forEach(t => {
            const opt = document.createElement('option');
            opt.value = t;
            opt.textContent = t;
            othersSelect.appendChild(opt);
        });

        // Set initial view - Show View Inventory section by default
        await showSections({serializedInventory: true, bulkInventory: true});     

    } catch (error) {
        console.error('Error during full initialization:', error);
    }
}

// --- Helper Functions ---
// Section visibility control
async function showSections({serializedInventory=false, inventoryReceiving=false, bulkInventory=false, bulkReceive=false}) {
    const inventoryAccordion = document.getElementById('inventoryAccordion');
    if (inventoryAccordion) {
        inventoryAccordion.classList.toggle('active', serializedInventory);
    }
    const receiveAccordion = document.getElementById('receiveAccordion');
    if (receiveAccordion) {
        receiveAccordion.classList.toggle('active', inventoryReceiving);
    }
    const bulkInventoryAccordion = document.getElementById('bulkInventoryAccordion');
    if (bulkInventoryAccordion) {
        bulkInventoryAccordion.classList.toggle('active', bulkInventory);
    }
    const bulkReceiveAccordion = document.getElementById('bulkReceiveAccordion');
    if (bulkReceiveAccordion) {
        bulkReceiveAccordion.classList.toggle('active', bulkReceive);
    }

    // Load inventory table when serialized inventory section is shown
    loadInventoryList();

    // Load bulk inventory when bulk inventory section is shown  
    loadBulkInventoryList();
}

function populateAllDropdowns() {
    const lookups = {
        location_id: getCachedTable('locations').map(row => [row.id, row.name]),
        assigned_crew_id: getCachedTable('crews').map(row => [row.id, row.name]),
        dfn_id: getCachedTable('dfns').map(row => [row.id, row.name]),
        item_type_id: getCachedTable('item_types').map(row => [row.id, row.name]),
        status_id: getCachedTable('statuses').map(row => [row.id, row.name])
    };
    ['location_id', 'assigned_crew_id', 'dfn_id', 'item_type_id'].forEach(field => {
        const select = document.querySelector(`select[name="${field}"]`);
        if (select && lookups[field] && Array.isArray(lookups[field])) {
            lookups[field].forEach(([id, label]) => {
                const option = document.createElement('option');
                option.value = id;
                option.textContent = label || id;
                select.appendChild(option);
            });
        }
    });
}

function setupBulkForms() {
    const bulkForm = document.getElementById('bulkReceiveForm');
    if (!bulkForm) return;

    // Crew dropdowns
    setupDropdown('bulk_assigned_crew_id', 'crews', 'market_id', window.selectedMarketId);
    setupDropdown('bulk_issue_assigned_crew_id', 'crews', 'market_id', window.selectedMarketId);

    // DFN dropdown
    setupDropdown('bulk_dfn_id', 'dfns', 'sloc_id', window.selectedSlocId);

    // Bulk item types table
    const bulkTableContainer = document.getElementById('bulkItemTypesTable');
    if (bulkTableContainer) {
        generateBulkItemTypesTable().then(bulkTable => bulkTableContainer.appendChild(bulkTable));
    }

    // Form field listeners
    bulkForm.querySelectorAll('input, select').forEach(el => {
        el.addEventListener('input', updateBulkButtonStates);
        el.addEventListener('change', updateBulkButtonStates);
    });
    updateBulkButtonStates();
}

function setupDropdown(elementId, tableName, filterField, filterValue) {
    const select = document.getElementById(elementId);
    if (!select) return;
    select.innerHTML = `<option value="">Select ${tableName.replace(/_/g, ' ')}</option>`;
    let data = getCachedTable(tableName);
    if (filterValue !== undefined && filterValue !== null) {
        data = data.filter(row => row[filterField] == filterValue);
    }
    data.forEach(row => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = row.name;
        select.appendChild(option);
    });
}

function setupSidebarNavigation() {
    const navButtons = [
        ['viewInventoryBtn', async () => { setActiveSidebarButton('viewInventoryBtn'); await showSections({serializedInventory: true, bulkInventory: true}); }],
        ['viewTransactionHistoryBtn', () => { setActiveSidebarButton('viewTransactionHistoryBtn'); window.open('transactionHistory.html', '_blank'); }],
        ['receiveNavBtn', async () => { setActiveSidebarButton('receiveNavBtn'); await showSections({inventoryReceiving: true}); }],
        ['bulkReceiveNavBtn', async () => { setActiveSidebarButton('bulkReceiveNavBtn'); await showSections({bulkReceive: true}); }],
        ['manageDFNsBtn', () => { setActiveSidebarButton('manageDFNsBtn'); openTableManager('dfns'); }],
        ['manageItemTypesBtn', () => { setActiveSidebarButton('manageItemTypesBtn'); openTableManager('item_types'); }],
        ['manageCrewsBtn', () => { setActiveSidebarButton('manageCrewsBtn'); openTableManager('crews'); }]
    ];
    navButtons.forEach(([id, handler]) => {
        const btn = document.getElementById(id);
        if (btn) btn.addEventListener('click', handler);
    });

    const manageOthersSelect = document.getElementById('manageOthersSelect');
    if (manageOthersSelect) {
        manageOthersSelect.addEventListener('change', (e) => {
            if (e.target.value) {
                document.querySelectorAll('nav.sidebar button').forEach(btn => btn.classList.remove('active'));
                openTableManager(e.target.value);
            }
        });
    }
}

function setupImportExportButtons() {
    const importExportButtons = [
        ['exportTemplateBtn', window.exportTemplate, 'Export template functionality not available'],
        ['exportInventoryBtn', window.exportInventory, 'Export inventory functionality not available'],
        ['importExcelBtn', window.importFromExcel, 'Import Excel functionality not available']
    ];
    importExportButtons.forEach(([id, func, fallback]) => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.addEventListener('click', () => {
                setActiveSidebarButton(id);
                if (typeof func === 'function') func();
                else alert(fallback);
            });
        }
    });
}

function setupAccordionListeners() {
    document.querySelectorAll('.accordion-subheader').forEach(header => {
        header.setAttribute('aria-expanded', 'false');
        header.addEventListener('click', function() {
            const expanded = this.getAttribute('aria-expanded') === 'true';
            document.querySelectorAll('.accordion-subheader').forEach(h => h.setAttribute('aria-expanded', 'false'));
            if (!expanded) this.setAttribute('aria-expanded', 'true');
        });
        header.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
        });
    });
}

function setupSerializedIssueButtons() {
    const beginBtn = document.getElementById('beginSerializedIssueBtn');
    if (beginBtn) {
        beginBtn.addEventListener('click', () => {
            serializedIssueState = 'selecting';
            selectedSerializedForIssue = [];
            document.getElementById('serializedIssueSelectionInstructions').style.display = '';
            document.getElementById('completeSerializedIssueBtn').style.display = '';
            document.getElementById('cancelSerializedIssueBtn').style.display = '';
            updateSelectedSerializedForIssueDisplay();
            showOnlyAvailableSerializedItems();
            updateSerializedIssueButtons();
            document.querySelectorAll('.inventory-item-row').forEach(row => {
                row.classList.add('selectable-for-issue');
            });
        });
    }

    const cancelBtn = document.getElementById('cancelSerializedIssueBtn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', resetSerializedIssueProcess);
    }

    const completeBtn = document.getElementById('completeSerializedIssueBtn');
    if (completeBtn) {
        completeBtn.addEventListener('click', () => {
            if (selectedSerializedForIssue.length === 0) {
                alert('Select at least one item to issue.');
                return;
            }
            serializedIssueState = 'confirming';
            showMultiSerializedIssueModal(selectedSerializedForIssue);
            updateSerializedIssueButtons();
        });
    }
}

// Add this function to handle item type selection changes
async function handleItemTypeChange(e) {
    const itemTypeId = e.target.value;
    const quantityInput = document.querySelector('input[name="quantity"]');
    const tilsonsnInput = document.querySelector('input[name="tilsonsn"]');
    
    if (!itemTypeId) {
        quantityInput.disabled = false;
        quantityInput.value = '1';
        if (tilsonsnInput) {
            tilsonsnInput.value = '';
            tilsonsnInput.readOnly = false;
        }
        return;
    }

    // Check if selected item type is serialized using our utility function
    const itemTypeInfo = getItemTypeInfo(itemTypeId);
    
    if (itemTypeInfo.isSerializedType) {
        quantityInput.disabled = true;
        quantityInput.value = itemTypeInfo.unitsPerPackage;
        
        // Auto-generate Tilson SN for serialized items
        if (tilsonsnInput) {
            try {
                const autoTilsonSN = formatTilsonSN(getCurrentTilsonSN());
                tilsonsnInput.value = autoTilsonSN;
                tilsonsnInput.readOnly = true; // Make it read-only since it's auto-generated
                console.log(`🏷️ Auto-generated Tilson SN: ${autoTilsonSN}`);
            } catch (error) {
                console.error('Error auto-generating Tilson SN:', error);
                tilsonsnInput.readOnly = false; // Allow manual entry if auto-gen fails
            }
        }
    } else {
        quantityInput.disabled = false;
        quantityInput.value = '1';
        if (tilsonsnInput) {
            tilsonsnInput.value = '';
            tilsonsnInput.readOnly = false;
        }
    }
}

// Also expose the individual utility functions for external use
window.getItemTypeInfo = getItemTypeInfo;
window.getStatusId = getStatusId;
window.getLocationId = getLocationId;
window.prepareInventoryData = prepareInventoryData;
window.insertInventoryRecord = insertInventoryRecord;
window.insertBulkInventoryRecords = insertBulkInventoryRecords;
window.processInventoryInsertion = processInventoryInsertion;
window.refreshAllTables = refreshAllTables;

// ============================================================================
// ITEM TYPE HISTORY FUNCTIONALITY
// ============================================================================

/**
 * Initialize item type history functionality for both forms
 */
function initializeItemTypeHistory() {
    console.log("Initializing item type history...");
    const bulkItemTypeSelect = document.querySelector('#bulkItemType');
    
    // Individual form item type change
    // if (individualItemTypeSelect) {
    //     individualItemTypeSelect.addEventListener('change', function() {
    //         const selectedItemTypeId = this.value;
    //         if (selectedItemTypeId) {
    //             // Clear bulk form when individual form is used
    //             clearBulkFormFields();
    //             loadItemTypeHistory(selectedItemTypeId);
    //         } else {
    //             showHistoryPlaceholder();
    //         }
    //     });
    // }
    
    // Bulk form item type change
    if (bulkItemTypeSelect) {
        bulkItemTypeSelect.addEventListener('change', function() {
            const selectedItemTypeId = this.value;
            if (selectedItemTypeId) {
                // Clear individual form when bulk form is used
                clearIndividualFormFields();
                loadItemTypeHistory(selectedItemTypeId);
            } else {
                showHistoryPlaceholder();
            }
        });
    }
}


/**
 * Clear bulk form fields when individual form is used
 */
function clearBulkFormFields() {
    const bulkForm = document.querySelector('#bulkSerializedForm');
    if (bulkForm) {
        // Clear dropdowns except the triggering one
        $('#bulkLocation').val('');
        $('#bulkCrew').val('');
        $('#bulkDfn').val('');
        
        // Clear Select2 tags
        if ($('#mfgrSnTags').length) {
            if (window.mfgrSnTagify) window.mfgrSnTagify.removeAllTags();
        }
        
        // Update preview and buttons
        if (typeof updateSNPreview === 'function') {
            updateSNPreview();
        }
        if (typeof updateBulkSerializedReceiveButton === 'function') {
            updateBulkSerializedReceiveButton();
        }
    }
}

/**
 * Show the placeholder when no item type is selected
 */
function showHistoryPlaceholder() {
    const historyContent = document.getElementById('itemHistoryContent');
    if (historyContent) {
        historyContent.innerHTML = `
            <div class="history-placeholder">
                <div class="placeholder-icon">📦</div>
                <p>Select an item type from the form to view its complete transaction history, quantity breakdowns, and metrics.</p>
            </div>
        `;
    }
}

/**
 * Load and display comprehensive history for a specific item type
 * @param {number} itemTypeId - The item type ID to analyze
 */
async function loadItemTypeHistory(itemTypeId) {

    const historyContent = document.getElementById('itemHistoryContent');
    if (!historyContent) return;

    try {
        // Show loading state
        historyContent.innerHTML = '<div class="history-placeholder"><p>Loading item type history...</p></div>';

        // Get item type information
        const itemTypeInfo = await getItemTypeHistoryData(itemTypeId);
        
        if (itemTypeInfo) {
            displayItemTypeHistory(itemTypeInfo);
        } else {
            historyContent.innerHTML = '<div class="history-placeholder"><p>No data found for selected item type.</p></div>';
        }
    } catch (error) {
        console.error('Error loading item type history:', error);
        historyContent.innerHTML = '<div class="history-placeholder"><p>Error loading history data.</p></div>';
    }
}

/**
 * Gather comprehensive data for item type history analysis
 * @param {number} itemTypeId - The item type ID
 * @returns {Object} Comprehensive item type data
 */
async function getItemTypeHistoryData(itemTypeId) {
    const data = {
        itemType: null,
        transactions: [],
        currentInventory: [],
        isSerializedType: false,
        metrics: {
            totalReceived: 0,
            totalIssued: 0,
            totalInstalled: 0,
            totalRejected: 0,
            currentStock: 0,
            statusBreakdown: {},
            dfnBreakdown: {},
            crewBreakdown: {},
            locationBreakdown: {},
        }
    };

    try {
        // 1. Get item type details
        const { data: itemTypeRows, error: itemTypeError } = await supabase
            .from('item_types')
            .select(`
                name,
                manufacturer,
                part_number,
                description,
                units_per_package,
                categories(name),
                inventory_types(name),
                units_of_measure(name),
                inventory_providers(name)
            `)
            .eq('id', itemTypeId)
            .eq('market_id', window.selectedMarketId)
            .single();

        if (itemTypeError) throw itemTypeError;
        if (itemTypeRows) {
            data.itemType = {
                name: itemTypeRows.name,
                manufacturer: itemTypeRows.manufacturer,
                part_number: itemTypeRows.part_number,
                description: itemTypeRows.description,
                units_per_package: itemTypeRows.units_per_package,
                category_name: itemTypeRows.categories?.name || '',
                inventory_type_name: itemTypeRows.inventory_types?.name || '',
                unit_name: itemTypeRows.units_of_measure?.name || '',
                provider_name: itemTypeRows.inventory_providers?.name || ''
            };
            data.isSerializedType = itemTypeRows.inventory_types?.name === 'Serialized';
        }

        // 2. Get current inventory for this item type
        const { data: inventoryRows, error: inventoryError } = await supabase
            .from('inventory')
            .select(`
                id,
                location_id,
                assigned_crew_id,
                dfn_id,
                item_type_id,
                mfgrsn,
                tilsonsn,
                quantity,
                status_id,
                statuses(name),
                locations(name),
                crews(name),
                dfns(name)
            `)
            .eq('item_type_id', itemTypeId)
            .eq('sloc_id', window.selectedSlocId)
            .order('id', { ascending: false });

        if (inventoryError) throw inventoryError;
        if (inventoryRows) {
            data.currentInventory = inventoryRows.map(row => ({
                id: row.id,
                location_id: row.location_id,
                assigned_crew_id: row.assigned_crew_id,
                dfn_id: row.dfn_id,
                item_type_id: row.item_type_id,
                mfgrsn: row.mfgrsn,
                tilsonsn: row.tilsonsn,
                quantity: row.quantity || 0,
                status_id: row.status_id,
                status_name: row.statuses?.name || '',
                location_name: row.locations?.name || '',
                crew_name: row.crews?.name || '',
                dfn_name: row.dfns?.name || ''
            }));
        }

        // 3. Get transaction history for this item type
        const { data: transactionRows, error: transactionError } = await supabase
            .from('transactions')
            .select(`
                transaction_type,
                action,
                quantity,
                status_name,
                old_status_name,
                dfn_name,
                assigned_crew_name,
                to_location_name,
                from_location_name,
                date_time,
                notes,
                mfgrsn,
                tilsonsn,
                inventory_id,
                item_type_name
            `)
            .or(`
                transaction_type.ilike.%receive%,
                transaction_type.ilike.%issue%,
                transaction_type.ilike.%install%,
                action.ilike.%receive%,
                action.ilike.%issue%,
                action.ilike.%install%,
                action.eq.CREATE
            `)
            .eq('item_type_name', data.itemType?.name || '')
            .order('date_time', { ascending: false })
            .limit(50);

        if (transactionError) throw transactionError;
        if (transactionRows) {
            data.transactions = transactionRows.map(row => ({
                transaction_type: row.transaction_type,
                action: row.action,
                quantity: row.quantity || 0,
                status_name: row.status_name,
                old_status_name: row.old_status_name,
                dfn_name: row.dfn_name,
                assigned_crew_name: row.assigned_crew_name,
                to_location_name: row.to_location_name,
                from_location_name: row.from_location_name,
                date_time: row.date_time,
                notes: row.notes,
                mfgrsn: row.mfgrsn,
                tilsonsn: row.tilsonsn,
                inventory_id: row.inventory_id
            }));
        }

        // 4. Calculate metrics
        calculateItemTypeMetrics(data);

        return data;
    } catch (error) {
        console.error('Error gathering item type history data:', error);
        return null;
    }
}

/**
 * Calculate comprehensive metrics for item type
 * @param {Object} data - Item type data object
 */
function calculateItemTypeMetrics(data) {
    const metrics = data.metrics;
    
    // Initialize breakdowns
    metrics.statusBreakdown = {};
    metrics.dfnBreakdown = { 'Unassigned': 0 };
    metrics.crewBreakdown = { 'Unassigned': 0 };
    metrics.locationBreakdown = {};

    // Calculate from current inventory
    data.currentInventory.forEach(item => {
        metrics.currentStock += item.quantity;
        
        // Status breakdown
        const status = item.status_name || 'Unknown';
        metrics.statusBreakdown[status] = (metrics.statusBreakdown[status] || 0) + item.quantity;
        
        // DFN breakdown
        const dfn = item.dfn_name || 'Unassigned';
        metrics.dfnBreakdown[dfn] = (metrics.dfnBreakdown[dfn] || 0) + item.quantity;
        
        // Crew breakdown
        const crew = item.crew_name || 'Unassigned';
        metrics.crewBreakdown[crew] = (metrics.crewBreakdown[crew] || 0) + item.quantity;
        
        // Location breakdown
        const location = item.location_name || 'Unknown';
        metrics.locationBreakdown[location] = (metrics.locationBreakdown[location] || 0) + item.quantity;
    });

    // Calculate from transactions
    data.transactions.forEach(transaction => {
        const qty = transaction.quantity || 0;
        const transactionType = transaction.transaction_type?.toLowerCase() || '';
        const action = transaction.action?.toLowerCase() || '';
        
        if (transactionType.includes('receive') || action.includes('create')) {
            metrics.totalReceived += qty;
        } else if (transactionType.includes('issue') || action.includes('issue')) {
            metrics.totalIssued += qty;
        } else if (transactionType.includes('install') || action.includes('install')) {
            metrics.totalInstalled += qty;
        } else if (transactionType.includes('reject') || action.includes('reject')) {
            metrics.totalRejected += qty;
        }
    });
    
    // If transaction-based totals are missing, calculate from current status
    // This handles cases where items have status but no transaction was logged
    if (metrics.totalIssued === 0 && metrics.statusBreakdown['Issued']) {
        metrics.totalIssued = metrics.statusBreakdown['Issued'];
    }
    if (metrics.totalInstalled === 0 && metrics.statusBreakdown['Installed']) {
        metrics.totalInstalled = metrics.statusBreakdown['Installed'];
    }
    if (metrics.totalRejected === 0 && metrics.statusBreakdown['Rejected']) {
        metrics.totalRejected = metrics.statusBreakdown['Rejected'];
    }
}

/**
 * Display the comprehensive item type history
 * @param {Object} data - Item type history data
 */
function displayItemTypeHistory(data) {
    const historyContent = document.getElementById('itemHistoryContent');
    if (!historyContent) return;

    const itemType = data.itemType;
    const metrics = data.metrics;

    historyContent.innerHTML = `
        <div class="item-type-overview">
            <h3>${itemType.name}</h3>
            <div class="item-details-grid">
                <div class="detail-column">
                    <p><strong>Manufacturer:</strong> ${itemType.manufacturer || 'N/A'}</p>
                    <p><strong>Part Number:</strong> ${itemType.part_number || 'N/A'}</p>
                    <p><strong>Category:</strong> ${itemType.category_name || 'N/A'}</p>
                    <p><strong>Type:</strong> ${itemType.inventory_type_name || 'N/A'}</p>
                </div>
                <div class="detail-column">
                    <p><strong>Description:</strong> ${itemType.description || 'N/A'}</p>
                    <p><strong>Unit of Measure:</strong> ${itemType.unit_name || 'N/A'}</p>
                    <p><strong>Units per Package:</strong> ${itemType.units_per_package || 'N/A'}</p>
                    <p><strong>Provider:</strong> ${itemType.provider_name || 'N/A'}</p>
                </div>
            </div>
        </div>

        <div class="history-metrics">
            <div class="metric-card">
                <h4>Current Stock</h4>
                <div class="metric-value">${metrics.currentStock}</div>
                <div class="metric-subtitle">${itemType.unit_name || 'units'}</div>
            </div>
            <div class="metric-card">
                <h4>Total Received</h4>
                <div class="metric-value">${metrics.totalReceived}</div>
                <div class="metric-subtitle">lifetime</div>
            </div>
            <div class="metric-card">
                <h4>Total Issued</h4>
                <div class="metric-value">${metrics.totalIssued}</div>
                <div class="metric-subtitle">lifetime</div>
            </div>
            <div class="metric-card">
                <h4>Total Installed</h4>
                <div class="metric-value">${metrics.totalInstalled}</div>
                <div class="metric-subtitle">lifetime</div>
            </div>
        </div>

        ${generateStatusBredownSection(metrics.statusBreakdown)}
        ${generateDFNBreakdownSection(metrics.dfnBreakdown)}
        ${generateCrewBreakdownSection(metrics.crewBreakdown)}
        ${generateLocationBreakdownSection(metrics.locationBreakdown)}
        ${generateTransactionHistorySection(data.transactions)}
    `;
}

/**
 * Generate status breakdown section
 */
function generateStatusBredownSection(statusBreakdown) {
    if (Object.keys(statusBreakdown).length === 0) return '';
    
    const items = Object.entries(statusBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([status, qty]) => `
            <div class="breakdown-item">
                <div class="breakdown-label">${status}</div>
                <div class="breakdown-value">${qty}</div>
            </div>
        `).join('');

    return `
        <div class="history-section">
            <h4>📋 Quantity by Status</h4>
            <div class="breakdown-grid">${items}</div>
        </div>
    `;
}

/**
 * Generate DFN breakdown section
 */
function generateDFNBreakdownSection(dfnBreakdown) {
    if (Object.keys(dfnBreakdown).length === 0) return '';
    
    const items = Object.entries(dfnBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([dfn, qty]) => `
            <div class="breakdown-item">
                <div class="breakdown-label">${dfn}</div>
                <div class="breakdown-value">${qty}</div>
            </div>
        `).join('');

    return `
        <div class="history-section">
            <h4>🎯 Quantity by DFN</h4>
            <div class="breakdown-grid">${items}</div>
        </div>
    `;
}

/**
 * Generate crew breakdown section
 */
function generateCrewBreakdownSection(crewBreakdown) {
    if (Object.keys(crewBreakdown).length === 0) return '';
    
    const items = Object.entries(crewBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([crew, qty]) => `
            <div class="breakdown-item">
                <div class="breakdown-label">${crew}</div>
                <div class="breakdown-value">${qty}</div>
            </div>
        `).join('');

    return `
        <div class="history-section">
            <h4>👥 Quantity by Crew</h4>
            <div class="breakdown-grid">${items}</div>
        </div>
    `;
}

/**
 * Generate location breakdown section
 */
function generateLocationBreakdownSection(locationBreakdown) {
    if (Object.keys(locationBreakdown).length === 0) return '';
    
    const items = Object.entries(locationBreakdown)
        .sort(([,a], [,b]) => b - a)
        .map(([location, qty]) => `
            <div class="breakdown-item">
                <div class="breakdown-label">${location}</div>
                <div class="breakdown-value">${qty}</div>
            </div>
        `).join('');

    return `
        <div class="history-section">
            <h4>📍 Quantity by Location</h4>
            <div class="breakdown-grid">${items}</div>
        </div>
    `;
}


/**
 * Generate transaction history section
 */
function generateTransactionHistorySection(transactions) {
    if (transactions.length === 0) {
        return `
            <div class="history-section">
                <h4>📜 Transaction History (Receive, Issue, Install)</h4>
                <p style="color: #6c757d; font-style: italic;">No relevant transaction history available for this item type.</p>
            </div>
        `;
    }

    const rows = transactions.slice(0, 30).map(transaction => {
        const transactionClass = getTransactionClass(transaction.transaction_type, transaction.action);
        const date = new Date(transaction.date_time).toLocaleDateString();
        const time = new Date(transaction.date_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Determine the action type for display
        let actionDisplay = transaction.transaction_type || transaction.action;
        if (transaction.action === 'CREATE') {
            actionDisplay = 'Receive';
        }
        
        return `
            <tr>
                <td>${date}<br><small>${time}</small></td>
                <td><span class="transaction-type ${transactionClass}">${actionDisplay}</span></td>
                <td>${transaction.quantity || 0}</td>
                <td>${transaction.status_name || transaction.old_status_name || '-'}</td>
                <td>${transaction.dfn_name || '-'}</td>
                <td>${transaction.assigned_crew_name || '-'}</td>
                <td>${transaction.to_location_name || transaction.from_location_name || '-'}</td>
                <td>${transaction.mfgrsn || transaction.tilsonsn || '-'}</td>
            </tr>
        `;
    }).join('');

    return `
        <div class="history-section">
            <h4>📜 Transaction History (Receive, Issue, Install)</h4>
            <p style="color: #6c757d; font-size: 0.9rem; margin-bottom: 1rem;">
                Showing ${transactions.length} relevant transactions chronologically
            </p>
            <table class="transaction-table">
                <thead>
                    <tr>
                        <th>Date/Time</th>
                        <th>Action</th>
                        <th>Qty</th>
                        <th>Status</th>
                        <th>DFN</th>
                        <th>Crew</th>
                        <th>Location</th>
                        <th>Serial</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
}

/**
 * Get CSS class for transaction type
 */
function getTransactionClass(transactionType, action) {
    const type = (transactionType || action || '').toLowerCase();
    
    if (type.includes('receive')) return 'transaction-receive';
    if (type.includes('issue')) return 'transaction-issue';
    if (type.includes('install')) return 'transaction-install';
    if (type.includes('reject')) return 'transaction-reject';
    if (type.includes('update')) return 'transaction-update';
    
    return 'transaction-update';
}

// Expose the history functions globally
window.loadItemTypeHistory = loadItemTypeHistory;

// ============================================================================
// BULK SERIALIZED RECEIVING FUNCTIONALITY
// ============================================================================

/**
 * Update units per package display when item type changes
 * @param {string} itemTypeId - Selected item type ID
 */
async function updateUnitsPerPackageDisplay(itemTypeId) {
    console.log('🔄 updateUnitsPerPackageDisplay called with itemTypeId:', itemTypeId);

    const displayElement = document.getElementById('unitsPerPackageDisplay');

    if (!displayElement) {
        console.warn('⚠️ Units per package display element not found');
        return;
    }

    if (!itemTypeId) {
        console.log('💨 Hiding display - no itemTypeId');
        displayElement.style.display = 'none';
        return;
    }

    try {
        // Get units per package from Supabase
        const { data, error } = await supabase
            .from('item_types')
            .select('units_per_package')
            .eq('id', parseInt(itemTypeId, 10))
            .eq('market_id', window.selectedMarketId)
            .single();

        if (error) {
            throw error;
        }

        const unitsPerPackage = data?.units_per_package || 1; // Default to 1 if null

        displayElement.textContent = `${unitsPerPackage} / package`;
        displayElement.style.display = 'block';

        console.log(`✅ Updated display: ${unitsPerPackage} / package`);
    } catch (error) {
        console.error('❌ Error getting units per package:', error);
        displayElement.style.display = 'none';
    }
}

/**
 * Initialize bulk serialized receiving interface
 */
function initializeBulkSerializedReceiving() {
    console.log('🚀 initializeBulkSerializedReceiving() started');
    
    // Check if element exists
    const mfgrSnElement = document.getElementById('mfgrSnTags');
    if (!mfgrSnElement) {
        console.error('❌ mfgrSnTags element not found!');
        return;
    }

    // Remove Select2 if previously initialized
    if ($(mfgrSnElement).data('select2')) {
        $(mfgrSnElement).select2('destroy');
    }

    // Initialize Tagify for manufacturer SNs
    window.mfgrSnTagify = new Tagify(mfgrSnElement, {
        delimiters: ",", // Only comma and Enter will add a tag; spaces allowed in tags
        maxTags: 100,
        dropdown: { enabled: 0 },
        placeholder: "Type serial numbers and press Enter or comma to add"
    });

    // Update preview and button state when tags change
    mfgrSnTagify.on('change', function() {
        updateSNPreview();
        updateBulkSerializedReceiveButton();
    });

    // Also update on add/remove for robustness
    mfgrSnTagify.on('add', function() {
        updateSNPreview();
        updateBulkSerializedReceiveButton();
        mfgrSnTagify.DOM.input.focus();
    });
    mfgrSnTagify.on('remove', function() {
        updateSNPreview();
        updateBulkSerializedReceiveButton();
    });

    // Batch serial number generation
    const batchInput = document.getElementById('batchSnCount');
    if (batchInput) {
        batchInput.addEventListener('change', function() {
            let count = parseInt(batchInput.value, 10);
            if (isNaN(count) || count < 1) {
                // Optionally clear tags if invalid
                window.mfgrSnTagify.removeAllTags();
                return;
            }
            // Generate tags: "1 of N", "2 of N", ..., "N of N"
            let tags = [];
            for (let i = 1; i <= count; i++) {
                tags.push({ value: `${i} of ${count}` });
            }
            window.mfgrSnTagify.removeAllTags();
            window.mfgrSnTagify.addTags(tags);
            // Refocus Tagify input for convenience
            window.mfgrSnTagify.DOM.input.focus();
        });
    }

    // Item type change - UPDATED TO FIRE RELIABLY ON EVERY CHANGE
    $('#bulkSerializedItemType').off('change').on('change input', function() {
        const selectedItemTypeId = this.value;
        console.log('📦 Item type changed to:', selectedItemTypeId);
        
        // Update units per package display EVERY TIME
        updateUnitsPerPackageDisplay(selectedItemTypeId);
        
        // Update button state
        updateBulkSerializedReceiveButton();
        
        console.log('✅ Units per package display updated for item type:', selectedItemTypeId);
    });
    
    // Crew change
    $('#bulk_serialized_assigned_crew_id').on('change', function() {
        updateBulkSerializedReceiveButton();
    });
    
    // DFN change (optional for most actions)
    $('#bulk_serialized_dfn_id').on('change', function() {
        updateBulkSerializedReceiveButton();
    });
    
    // Bulk serialized action buttons
    $('#bulkSerializedReceiveBtn').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        //console.log('🔘 bulkSerializedReceiveBtn clicked - calling processBulkSerializedAction(receive)');
        processBulkSerializedAction('receive');
    });
    
    $('#bulkSerializedReceiveIssueBtn').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        //console.log('🔘 bulkSerializedReceiveIssueBtn clicked - calling processBulkSerializedAction(issue)');
        processBulkSerializedAction('issue');
    });
    
    // Clear form button
    $('#clearBulkFormBtn').on('click', function() {
        clearBulkSerializedForm();
    });
    
    // Populate dropdowns with serialized item types only
    populateBulkSerializedDropdowns();
    
    //console.log('🎯 initializeBulkSerializedReceiving() completed successfully');
}

/**
 * Initialize bulk receiving functionality
 */
function initializeBulkReceiving() {
    //console.log('🚀 initializeBulkReceiving() started');
    
    // Check if buttons exist
    const bulkReceiveBtn = document.getElementById('bulkItemReceiveBtn');
    const bulkIssueBtn = document.getElementById('bulkItemIssueBtn');
    
    //console.log('🔍 Button elements found during initialization:', {
    //    receive: !!bulkReceiveBtn,
    //    issue: !!bulkIssueBtn
    //});
    
    // Bulk action buttons for bulk receive section  // OLD SECTION
    $('#bulkItemReceiveBtn').on('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        //console.log('🔘 Bulk receive: bulkItemReceiveBtn clicked - calling processBulkInventoryInsertion(receive)');
        processBulkInventoryInsertion('receive');
    });
    
    $('#bulkItemIssueBtn').on('click', function(event) {   // OLD SECTION
        event.preventDefault();
        event.stopPropagation();
        //console.log('🔘 Bulk receive: bulkItemIssueBtn clicked - calling processBulkInventoryInsertion(issue)');
        processBulkInventoryInsertion('issue');
    });
    
    // Clear bulk receive form button
    $('#clearBulkReceiveFormBtn').on('click', function() {   // OLD SECTION
        clearBulkReceiveForm();
    });
    
    //console.log('🎯 initializeBulkReceiving() completed successfully');

    $('#bulkBeginReceiveProcessBtn').on('click', function() {

        // place page into bulk receive mode
        if (!$('.bulk-manage-container').hasClass('inBulkReceiveMode')) {
            useBulkReceiveMode(true);
            // enable all bulk inputs
            $('.bulk-quantity-input').prop('disabled', false);
            // show the receiveBulkForm
            $('#bulkReceiveForm').show();
        } else {
            // it's already in bulk receive mode.  Now the button will be the submit:
            processBulkInventoryInsertion('receive');
            // actionOb = {name: 'displaybulkreceivereceiptmodal'};
            // console.log("Action object created:", actionOb);
            // handleActionSelect(actionOb);

            if(this.textContent !== 'Complete Receive Process') {
                $('#bulkReceiveForm').hide();
            }

        }

    });


    $('#bulkBeginIssueProcessBtn').on('click', function() {

        // place page into bulk issue mode
        if (!$('.bulk-manage-container').hasClass('inBulkIssueMode')) {
            useBulkIssueMode(true);
            // enable all bulk inputs
            $('.bulk-quantity-input').prop('disabled', false);
            // show the issueBulkForm
            $('#bulkIssueForm').show();
            // get the current issue receipt number from config table, key:currentIssueNumber
            const receiptNumber = getconfigValue('receiptNumber') || 'N/A';
            console.log("Current bulk issue receipt number is:", receiptNumber);
            //$('#receiptNumber').value = receiptNumber;

            // Filter the bulk issue rows by availability
            filterBulkIssueRowsByAvailability(true);
            // set the receiptNumber input value and text to the current issue receipt number
            document.getElementById('issueReceiptNumber').value = receiptNumber;
            console.log("Set issueReceiptNumber input value to:", receiptNumber);

        } else {
            // it's already in bulk issue mode.  Now the button will be the submit:
            //processBulkInventoryInsertion('issue');
            actionOb = {name: 'displaybulkissuereceiptmodal'};
            handleActionSelect(actionOb);
            console.log("Action object created:", actionOb);
            //hide the issueBulkForm
            console.log("button text is:", this.textContent);
           if(this.textContent !== "Complete Issue Process") {
                $('#bulkIssueForm').hide();
            }

        }

    });

    $('#bulkCancelIssueProcessBtn').on('click', function() {

        // cancel bulk issue process
        resetBulkReceiveAndIssueProcessForms();

    });

    $('#bulkCancelReceiveProcessBtn').on('click', function() {

        // cancel bulk receive process
        resetBulkReceiveAndIssueProcessForms();
    });

    // add listener to bulk issue process assigned crew dropdown
    $('#bulk_issue_assigned_crew_id').on('change', function() {
        //console.log('🏷️ bulk_issue_assigned_crew_id changed to:', $(this).val());
        // first for process classes in container
        if ($('.bulk-manage-container').hasClass('inBulkIssueMode')) {
            const errors = evaluateBulkIssueQuantities();
            updateBulkButtonProcessStates(errors);
        }
    });

    // add listener to the dfn dropdown in the bulk issuing process
    $('#bulk_issue_dfn_id').on('change', function() {
        //console.log('🏷️ bulk_dfn_id changed to:', $(this).val());
        // first for process classes in container
        if ($('.bulk-manage-container').hasClass('inBulkIssueMode')) {
            const errors = evaluateBulkIssueQuantities();
            updateBulkButtonProcessStates(errors);
        }
    });

}



function resetBulkReceiveAndIssueProcessForms() {
    
    // reset receive and issue process buttons
    $('#bulkBeginReceiveProcessBtn').prop('disabled', false);
    $('#bulkBeginIssueProcessBtn').prop('disabled', false);

    // disable all bulk inputs
    $('.bulk-quantity-input').prop('disabled', true);

    // hide the forms
    $('#bulkReceiveForm').hide();
    $('#bulkIssueForm').hide();

    // reset the text of the buttons
    $('#bulkBeginReceiveProcessBtn').text("Begin Receive Process");
    $('#bulkBeginIssueProcessBtn').text("Begin Issue Process");

    // show both process sections
    $('.bulk-manage-left-section').show();
    $('.bulk-manage-right-section').show();

    // remove the receive & issue classes
    $('.bulk-manage-container').removeClass('inBulkReceiveMode');
    $('.bulk-manage-container').removeClass('inBulkIssueMode');

    // hide their corresponding cancel buttons
    $('#bulkCancelReceiveProcessBtn').hide();
    $('#bulkCancelIssueProcessBtn').hide();

   // reset all status messages
   $('.bulk-process-status').text('');
   $('.bulk-process-status').css('color', '');

   // remove all input values
   $('.bulk-quantity-input').val('');

   // remove selected crew members
   $('#bulk_issue_assigned_crew_id').val([]);

   // remove DFN select value
   $('#bulk_issue_dfn_id').val([]);

   // remove batch note
   $('#batch_note').val('');

   filterBulkIssueRowsByAvailability(false);

}





function useBulkReceiveMode(setAsActive) {
    //console.log('🔄 Entering bulk receive mode');
    if (setAsActive) {
        $('.bulk-manage-container').addClass('inBulkReceiveMode');
        $('.bulk-manage-container').removeClass('inBulkIssueMode');
        $('.bulk-manage-right-section').hide();
        $('#bulkBeginReceiveProcessBtn').text("Complete Receive Process");
        $('#bulkCancelReceiveProcessBtn').show();
    } else {
        $('.bulk-manage-container').removeClass('inBulkReceiveMode');
        $('.bulk-manage-right-section').show();
        $('.bulk-manage-left-section').show();
        $('#bulkBeginReceiveProcessBtn').text("Begin Receive Process");
        $('#bulkCancelReceiveProcessBtn').hide();
    }

    // clear all inputs
    document.querySelectorAll('.bulk-quantity-input').forEach(input => {
        input.value = setAsActive ? 0 : '';
    });

    // clear bulk-process-status
    $('.bulk-process-status').text('');

}

function useBulkIssueMode(setAsActive) {
    //console.log('🔄 Entering bulk issue mode');
    if (setAsActive) {
        $('.bulk-manage-container').addClass('inBulkIssueMode');
        $('.bulk-manage-container').removeClass('inBulkReceiveMode');
        $('.bulk-manage-left-section').hide();
        $('#bulkBeginIssueProcessBtn').text("Complete Issue Process");
        //disable the button to begin with
        $('#bulkBeginIssueProcessBtn').prop('disabled', true);
        $('#bulkCancelIssueProcessBtn').show();
        evaluateBulkIssueQuantities();
    } else {
        $('.bulk-manage-container').removeClass('inBulkIssueMode');
        $('.bulk-manage-right-section').show();
        $('.bulk-manage-left-section').show();
        $('#bulkBeginIssueProcessBtn').text("Begin Issue Process");
        $('#bulkCancelIssueProcessBtn').hide();
    }

    // clear all inputs
    document.querySelectorAll('.bulk-quantity-input').forEach(input => {
        input.value = setAsActive ? 0 : '';
    });

    // clear bulk-process-status
    $('.bulk-process-status').text('');

    // initial evaluate to disable fields
    evaluateBulkIssueQuantities();

}


function updateBulkButtonProcessStates(errorsObj) {
    console.log('errorsObj:', errorsObj);

    // Get the current mode
    const isReceiveMode = $('.bulk-manage-container').hasClass('inBulkReceiveMode');
    const isIssueMode = $('.bulk-manage-container').hasClass('inBulkIssueMode');

    $('.bulk-process-status').css('color', 'red');

    // Update button states based on the current mode
    if (isReceiveMode) {
        $('#bulkBeginReceiveProcessBtn').prop('disabled', false);
        $('#bulkBeginIssueProcessBtn').prop('disabled', true);
        // set the bulk-process-status
        $('.bulk-process-status').text(errorsObj.numberOfQuantityErrors > 0 ? `${errorsObj.numberOfQuantityErrors} error(s) found.  ` : 'No quantity errors.  ');
        // change color if errors found
        $('.bulk-process-status').css('color', errorsObj.numberOfQuantityErrors > 0 ? 'red' : 'green');
    } else if (isIssueMode) {
        $('#bulkBeginReceiveProcessBtn').prop('disabled', true);
        $('#bulkBeginIssueProcessBtn').prop('disabled', false);
        // set the bulk-process-status
        $('.bulk-process-status').text(errorsObj.numberOfQuantityErrors > 0 ? `${errorsObj.numberOfQuantityErrors} error(s) found.  ` : 'No quantity errors.  ');
        // change color if errors found
        
        // if we have errors, disable the issue button
        if(errorsObj.numberOfValidQuantityInputs < 1) {
            $('.bulk-process-status').text(' Enter at least 1 quantity.  ')
        }

        if (errorsObj.hasAssignedCrew === false) {
            $('.bulk-process-status').append(' Make a crew selection.  ')
        }

        if(errorsObj.hasAssignedDFN === false) {
            $('.bulk-process-status').append(' Make a DFN selection.  ')
        }

        if (errorsObj.numberOfValidQuantityInputs > 0 && errorsObj.numberOfQuantityErrors === 0 && errorsObj.hasAssignedCrew && errorsObj.hasAssignedDFN) {
            $('#bulkBeginIssueProcessBtn').prop('disabled', false);
            $('.bulk-process-status').css('color', 'green');
        }
        else {
            $('#bulkBeginIssueProcessBtn').prop('disabled', true);
            $('.bulk-process-status').css('color', 'red');
        }
    }
}


function evaluateBulkReceiveQuantities() {
    // Get all quantity inputs
    const quantityInputs = document.querySelectorAll('.bulk-quantity-input');
    let numOfErrors = 0;

    quantityInputs.forEach(input => {
        const quantity = parseInt(input.value, 10);
        if (input) {
            if (!isNaN(quantity) && quantity >= 0) {
                input.style.border = '';
            } else {
                numOfErrors++;
                // make the input field border red
                input.style.border = '1px solid red';
            }
        }
    });

    return numOfErrors;
}

function evaluateBulkIssueQuantities() {
    // Get all quantity inputs
    const quantityInputs = document.querySelectorAll('.bulk-quantity-input');
    let numOfErrors = 0;

    let errors = {};
    let qtyErrors = 0;
    let qtyOfValidInputs = 0;

    quantityInputs.forEach(input => {
        const quantity = parseInt(input.value, 10);
        //console.log("value in Available cell: ", $(input).closest('tr').find('td:first').text());
        const availableQuantity = parseInt($(input).closest('tr').find('td:first').text().replace(/,/g, ''), 10);
        if(availableQuantity) console.log("Available quantity for :", $(input).closest('tr').find('td:nth-child(6)').text(), "is:", availableQuantity);

        if (availableQuantity) {
            if (!isNaN(quantity) && quantity >= 0 && quantity <= availableQuantity) {
                input.style.border = '';
                if(quantity > 0) qtyOfValidInputs++;
            } else {
                qtyErrors++;
                input.style.border = '1px solid red';
            }
        }
        // there is no quantity to issue.  Disable the input
        if (!availableQuantity) {
            input.disabled = true;
        }

        errors.numberOfQuantityErrors = qtyErrors;
        errors.numberOfValidQuantityInputs = qtyOfValidInputs;
    });

    // if no crew or DFN selected, return -1
    if (!$('#bulk_issue_assigned_crew_id').val()) {
        errors.hasAssignedCrew = false;
    } else {
        errors.hasAssignedCrew = true;
    }

    if (!$('#bulk_issue_dfn_id').val()) {
        errors.hasAssignedDFN = false;
    } else {
        errors.hasAssignedDFN = true;
    }
    console.log('evaluateBulkIssueQuantities() results:', errors);
    return errors;
}



/**
 * Clear the bulk receive form
 */
function clearBulkReceiveForm() {
    const form = document.getElementById('bulkReceiveForm');
    form.querySelector('#bulk_assigned_crew_id').value = '';
    form.querySelector('#bulk_dfn_id').value = '';
    form.querySelector('#batch_note').value = '';
    
    // Clear all quantity inputs
    document.querySelectorAll('.bulk-quantity-input').forEach(input => {
        input.value = '';
    });
    
    // Update button states
    updateBulkButtonStates();
    
    console.log('🗑️ Bulk receive form cleared');
}

/**
 * Update the SN preview display
 */
function updateSNPreview() {
    const mfgrsns = window.mfgrSnTagify ? window.mfgrSnTagify.value.map(t => t.value) : [];
    const previewContainer = document.getElementById('snPreview');
    
    if (mfgrsns.length === 0) {
        previewContainer.innerHTML = `
            <div class="preview-placeholder" style="text-align: center; color: #6c757d; padding: 2em;">
                <div style="font-size: 1.5em; margin-bottom: 0.5em;">🏷️</div>
                <p>Serial number pairs will appear here as you add manufacturer SNs</p>
            </div>
        `;
        return;
    }
    
    // Generate preview with reserved Tilson SNs
    
    try {
        const snPairs = reserveTilsonSNs(mfgrsns);
        
        let previewHTML = `
            <div style="font-weight: bold; margin-bottom: 0.5em; color: #495057;">
                📋 Preview: ${mfgrsns.length} Serial Number Pairs
            </div>
            <div class="sn-pairs-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5em; font-family: monospace; font-size: 0.9em;">
        `;
        
        mfgrsns.forEach(mfgrsn => {
            previewHTML += `
                <div style="display: contents;">
                    <div style="padding: 0.25em; background-color: #e9ecef; border-radius: 3px;">
                        <strong>Mfgr:</strong> ${mfgrsn}
                    </div>
                    <div style="padding: 0.25em; background-color: #d4edda; border-radius: 3px;">
                        <strong>Tilson:</strong> ${snPairs[mfgrsn]}
                    </div>
                </div>
            `;
        });
        
        previewHTML += '</div>';
        previewContainer.innerHTML = previewHTML;
        
    } catch (error) {
        console.error('Error generating SN preview:', error);
        previewContainer.innerHTML = '<p style="color: red;">Error generating preview</p>';
    }
}

/**
 * Update bulk receive button state - simplified to only handle enable/disable
 */
function updateBulkSerializedReceiveButton() {
    // Get form values
    const mfgrsns = window.mfgrSnTagify ? window.mfgrSnTagify.value.map(t => t.value) : [];
    const itemType = $('#bulkSerializedItemType').val();
    const location = 1;
    const crew = $('#bulk_serialized_assigned_crew_id').val();

    // Get button elements
    const receiveBtn = document.getElementById('bulkSerializedReceiveBtn');
    const issueBtn = document.getElementById('bulkSerializedReceiveIssueBtn');
    const receiveBulkSerializedCountSpan = document.getElementById('bulkSerializedReceiveCount');
    const issueBulkSerializedCountSpan = document.getElementById('bulkSerializedIssueCount');

    // Update count display
    if (receiveBulkSerializedCountSpan) {
        receiveBulkSerializedCountSpan.textContent = mfgrsns.length;
    }
    if (issueBulkSerializedCountSpan) {
        issueBulkSerializedCountSpan.textContent = mfgrsns.length;
    }

    // Validation logic
    const hasBasicRequirements = mfgrsns.length > 0 && itemType && location;
    const hasCrewForIssue = hasBasicRequirements && crew;

    // Enable/disable buttons
    if (receiveBtn) receiveBtn.disabled = !hasBasicRequirements;
    if (issueBtn) issueBtn.disabled = !hasCrewForIssue;
}

/**
 * Populate dropdowns with appropriate options
 */
async function populateBulkSerializedDropdowns() {
    // Serialized Item Types
    const itemTypes = getCachedTable('item_types').filter(row => {
        const invType = getCachedRow('inventory_types', row.inventory_type_id);
        return invType && invType.name === 'Serialized';
    });
    const bulkItemTypeSelect = document.getElementById('bulkSerializedItemType');
    bulkItemTypeSelect.innerHTML = '<option value="">Select Serialized Item Type</option>';
    itemTypes.sort((a, b) => a.name.localeCompare(b.name)).forEach(row => {
        const option = document.createElement('option');
        option.value = row.id;
        option.textContent = row.name;
        bulkItemTypeSelect.appendChild(option);
    });

    // Crew Dropdown
    let crews = getCachedTable('crews');
    if (window.selectedMarketId) {
        crews = crews.filter(row => row.market_id == window.selectedMarketId);
    }
    const bulkCrewSelect = document.getElementById('bulk_serialized_assigned_crew_id');
    if (bulkCrewSelect) {
        bulkCrewSelect.innerHTML = '<option value="">Select Crew</option>';
        crews.forEach(row => {
            const option = document.createElement('option');
            option.value = row.id;
            option.textContent = row.name;
            bulkCrewSelect.appendChild(option);
        });
    }

    // DFN Dropdown
    const dfns = getCachedTable('dfns').filter(row => row.sloc_id === window.selectedSlocId || row.sloc_id === null);
    const bulkDfnSelect = document.getElementById('bulk_serialized_dfn_id');
    if (bulkDfnSelect) {
        bulkDfnSelect.innerHTML = '<option value="">Select DFN</option>';
        dfns.forEach(row => {
            const option = document.createElement('option');
            option.value = row.id;
            option.textContent = row.name;
            bulkDfnSelect.appendChild(option);
        });
    }
}

window.populateBulkSerializedDropdowns = populateBulkSerializedDropdowns;
/**
 * Process bulk serialized receiving
 */
async function processBulkSerializedReceiving() {
    console.log("processBulkSerializedReceiving called...");
    const mfgrsns = window.mfgrSnTagify ? window.mfgrSnTagify.value.map(t => t.value) : [];
    const itemTypeId = $('#bulkSerializedItemType').val();
    //const locationId = $('#bulkLocation').val();
    const locationId = 1;

    console.log("mfgrsns:", mfgrsns);
    console.log("itemTypeId:", itemTypeId);
    console.log("locationId:", locationId);

    if (mfgrsns.length === 0 || !itemTypeId || !locationId) {
        alert('Please fill in all required fields and add at least one manufacturer SN.');
        return;
    }
    
    try {
        console.log(`🚀 Processing bulk serialized receiving for ${mfgrsns.length} items...`);
        
        // Show loading state
        const button = document.getElementById('bulkReceiveSerializedBtn');
        const originalText = button.innerHTML;
        button.disabled = true;
        button.innerHTML = '⏳ Processing...';
        
        // Generate SN pairs
        const snPairs = reserveTilsonSNs(mfgrsns);
        
        // Create inventory data for each item
        const inventoryItems = mfgrsns.map(mfgrsn => ({
            item_type_id: itemTypeId,
            location_id: locationId,
            mfgrsn: mfgrsn,
            tilsonsn: snPairs[mfgrsn],
            quantity: 1 // Serialized items are always quantity 1
        }));
        
        // Process bulk insertion
        const result = await processBulkInventory(inventoryItems, 'receive');
        
        if (result.success) {
            // Update Tilson SN counter
            updateTilsonSNCounter(mfgrsns.length);
            
            // Show success message
            alert(`✅ Successfully received ${result.successCount} serialized items!`);
            
            // Clear form
            clearBulkSerializedForm();
            
            // Refresh inventory display if visible
            if (document.getElementById('inventoryAccordion').classList.contains('active')) {
                await loadInventoryList();
            }
            
        } else {
            console.error('Bulk serialized receiving failed:', result.error);
            alert(`❌ Error: ${result.error}`);
        }
        
    } catch (error) {
        console.error('Error in bulk serialized receiving:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        // Restore button state
        const button = document.getElementById('bulkReceiveSerializedBtn');
        button.disabled = false;
        button.innerHTML = originalText;
    }
}

/**
 * Clear bulk serialized form
 */
function clearBulkSerializedForm() {
    if (window.mfgrSnTagify) window.mfgrSnTagify.removeAllTags();
    $('#bulkItemType').val('');
    $('#bulkCrew').val('');
    $('#bulkDfn').val('');
    $('#batchSnCount').val('');
    updateSNPreview();
    updateBulkSerializedReceiveButton();
    //console.log('🗑️ Bulk serialized form cleared');
}

/**
 * Process bulk action for multiple serial numbers
 */
async function processBulkSerializedAction(actionType) {
    // Check if the button is actually enabled before proceeding
    const buttons = {
        'receive': document.getElementById('bulkSerializedReceiveBtn'),
        'issue': document.getElementById('bulkSerializedReceiveIssueBtn')
    };
    
    const button = buttons[actionType];
    if (!button) {
        console.error(`❌ Button for action '${actionType}' not found`);
        return;
    }
    
    if (button.disabled) {
        console.warn(`⚠️ Button for action '${actionType}' is disabled, preventing execution`);
        return;
    }
    
    const mfgrsns = window.mfgrSnTagify ? window.mfgrSnTagify.value.map(t => t.value) : [];
    const itemTypeId = $('#bulkSerializedItemType').val();
    const locationId = 1; // Hardcoded location ID
    const crewId = parseInt($('#bulk_serialized_assigned_crew_id').val());
    const dfnId = $('#bulk_serialized_dfn_id').val();


    console.log(`actionType: ${actionType}, dfnID: ${dfnId}, crewID: ${crewId}, itemTypeID: ${itemTypeId}`);


    // Validate based on action type
    if (mfgrsns.length === 0 || !itemTypeId || !locationId) {
        alert('Please fill in all required fields and add at least one manufacturer SN.');
        return;
    }
    
    if (actionType === 'issue' && !crewId) {
        alert('Please select a crew for issuing items.');
        return;
    }
    
    try {
        console.log(`🚀 Processing bulk ${actionType} for ${mfgrsns.length} items...`);
        
        // Disable button during processing - CSS handles styling
        button.disabled = true;
        
        // Generate SN pairs for all items
        const snPairs = reserveTilsonSNs(mfgrsns);
        
        // Process each item based on action type
        let successCount = 0;
        const errors = [];

        

        for (let i = 0; i < mfgrsns.length; i++) {
            const mfgrsn = mfgrsns[i];
            const tilsonsn = snPairs[mfgrsn];
            
            try {
                
                switch (actionType) {
                    case 'receive':
                        await receiveSerializedItem(mfgrsn, tilsonsn, itemTypeId, locationId, dfnId || null);
                        break;
                        
                    case 'issue':
                        await issueSerializedItem(mfgrsn, tilsonsn, itemTypeId, crewId, dfnId || null);
                        break;
                }
                
                successCount++;
                
            } catch (error) {
                console.error(`❌ Error processing ${mfgrsn}:`, error);
                errors.push(`${mfgrsn}: ${error.message}`);
            }
        }
        
        // Show results
        if (successCount === mfgrsns.length) {
            //alert(`✅ Successfully processed ${successCount} items with ${actionType} action!`);
            clearBulkSerializedForm();
            updateTilsonSNCounter(mfgrsns.length + 1);

            // Always refresh inventory tables after bulk receive/issue
            if (typeof loadInventoryList === 'function') {
                await loadInventoryList();
            }
        } else {
            alert(`⚠️ Processed ${successCount} of ${mfgrsns.length} items. Errors:\n${errors.join('\n')}`);
            // Still refresh to reflect partial changes
            if (typeof loadInventoryList === 'function') {
                await loadInventoryList();
            }
        }
        
        // Update inventory display if it exists
        if (typeof loadInventoryData === 'function') {
            loadInventoryData();
        }

        // Update Item Type History to reflect new records
        if (typeof loadItemTypeHistory === 'function') {
            //console.log('🔄 Updating Item Type History after bulk operation...');
            await loadItemTypeHistory(itemTypeId);
            //console.log('✅ Item Type History updated');
        } else {
            console.warn('⚠️ loadItemTypeHistory function not found');
        }
        
    } catch (error) {
        console.error(`❌ Error in bulk ${actionType}:`, error);
        alert(`Error processing bulk ${actionType}: ${error.message}`);
    } finally {
        // Re-enable button validation - let updateBulkSerializedReceiveButton handle the state
        updateBulkSerializedReceiveButton();
    }
}

// Helper functions for individual actions
async function receiveSerializedItem(mfgrsn, tilsonsn, itemTypeId, locationId, dfnId = null) {
    // Get the status ID for 'Available'
    const statusId = getStatusId('Available');
    if (!statusId) throw new Error("Status 'Available' not found in cache");

    // Get the units_per_package from the item type
    const { data: itemTypeRow, error: itemTypeError } = await supabase
        .from('item_types')
        .select('units_per_package')
        .eq('id', itemTypeId)
        .eq('market_id', window.selectedMarketId)
        .single();
    if (itemTypeError || !itemTypeRow) {
        throw new Error(`Item type with ID ${itemTypeId} not found`);
    }
    const quantity = itemTypeRow.units_per_package || 1; // Default to 1 if null

    // Insert inventory record
    const { data: insertData, error: insertError } = await supabase
        .from('inventory')
        .insert([{
            tilsonsn,
            mfgrsn,
            item_type_id: itemTypeId,
            location_id: locationId,
            status_id: statusId,
            quantity,
            dfn_id: dfnId || null,
            sloc_id: window.selectedSlocId
        }])
        .select('id')
        .single();

    if (insertError || !insertData) {
        throw new Error(`Failed to insert inventory record: ${insertError?.message || 'Unknown error'}`);
    }
    const insertedID = insertData.id;

    // Log transaction for receiving
    if (window.transactionLogger && insertedID) {
        try {
            await window.transactionLogger.logInventoryCreated(insertedID, {
                tilsonsn,
                mfgrsn,
                item_type_id: itemTypeId,
                location_id: locationId,
                status: 'Available',
                quantity,
                action: 'receive',
                transaction_type: 'receive'
            });
        } catch (error) {
            console.warn('Failed to log inventory creation transaction:', error);
        }
    }

    console.log(`✅ Received: ${mfgrsn} → ${tilsonsn} (${statusId}) - Quantity: ${quantity}`);
    return insertedID;
}


async function issueSerializedItem(mfgrsn, tilsonsn, itemTypeId, crewId, dfnId = null) {
    // First, receive the item (creates inventory record as 'Available')
    const inventoryId = await receiveSerializedItem(mfgrsn, tilsonsn, itemTypeId, 1);

    // Get the location ID for 'With Crew'
    const location_id = getWithCrewLocationId();
    if (!location_id) {
        throw new Error(`Location 'With Crew' not found in cache`);
    }

    // Get the status ID for 'Issued'
    const statusId = getStatusId('Issued');
    if (!statusId) throw new Error("Status 'Issued' not found in cache");

    // Update the inventory record to set as issued
    const { error: updateError } = await supabase
        .from('inventory')
        .update({
            status_id: statusId,
            assigned_crew_id: crewId,
            dfn_id: dfnId || null,
            location_id: location_id
        })
        .eq('id', inventoryId);

    if (updateError) {
        throw new Error(`Failed to update inventory record: ${updateError.message}`);
    }

    // Log the issue transaction
    if (window.transactionLogger && inventoryId) {
        try {
            await window.transactionLogger.logInventoryUpdated(
                inventoryId,
                { status: 'Available' },
                { status: 'Issued', assigned_crew_id: crewId, dfn_id: dfnId },
                { action: 'issue', transaction_type: 'issue', mfgrsn, tilsonsn }
            );
        } catch (error) {
            console.warn('Failed to log issue transaction:', error);
        }
    }

    console.log(`✅ Issued: ${mfgrsn} → ${tilsonsn} to crew ${crewId}`);
}


async function getAvailableBulkItemTypeQuantity(itemTypeId) {
    // Use cache for status id
    const statusRow = getCachedRowByField('statuses', 'name', 'Available');
    if (!statusRow) {
        console.error("Status 'Available' not found.");
        return 0;
    }
    const statusId = statusRow.id;

    // Sum the quantity for this item type, status, and SLOC
    const { data, error } = await supabase
        .from('inventory')
        .select('quantity')
        .eq('item_type_id', itemTypeId)
        .eq('status_id', statusId)
        .eq('sloc_id', window.selectedSlocId);

    if (error || !data) {
        console.error('Error fetching available quantity:', error);
        return 0;
    }

    // Sum up all quantities
    const total = data.reduce((sum, row) => sum + (row.quantity || 0), 0);
    return total;
}

async function reduceAvailableQuantity(inventoryData, totalRows = 1, currentIndex = 0) {
    // Use cache for status/location ids
    const availableStatusRow = getCachedRowByField('statuses', 'name', 'Available');
    const issuedStatusRow = getCachedRowByField('statuses', 'name', 'Issued');
    const withCrewLocRow = getCachedRowByField('locations', 'name', 'With Crew');
    if (!availableStatusRow || !issuedStatusRow || !withCrewLocRow) {
        return { success: false, error: "Required status or location not found in cache." };
    }
    const availableStatusId = availableStatusRow.id;
    const issuedStatusId = issuedStatusRow.id;
    const withCrewLocId = withCrewLocRow.id;

    // Get available inventory rows for this item type, status, and SLOC
    const { data: availableRows, error: availableRowsError } = await supabase
        .from('inventory')
        .select('id, quantity')
        .eq('item_type_id', inventoryData.item_type_id)
        .eq('status_id', availableStatusId)
        .eq('sloc_id', window.selectedSlocId)
        .order('quantity', { ascending: false });

    if (availableRowsError || !availableRows || availableRows.length === 0) {
        console.error('No available inventory found for this item type.');
        return { success: false, error: 'No available inventory found for this item type.' };
    }

    // Calculate total available quantity
    const totalAvailable = availableRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

    if (inventoryData.quantity > totalAvailable) {
        return { success: false, error: 'Not enough available quantity to issue.' };
    }

    let qtyToIssue = inventoryData.quantity;
    let newRowResultID = null;

    try {
        for (const row of availableRows) {
            if (qtyToIssue <= 0) break;

            if (row.quantity > qtyToIssue) {
                // Reduce the available row's quantity
                const newAvailableQty = row.quantity - qtyToIssue;
                await supabase
                    .from('inventory')
                    .update({ quantity: newAvailableQty })
                    .eq('id', row.id);

                // Insert a new row for the issued quantity
                const { data: insertData, error: insertError } = await supabase
                    .from('inventory')
                    .insert([{
                        item_type_id: inventoryData.item_type_id,
                        quantity: qtyToIssue,
                        status_id: issuedStatusId,
                        location_id: withCrewLocId,
                        dfn_id: inventoryData.dfn_id || null,
                        assigned_crew_id: inventoryData.assigned_crew_id || null,
                        sloc_id: window.selectedSlocId
                    }])
                    .select('id')
                    .single();

                if (insertError || !insertData) {
                    throw new Error('Failed to insert issued inventory record.');
                }
                newRowResultID = insertData.id;
                qtyToIssue = 0;
            } else if (row.quantity === qtyToIssue) {
                // Update the row to 'Issued' and assign crew/location/dfn
                await supabase
                    .from('inventory')
                    .update({
                        status_id: issuedStatusId,
                        assigned_crew_id: inventoryData.assigned_crew_id || null,
                        location_id: withCrewLocId,
                        dfn_id: inventoryData.dfn_id || null
                    })
                    .eq('id', row.id);
                newRowResultID = row.id;
                qtyToIssue = 0;
            } else {
                // Use up this row and continue
                await supabase
                    .from('inventory')
                    .update({ quantity: 0 })
                    .eq('id', row.id);

                // Insert a new row for the issued quantity (equal to row.quantity)
                const { data: insertData, error: insertError } = await supabase
                    .from('inventory')
                    .insert([{
                        item_type_id: inventoryData.item_type_id,
                        quantity: row.quantity,
                        status_id: issuedStatusId,
                        location_id: withCrewLocId,
                        dfn_id: inventoryData.dfn_id || null,
                        assigned_crew_id: inventoryData.assigned_crew_id || null,
                        sloc_id: window.selectedSlocId
                    }])
                    .select('id')
                    .single();

                if (insertError || !insertData) {
                    throw new Error('Failed to insert issued inventory record.');
                }
                newRowResultID = insertData.id;
                qtyToIssue -= row.quantity;
            }
        }

        // Log the change
        if (window.transactionLogger && newRowResultID) {
            await window.transactionLogger.logInventoryUpdated(
                newRowResultID,
                {
                    quantity: totalAvailable,
                    status: 'Available',
                    location: inventoryData.location_id,
                    dfn: inventoryData.dfn_id,
                    crew: null
                },
                {
                    quantity: inventoryData.quantity,
                    status: 'Issued',
                    location: withCrewLocId,
                    dfn: inventoryData.dfn_id,
                    crew: inventoryData.assigned_crew_id
                },
                { action: 'issue', transaction_type: 'issue' }
            );
        }

        return { success: true };
    } catch (error) {
        console.error('Error reducing available quantity:', error);
        return { success: false, error: error.message };
    }
}


async function reduceAvailableQuantityBatch(inventoryDataArray) {
    const totalRows = inventoryDataArray.length;
    const results = await Promise.all(
        inventoryDataArray.map((item, idx) =>
            reduceAvailableQuantity(item, totalRows, idx)
        )
    );
    const errors = results.filter(r => !r.success);
    return {
        success: errors.length === 0,
        results,
        errors
    };
}

function displaySlocValue() {
    const slocSelect = document.getElementById('slocSelect');
    const slocDiv = document.getElementById('slocDisplay');
    if (!slocSelect || !slocDiv) return;

    const selectedOption = slocSelect.options[slocSelect.selectedIndex];
    const slocName = selectedOption && selectedOption.value ? selectedOption.textContent : '';
    slocDiv.innerHTML = slocName ? `<h2>SLOC: ${slocName}</h2>` : '<h2>SLOC: Not Set</h2>';
}


async function getconfigValue(key) {
    try {
        const { data, error } = await supabase
            .from('config')
            .select('value')
            .eq('key', key)
            .single();
        if (error) {
            console.error(`Could not get config value for ${key}:`, error);
            return null;
        }
        return data?.value ?? null;
    } catch (e) {
        console.error(`Could not get config value for ${key}:`, e);
        return null;
    }
}


// Hide/show rows in the Manage Bulk Items depending on on Issue process state:
function filterBulkIssueRowsByAvailability(showOnlyAvailable) {
    const table = document.getElementById('bulkItemTypesMatrix');
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    rows.forEach(row => {
        const availableCell = row.querySelector('td:first-child');
        const availableQty = parseInt((availableCell?.textContent || '0').replace(/,/g, ''), 10);
        if (showOnlyAvailable && availableQty <= 0) {
            row.classList.add('hidden-by-availability');
        } else {
            row.classList.remove('hidden-by-availability');
        }
    });
}

// Update the visibility of the "Begin Serialized Issue" button based on state
function updateSerializedIssueButtons() {
    const beginBtn = document.getElementById('beginSerializedIssueBtn');
    if (!beginBtn) return;
    if (serializedIssueState === 'selecting' || serializedIssueState === 'confirming') {
        beginBtn.style.display = 'none';
    } else {
        beginBtn.style.display = '';
    }
}

/**
 * Initialize and handle Client, Market, and SLOC dropdowns in the sidebar
 */
async function initializeClientMarketSlocDropdowns() {
    const clientSelect = document.getElementById('clientSelect');
    const marketSelect = document.getElementById('marketSelect');
    const slocSelect = document.getElementById('slocSelect');

    if (!clientSelect || !marketSelect || !slocSelect) {
        console.warn('One or more sidebar dropdowns not found.');
        return;
    }

    // Helper to clear and disable a select
    function clearAndDisable(select, placeholder) {
        select.innerHTML = `<option value="">${placeholder}</option>`;
        select.disabled = true;
    }

    // Helper to enable a select
    function enable(select) {
        select.disabled = false;
    }

    // Populate Clients
    async function populateClients() {
        clearAndDisable(clientSelect, 'Select Client');
        const { data, error } = await supabase
            .from('clients')
            .select('id, name')
            .order('name', { ascending: true });
        if (error) {
            console.error('Error loading clients:', error);
            return;
        }
        if (data && data.length > 0) {
            data.forEach(({ id, name }) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = name;
                clientSelect.appendChild(opt);
            });
            enable(clientSelect);
        }
    }

    // Populate Markets for a given client_id
    async function populateMarkets(clientId) {
        clearAndDisable(marketSelect, 'Select Market');
        clearAndDisable(slocSelect, 'Select SLOC');
        if (!clientId) return;
        const { data, error } = await supabase
            .from('markets')
            .select('id, name')
            .eq('client_id', clientId)
            .order('name', { ascending: true });
        if (error) {
            console.error('Error loading markets:', error);
            return;
        }
        if (data && data.length > 0) {
            data.forEach(({ id, name }) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = name;
                marketSelect.appendChild(opt);
            });
            enable(marketSelect);
        }
    }

    // Populate SLOCs for a given market_id
    async function populateSlocs(marketId) {
        clearAndDisable(slocSelect, 'Select SLOC');
        if (!marketId) return;
        const { data, error } = await supabase
            .from('slocs')
            .select('id, name')
            .eq('market_id', marketId)
            .order('name', { ascending: true });
        if (error) {
            console.error('Error loading SLOCs:', error);
            return;
        }
        if (data && data.length > 0) {
            data.forEach(({ id, name }) => {
                const opt = document.createElement('option');
                opt.value = id;
                opt.textContent = name;
                slocSelect.appendChild(opt);
            });
            enable(slocSelect);
        }
        // Update SLOC display when SLOCs are repopulated (reset to Not Set)
        displaySlocValue();
    }

    // Initial population
    await populateClients();
    clearAndDisable(marketSelect, 'Select Market');
    clearAndDisable(slocSelect, 'Select SLOC');
    displaySlocValue();

    // Listeners
    clientSelect.addEventListener('change', async function() {
        const clientId = this.value;
        await populateMarkets(clientId);
        displaySlocValue(); // Reset SLOC display when client changes
    });

    marketSelect.addEventListener('change', async function() {
        const marketId = this.value;
        await populateSlocs(marketId);
        displaySlocValue(); // Reset SLOC display when market changes
        window.selectedMarketId = this.value ? parseInt(this.value, 10) : null;
        console.log("selected market ID:", window.selectedMarketId, "selected SLOC ID:", window.selectedSlocId);
    });

slocSelect.addEventListener('change', function() {
    displaySlocValue();
    window.selectedSlocId = this.value ? parseInt(this.value, 10) : null;
    resetBulkReceiveAndIssueProcessForms();

    // Remove and refresh bulk item types table
    const bulkTableContainer = document.getElementById('bulkItemTypesTable');
    const existingBulkTable = bulkTableContainer.querySelector('#bulkItemTypesMatrix');
    if (existingBulkTable) {
        existingBulkTable.remove();
    }
    refreshBulkItemTypesTable();

    // Remove and refresh bulk inventory table
    const bulkInventorySection = document.getElementById('bulkInventorySection');
    const existingBulkInventoryTable = bulkInventorySection.querySelector('#bulkInventoryTable');
    if (existingBulkInventoryTable) {
        existingBulkInventoryTable.remove();
    }
    loadBulkInventoryList();

    // Remove and refresh serialized inventory hierarchy
    const serializedInventorySection = document.getElementById('serializedInventorySection');
    const existingSerializedHierarchy = serializedInventorySection.querySelector('#serializedInventoryHierarchy');
    if (existingSerializedHierarchy) {
        existingSerializedHierarchy.innerHTML = '';
    }
    loadSerializedInventoryList();

    // Update button states
    updateBulkButtonStates();
});
}


async function setCurrentUserFromSupabase() {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (user) {
        window.currentUser = {
            id: user.id,
            name: user.user_metadata?.full_name || user.email || 'Unknown User',
            email: user.email
        };
    } else {
        window.currentUser = { id: null, name: 'Unknown User', email: '' };
        if (error) {
            console.warn('Could not fetch current user:', error);
        }
    }
}

/**
 * Prepare inventory data for database insertion
 * @param {Object} rawData - Raw form data or input data
 * @param {string} action - Action type ('receive', 'issue')
 * @returns {Promise<Object>} - Prepared inventory data
 */
async function prepareInventoryData(rawData, action = 'receive') {
    const itemTypeInfo = await getItemTypeInfo(rawData.item_type_id);
    console.log("itemTypeInfo:", itemTypeInfo);

    // Determine status based on action
    let statusName;
    let locationId = 1; // Default location ID (e.g., Warehouse)
    let assignedCrewId = null;

    switch (action) {
        case 'receive':
            statusName = 'Available';
            break;
        case 'issue':
            statusName = 'Issued';
            locationId = getWithCrewLocationId();
            assignedCrewId = rawData.assigned_crew_id ? parseInt(rawData.assigned_crew_id, 10) : null;
            break;
        default:
            statusName = 'Available';
    }

    const statusId = getStatusId(statusName);

    // Determine quantity - for serialized items, use units_per_package
    const quantity = itemTypeInfo.isSerializedType ?
        itemTypeInfo.unitsPerPackage :
        parseInt(rawData.quantity, 10) || 1;

    return {
        location_id: parseInt(locationId, 10),
        assigned_crew_id: assignedCrewId,
        dfn_id: rawData.dfn_id ? parseInt(rawData.dfn_id, 10) : null,
        item_type_id: parseInt(rawData.item_type_id, 10),
        mfgrsn: rawData.mfgrsn || null,
        tilsonsn: rawData.tilsonsn || null,
        quantity: quantity,
        status_id: statusId,
        sloc_id: window.selectedSlocId,
        itemTypeInfo: itemTypeInfo
    };
}

// Populate the "Manage Others" dropdown with table names
function populateManageOthersDropdown() {
    console.log("Populating Manage Others dropdown...");
    const dropdown = document.getElementById('manageOthersSelect');
    if (!dropdown) return;
    dropdown.innerHTML = '<option value="">Select Table...</option>';
    getTableNames().forEach(table => {
        const option = document.createElement('option');
        option.value = table;
        option.textContent = table.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        dropdown.appendChild(option);
    });
}

function setActiveSidebarButton(buttonId) {
    // Remove 'active' class from all sidebar buttons
    document.querySelectorAll('nav.sidebar button').forEach(btn => btn.classList.remove('active'));
    // Add 'active' class to the clicked button
    const activeBtn = document.getElementById(buttonId);
    if (activeBtn) activeBtn.classList.add('active');
}







































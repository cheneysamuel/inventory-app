// manageRecords.js

// for storing market & SLOC values:
window.selectedMarketId = null;
window.selectedSlocId = null;


// ============================================================================
// DATABASE SCHEMA & METADATA UTILITIES
// ============================================================================

/**
 * Retrieve all table names from the database
 */
function getTableNames() {
    // List your tables here, or fetch from a config table if you want it dynamic
    return [
        'item_types', 'inventory', 'locations', 'crews', 'dfns', 'statuses',
        'categories', 'inventory_types', 'units_of_measure', 'inventory_providers',
        'location_types', 'transaction_types', 'inv_action_types', 'clients', 'markets', 'slocs', 'config'
    ];
}

/**
 * Retrieve table column names for a given table
 * @param {string} table - Table name
 * @returns {Array<string>} - Array of column names
 */
function getTableInfo(table) {
    const schemas = {
        clients: ['id', 'name', 'address', 'created_at', 'updated_at'],
        markets: ['id', 'name', 'client_id', 'created_at', 'updated_at'],
        slocs: ['id', 'name', 'address', 'market_id', 'created_at', 'updated_at'],
        transaction_types: ['id', 'name'],
        units_of_measure: ['id', 'name'],
        inventory_providers: ['id', 'name'],
        inventory_types: ['id', 'name'],
        categories: ['id', 'name'],
        item_types: [
            'id', 'inventory_type_id', 'name', 'manufacturer', 'part_number',
            'unit_of_measure_id', 'units_per_package', 'description', 'provider_id',
            'low_units_quantity', 'category_id', 'image_path', 'meta', 'market_id',
            'created_at', 'updated_at'
        ],
        location_types: ['id', 'name'],
        locations: ['id', 'name', 'loc_type_id', 'is_system_required'],
        crews: ['id', 'name', 'market_id', 'created_at', 'updated_at'],
        dfns: ['id', 'name', 'sloc_id', 'created_at', 'updated_at'],
        statuses: ['id', 'name'],
        inv_action_types: ['id', 'name', 'loc_type_id', 'description'],
        action_statuses: ['id', 'inv_action_id', 'status_id'],
        inventory: [
            'id', 'location_id', 'assigned_crew_id', 'dfn_id', 'item_type_id',
            'mfgrSN', 'tilsonSN', 'quantity', 'status_id', 'sloc_id',
            'created_at', 'updated_at'
        ],
        qty_allocations: [
            'id', 'quantity_id', 'dfn_id', 'allocated_quantity', 'installed_quantity',
            'allocated_date', 'allocation_name', 'notes'
        ],
        transactions: [
            'id', 'inventory_id', 'transaction_type', 'action',
            'client', 'market', 'sloc',
            'item_type_name', 'inventory_type_name', 'manufacturer', 'part_number',
            'description', 'unit_of_measure', 'units_per_package', 'provider_name',
            'category_name', 'mfgrSN', 'tilsonSN', 'from_location_name',
            'from_location_type', 'to_location_name', 'to_location_type',
            'assigned_crew_name', 'dfn_name', 'status_name', 'old_status_name',
            'quantity', 'old_quantity', 'user_name', 'date_time', 'session_id',
            'notes', 'ip_address', 'user_agent', 'before_state', 'after_state'
        ],
        config: ['key', 'value']
    };
    // Support both lowercase and uppercase table names
    return schemas[table] || schemas[table?.toLowerCase()] || [];
}

/**
 * Retrieve foreign key information for a table (hardcoded for Supabase/Postgres)
 * @param {string} table - Table name
 * @returns {Array<Object>} - Array of foreign key information objects
 */
function getForeignKeys(table) {
    // All table names should be lowercase for this mapping
    const fks = {
        markets: [
            {
                id: 0, seq: 0, table: 'clients', from: 'client_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE'
            }
        ],
        slocs: [
            {
                id: 0, seq: 0, table: 'markets', from: 'market_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'CASCADE', match: 'NONE'
            }
        ],
        item_types: [
            {
                id: 0, seq: 0, table: 'inventory_types', from: 'inventory_type_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 1, seq: 1, table: 'units_of_measure', from: 'unit_of_measure_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 2, seq: 2, table: 'inventory_providers', from: 'provider_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 3, seq: 3, table: 'categories', from: 'category_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 4, seq: 4, table: 'markets', from: 'market_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        locations: [
            {
                id: 0, seq: 0, table: 'location_types', from: 'loc_type_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        crews: [
            {
                id: 0, seq: 0, table: 'markets', from: 'market_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        dfns: [
            {
                id: 0, seq: 0, table: 'slocs', from: 'sloc_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        inv_action_types: [
            {
                id: 0, seq: 0, table: 'location_types', from: 'loc_type_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        action_statuses: [
            {
                id: 0, seq: 0, table: 'inv_action_types', from: 'inv_action_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'RESTRICT', match: 'NONE'
            },
            {
                id: 1, seq: 1, table: 'statuses', from: 'status_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'RESTRICT', match: 'NONE'
            }
        ],
        inventory: [
            {
                id: 0, seq: 0, table: 'locations', from: 'location_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 1, seq: 1, table: 'crews', from: 'assigned_crew_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 2, seq: 2, table: 'dfns', from: 'dfn_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 3, seq: 3, table: 'item_types', from: 'item_type_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'RESTRICT', match: 'NONE'
            },
            {
                id: 4, seq: 4, table: 'statuses', from: 'status_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            },
            {
                id: 5, seq: 5, table: 'slocs', from: 'sloc_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'SET NULL', match: 'NONE'
            }
        ],
        qty_allocations: [
            {
                id: 0, seq: 0, table: 'inventory', from: 'quantity_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'RESTRICT', match: 'NONE'
            },
            {
                id: 1, seq: 1, table: 'dfns', from: 'dfn_id', to: 'id',
                on_update: 'CASCADE', on_delete: 'RESTRICT', match: 'NONE'
            }
        ]
        // Add more tables as needed...
    };
    // Support both lowercase and uppercase table names
    return fks[table] || fks[table?.toLowerCase()] || [];
}

/**
 * Get column label mapping for foreign key references
 * @param {string} refTable - Referenced table name
 * @returns {string} - Column name to use for labels
 */
function getForeignKeyLabelColumn(refTable) {
    // const labelMappings = {
    //     'TRANSACTION_TYPES': 'name',
    //     'UNITS_OF_MEASURE': 'name',
    //     'INVENTORY_PROVIDERS': 'name',
    //     'LOCATION_TYPES': 'name',
    //     'LOCATIONS': 'name',
    //     'CREWS': 'name',
    //     'DFNS': 'name',
    //     'STATUSES': 'name',
    //     'INV_ACTION_TYPES': 'name',
    //     'ITEM_TYPES': 'description',
    //     'INVENTORY_TYPES': 'name',
    //     'CATEGORIES': 'name',
    //     'CLIENTS': 'name',
    //     'MARKETS': 'name',
    //     'SLOCS': 'name'
    // };
    
    // return labelMappings[refTable] || 'id';
    // just return 'name' for all tables
    return 'name';
}



// Expose schema utilities globally
window.getTableNames = getTableNames;
window.getTableInfo = getTableInfo;
window.getForeignKeys = getForeignKeys;



// ============================================================================
// FORM GENERATION UTILITIES
// ============================================================================

/**
 * Create input element based on column type and foreign key information
 * @param {Object} column - Column information
 * @param {Array} foreignKeys - Foreign key information
 * @param {Object} db - Database instance
 * @param {any} value - Current value (for edit mode)
 * @returns {HTMLElement} - Input element
 */
function createInputElement(column, foreignKeys, db, value = null) {
    const fks = foreignKeys.filter(f => f.from === column.name);
    let input;
    
    if (fks.length > 0) {
        // Create dropdown for foreign key fields
        input = document.createElement('select');
        input.name = column.name;
        
        // Add default option based on whether the field is nullable
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        if (column.notnull === 0) {
            defaultOption.textContent = '-- None --';
        } else {
            defaultOption.textContent = '-- Select --';
        }
        input.appendChild(defaultOption);
        
        fks.forEach(fk => {
            const labelCol = getForeignKeyLabelColumn(fk.table);
            const tableName = fk.table.toLowerCase();
            let cachedRows = getCachedTable(tableName);
            if (tableName === 'crews' && window.selectedMarketId) {
                cachedRows = cachedRows.filter(row => row.market_id == window.selectedMarketId);
            }
            if (tableName === 'dfns' && window.selectedSlocId) {
                cachedRows = cachedRows.filter(row => row.sloc_id == window.selectedSlocId);
            }
            if (tableName === 'item_types' && window.selectedMarketId) {
                cachedRows = cachedRows.filter(row => row.market_id == window.selectedMarketId);
            }
            cachedRows.forEach(row => {
                const opt = document.createElement('option');
                opt.value = row[fk.to];
                opt.textContent = row[labelCol] || row[fk.to];
                input.appendChild(opt);
            });
        });
    } else {
        // Create regular input for non-foreign key fields
        input = document.createElement('input');
        input.name = column.name;
        
        // Special handling for boolean-like fields
        if (column.name === 'is_system_required') {
            input.type = 'checkbox';
            input.value = '1'; // When checked, it will submit '1'
            
            // For checkboxes, we need to handle the value differently
            if (value !== null) {
                input.checked = (value === 1 || value === true || value === 'true');
            }
            
            console.log(`🔧 Creating checkbox: name=${column.name}, value="${input.value}", checked=${input.checked}, initialValue=${value}`);
            
            // Add special styling for the checkbox
            input.style.width = 'auto';
            input.style.height = '18px';
            input.style.margin = '0';
            input.style.transform = 'scale(1.2)';
        } else {
            // Set input type based on column type
            if (column.type.includes('INT')) {
                input.type = 'number';
            } else if (column.type === 'DATETIME') {
                input.type = 'datetime-local';
            } else {
                input.type = 'text';
            }
            
            // Set value if provided (for non-checkbox inputs)
            if (value !== null && input.type !== 'checkbox') {
                input.value = value || column.dflt_value || '';
            }
        }
        
        // Set required attribute for NOT NULL columns (but not for checkboxes)
        if (column.name !== 'is_system_required') {
            input.required = (column.notnull === 1 && 
                ['id', 'location_id', 'item_type_id', 'quantity', 'status_id'].includes(column.name));
        }
    }
    
    return input;
}

/**
 * Generate a dynamic form based on table schema
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Array} columns - Table column information
 * @param {Array} foreignKeys - Foreign key information
 * @param {Object} rowData - Row data for edit mode (null for add mode)
 * @returns {HTMLFormElement} - Generated form element
 */
function generateForm(db, table, columns, foreignKeys, rowData = null) {
    const form = document.createElement('form');
    form.id = rowData ? 'editForm' : 'addForm';
    form.className = 'table-management-form';

    // Add form title
    const title = document.createElement('h3');
    title.textContent = rowData ? `Edit ${table} Record` : `Add New ${table} Record`;
    title.style.margin = '0 0 20px 0';
    title.style.color = '#495057';
    title.style.fontSize = '18px';
    title.style.fontWeight = '600';
    title.style.borderBottom = '2px solid #667eea';
    title.style.paddingBottom = '8px';
    form.appendChild(title);

    // Create compact form fields container
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'compact-form-grid';

    columns.forEach(col => {
        // Get column name safely
        const colName = typeof col === 'object' ? col.name : col;
        if (!colName) return; // Skip columns with no name


        // Skip primary key fields for add forms unless they are foreign keys
        if (!rowData && col.pk && col.type === 'INTEGER' &&
            !foreignKeys.some(fk => fk.from === colName)) return;

        // Create compact field row
        const fieldRow = document.createElement('div');
        fieldRow.className = 'compact-form-row';

        const label = document.createElement('label');
        label.textContent = colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        label.className = 'compact-form-label';

        // Add required indicator for non-nullable fields
        if (col.notnull && !col.pk) {
            label.style.color = '#dc3545';
        }

        fieldRow.appendChild(label);

        const value = rowData ? rowData[colName] : null;
        const input = createInputElement(col, foreignKeys, db, value);

        // Apply compact styling based on input type
        if (input.tagName === 'SELECT') {
            input.className = 'compact-form-select';
        } else if (input.tagName === 'TEXTAREA') {
            input.className = 'compact-form-textarea';
            input.rows = 3;
        } else if (input.type === 'checkbox') {
            input.className = 'compact-form-checkbox';
            // Create a wrapper for better checkbox styling
            const checkboxWrapper = document.createElement('div');
            checkboxWrapper.className = 'checkbox-wrapper';
            checkboxWrapper.style.display = 'flex';
            checkboxWrapper.style.alignItems = 'center';
            checkboxWrapper.style.gap = '8px';

            // Add the input to wrapper (no need to remove from fieldRow since it was never added)
            checkboxWrapper.appendChild(input);

            // Add a label for the checkbox
            const checkboxLabel = document.createElement('span');
            checkboxLabel.textContent = 'System Required';
            checkboxLabel.style.fontSize = '14px';
            checkboxLabel.style.color = '#6c757d';
            checkboxWrapper.appendChild(checkboxLabel);

            fieldRow.appendChild(checkboxWrapper);

            // Skip the normal input addition since we added the wrapper
            fieldsContainer.appendChild(fieldRow);
            return; // Exit early to avoid duplicate addition
        } else {
            input.className = 'compact-form-input';
        }

        // Disable primary key fields in edit mode
        if (rowData && col.pk) {
            input.disabled = true;
            input.style.backgroundColor = '#f8f9fa';
        }

        fieldRow.appendChild(input);
        fieldsContainer.appendChild(fieldRow);
    });

    form.appendChild(fieldsContainer);

    // Create compact button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'compact-action-buttons';

    const button = document.createElement('button');
    button.type = 'submit';
    button.textContent = rowData ? '💾 Update' : '➕ Add';
    button.className = 'compact-btn ' + (rowData ? 'compact-btn-update' : 'compact-btn-add');

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = '🗑️ Clear';
    cancelButton.className = 'compact-btn compact-btn-clear';
    cancelButton.onclick = () => {
        // Clear form
        form.reset();
        // Reset edit mode if active
        window.currentEditingId = null;
    };

    buttonContainer.appendChild(button);
    buttonContainer.appendChild(cancelButton);
    form.appendChild(buttonContainer);

    return form;
}

// Export form generation utilities
window.generateForm = generateForm;

// ============================================================================
// Records Table Management for Modal
// ============================================================================

/**
 * Get the usage count for a record in lookup tables using Supabase
 * @param {string} tableName - The lookup table name (e.g., 'LOCATIONS')
 * @param {number|string} recordId - The record's ID
 * @returns {Promise<number>} - The number of references to this record
 */
async function getUsageCount(tableName, recordId) {
    // Define which tables are lookup tables and what fields reference them
    const lookupReferences = {
        'locations': ['inventory.location_id'],
        'crews': ['inventory.assigned_crew_id'],
        'dfns': ['inventory.dfn_id'],
        'item_types': ['inventory.item_type_id'],
        'statuses': ['inventory.status_id'],
        'categories': ['item_types.category_id'],
        'inventory_types': ['item_types.inventory_type_id'],
        'units_of_measure': ['item_types.unit_of_measure_id'],
        'inventory_providers': ['item_types.provider_id'],
        'location_types': ['locations.loc_type_id'],
        'transaction_types': ['transactions.transaction_type_id'],
        'inv_action_types': ['transactions.inv_action_type_id']
    };

    const references = lookupReferences[tableName.toLowerCase()];
    if (!references || references.length === 0) {
        return 0; // Not a lookup table or no references
    }

    let totalCount = 0;

    try {
        for (const ref of references) {
            const [refTable, refColumn] = ref.split('.');
            // Use Supabase to count references
            const { count, error } = await supabase
                .from(refTable)
                .select(refColumn, { count: 'exact', head: true })
                .eq(refColumn, recordId);

            if (!error && typeof count === 'number') {
                totalCount += count;
            }
        }
    } catch (error) {
        console.error(`Error getting usage count for ${tableName} ID ${recordId}:`, error);
        return 0;
    }

    return totalCount;
}

/**
 * Create a records table element for a given table using Supabase
 * @param {string} tableName - Table name
 * @param {Array} columns - Array of column names or objects
 * @returns {HTMLTableElement}
 */
function createRecordsTable(tableName, columns) {
    const table = document.createElement('table');
    table.className = 'records-table';

    // Check if this is a lookup table
    const isLookupTable = [
        'locations', 'crews', 'dfns', 'item_types', 'statuses',
        'categories', 'inventory_types', 'units_of_measure',
        'inventory_providers', 'location_types', 'transaction_types',
        'inv_action_types'
    ].includes(tableName.toLowerCase());

    // Create header
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        // If col is an object (with .name), use col.name; else, use col directly
        th.textContent = typeof col === 'object' ? col.name : col;
        headerRow.appendChild(th);
    });

    // Add usage count header for lookup tables
    if (isLookupTable) {
        const usageHeader = document.createElement('th');
        usageHeader.textContent = 'Used By';
        usageHeader.style.width = '80px';
        usageHeader.style.textAlign = 'center';
        usageHeader.title = 'Number of records that reference this entry';
        headerRow.appendChild(usageHeader);
    }

    // Add actions column
    const actionsHeader = document.createElement('th');
    actionsHeader.textContent = 'Actions';
    actionsHeader.style.width = '100px';
    headerRow.appendChild(actionsHeader);

    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');
    tbody.id = 'recordsTableBody';
    table.appendChild(tbody);

    return table;
}

/**
 * Populate the records table body with data from Supabase
 * @param {string} tableName - Table name
 * @param {Array} columns - Array of column names
 */
async function populateRecordsTable(tableName, columns) {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) {
        console.error('Records table body not found');
        return;
    }

    // Clear existing rows
    tbody.innerHTML = '';

    // Check if this is a lookup table
    const isLookupTable = [
        'locations', 'crews', 'dfns', 'item_types', 'statuses',
        'categories', 'inventory_types', 'units_of_measure',
        'inventory_providers', 'location_types', 'transaction_types',
        'inv_action_types'
    ].includes(tableName);

    try {
        // Fetch data from Supabase
        let query = supabase.from(tableName).select('*');
        if (tableName === 'item_types' && window.selectedMarketId) {
            query = query.eq('market_id', window.selectedMarketId);
        } else if (tableName === 'inventory' && window.selectedSlocId) {
            query = query.eq('sloc_id', window.selectedSlocId);
        }
        query = query.order(columns[0], { ascending: true });

        const { data, error } = await query;
        if (error) {
            throw new Error(error.message);
        }

        if (!data || data.length === 0) {
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = columns.length + (isLookupTable ? 2 : 1);
            td.textContent = 'No records found';
            td.style.textAlign = 'center';
            td.style.fontStyle = 'italic';
            td.style.color = '#6c757d';
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }

        for (const row of data) {
            const tr = document.createElement('tr');

            // Check if this is a system-required location
            const isSystemRequired = tableName === 'LOCATIONS' && row.is_system_required === 1;
            if (isSystemRequired) {
                tr.style.backgroundColor = '#f8f9fa';
                tr.style.borderLeft = '3px solid #ffc107';
            }

            // Display columns in the order defined by the columns parameter
            for (const col of columns) {
                const td = document.createElement('td');
                let value = row[col];

                // Special handling for boolean fields like is_system_required
                if (col === 'is_system_required') {
                    td.textContent = value === 1 ? 'Yes' : 'No';
                    td.style.textAlign = 'center';
                    if (value === 1) {
                        td.style.color = '#28a745';
                        td.style.fontWeight = 'bold';
                    } else {
                        td.style.color = '#6c757d';
                    }
                    tr.appendChild(td);
                    continue;
                }

                // For foreign key columns, display label from cache
                const fk = getForeignKeys(tableName).find(fk => fk.from === col);
                if (fk) {
                    const labelCol = getForeignKeyLabelColumn(fk.table);
                    const tableNameLower = fk.table.toLowerCase();
                    const rowObj = getCachedRow(tableNameLower, value);
                    value = rowObj ? rowObj[labelCol] : value;
                }

                // Format value for display
                if (value === null || value === undefined) {
                    value = '';
                } else if (typeof value === 'string' && value.length > 30) {
                    value = value.substring(0, 30) + '...';
                }
                td.textContent = value;

                // Add system required indicator
                if (isSystemRequired && col === 'name') {
                    const lockIcon = document.createElement('span');
                    lockIcon.innerHTML = ' 🔒';
                    lockIcon.title = 'System Required - Cannot be edited or deleted';
                    lockIcon.style.fontSize = '12px';
                    td.appendChild(lockIcon);
                }

                tr.appendChild(td);
            }

            // Add usage count column for lookup tables
            if (isLookupTable) {
                const usageTd = document.createElement('td');
                usageTd.style.textAlign = 'center';

                const recordId = row.id || row[columns[0]];
                const usageCount = await getUsageCount(tableName, recordId);

                if (usageCount > 0) {
                    usageTd.innerHTML = `<span style="background-color: #e3f2fd; color: #1976d2; padding: 2px 6px; border-radius: 3px; font-size: 11px; font-weight: bold;">${usageCount}</span>`;
                } else {
                    usageTd.innerHTML = '<span style="color: #666; font-size: 11px;">0</span>';
                }

                tr.appendChild(usageTd);
            }

            // Add actions column
            const actionsTd = document.createElement('td');

            const editBtn = document.createElement('button');
            editBtn.className = 'edit-action-btn';
            editBtn.innerHTML = '✏️';
            editBtn.title = 'Edit Record';

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-action-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete Record';

            // Check system protection for locations
            if (isSystemRequired) {
                editBtn.disabled = true;
                editBtn.style.opacity = '0.3';
                editBtn.title = 'Cannot edit system-required location';
                editBtn.onclick = () => {
                    alert('This location is required by the system and cannot be edited.');
                };

                deleteBtn.disabled = true;
                deleteBtn.style.opacity = '0.3';
                deleteBtn.title = 'Cannot delete system-required location';
                deleteBtn.onclick = () => {
                    alert('This location is required by the system and cannot be deleted.');
                };
            } else {
                // Normal edit functionality
                editBtn.onclick = () => editRecord(null, tableName, columns, [], row);

                // Check if record can be deleted (no dependencies for lookup tables)
                if (isLookupTable) {
                    const recordId = row.id || row[columns[0]];
                    const usageCount = await getUsageCount(tableName, recordId);

                    if (usageCount > 0) {
                        deleteBtn.disabled = true;
                        deleteBtn.title = `Cannot delete: ${usageCount} record(s) depend on this entry`;
                        deleteBtn.style.opacity = '0.5';
                        deleteBtn.onclick = () => {
                            alert(`Cannot delete this record because ${usageCount} other record(s) depend on it. Please update or delete the dependent records first.`);
                        };
                    } else {
                        deleteBtn.onclick = async () => await deleteModalRecord(null, tableName, row);
                    }
                } else {
                    deleteBtn.onclick = async () => await deleteModalRecord(null, tableName, row);
                }
            }

            actionsTd.appendChild(editBtn);
            actionsTd.appendChild(deleteBtn);
            tr.appendChild(actionsTd);

            tbody.appendChild(tr);
        }
    } catch (error) {
        console.error('💥 Error populating records table:', error);
        const tr = document.createElement('tr');
        const td = document.createElement('td');
        td.colSpan = columns.length + (isLookupTable ? 2 : 1);
        td.textContent = `Error loading records: ${error.message}`;
        td.style.textAlign = 'center';
        td.style.color = '#dc3545';
        tr.appendChild(td);
        tbody.appendChild(tr);
    }
}


/**
 * Populate the form with the record data for editing (Supabase version)
 * @param {string} tableName - Table name
 * @param {Array} columns - Array of column names or objects
 * @param {Object} row - Row data to edit
 */
function editRecord(tableName, columns, row) {
    const form = document.getElementById('editForm') || document.getElementById('addForm');
    if (!form) return;

    // Set current editing ID - for CONFIG table use key field, otherwise use id
    if (tableName === 'CONFIG') {
        window.currentEditingId = row.key;
    } else {
        window.currentEditingId = row.id;
    }

    // Populate form fields
    columns.forEach(col => {
        const colName = typeof col === 'object' ? col.name : col;
        const input = form.querySelector(`[name="${colName}"]`);
        if (input) {
            // Special handling for checkboxes
            if (input.type === 'checkbox') {
                input.checked = (row[colName] === 1 || row[colName] === true);
            } else {
                input.value = row[colName] ?? '';
            }
        }
    });

    // Update form title
    const title = form.querySelector('h3');
    if (title) {
        title.textContent = `Edit ${tableName} Record`;
    }

    // Add warning for system-required locations
    if (tableName === 'LOCATIONS' && row.is_system_required === 1) {
        // Remove any existing warning
        const existingWarning = form.querySelector('.system-required-warning');
        if (existingWarning) {
            existingWarning.remove();
        }

        // Create warning message
        const warningDiv = document.createElement('div');
        warningDiv.className = 'system-required-warning';
        warningDiv.style.cssText = `
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            border-radius: 4px;
            padding: 12px;
            margin: 10px 0;
            color: #856404;
            font-weight: bold;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;

        const warningIcon = document.createElement('span');
        warningIcon.textContent = '⚠️ ';
        warningIcon.style.marginRight = '8px';

        const warningText = document.createElement('span');
        warningText.textContent = 'This location is designated as required for this app to function properly. Do not edit.';

        warningDiv.appendChild(warningIcon);
        warningDiv.appendChild(warningText);

        // Insert warning after the title
        const titleElement = form.querySelector('h3');
        if (titleElement && titleElement.nextSibling) {
            form.insertBefore(warningDiv, titleElement.nextSibling);
        } else if (titleElement) {
            titleElement.parentNode.insertBefore(warningDiv, titleElement.nextSibling);
        } else {
            // If no title found, insert at the beginning of the form
            form.insertBefore(warningDiv, form.firstChild);
        }
    } else {
        // Remove warning if it exists but this is not a system-required location
        const existingWarning = form.querySelector('.system-required-warning');
        if (existingWarning) {
            existingWarning.remove();
        }
    }

    // Update button text
    const submitBtn = form.querySelector('.compact-btn-add, .compact-btn-update');
    if (submitBtn) {
        submitBtn.textContent = '💾 Update';
        submitBtn.className = 'compact-btn compact-btn-update';
    }
}

/**
 * Delete a record from Supabase and refresh the UI
 * @param {string} tableName - Table name
 * @param {Object} row - Row data
 */
async function deleteModalRecord(tableName, row) {
    if (!confirm(`Are you sure you want to delete this ${tableName} record?`)) {
        return;
    }

    try {
        // Special handling for CONFIG table which uses key instead of id
        let matchCol, matchValue;
        if (tableName === 'CONFIG') {
            matchCol = 'key';
            matchValue = row.key;
        } else {
            matchCol = 'id';
            matchValue = row.id;
        }

        // Log transaction for inventory table before deletion
        if (tableName === 'inventory' && window.transactionLogger) {
            try {
                const inventoryId = row.id;
                await window.transactionLogger.logInventoryDeleted(inventoryId, row);
            } catch (logError) {
                console.warn('Failed to log inventory deletion transaction:', logError);
            }
        }

        // Delete from Supabase
        const { error } = await supabase
            .from(tableName)
            .delete()
            .eq(matchCol, matchValue);

        if (error) {
            throw error;
        }

        await handleTableOperationSuccess(tableName);

        // USE COMPREHENSIVE REFRESH
        refreshAllApplicationLists();

        // Refresh the records table
        if (window.currentTableManager) {
            window.currentTableManager.refreshRecords();
        }

        showMessage(`${tableName} record deleted successfully!`, 'success');
    } catch (error) {
        console.error('Error deleting record:', error);
        showMessage(`Error deleting record: ${error.message}`, 'error');
    }
}

// ============================================================================
// TABLE DISPLAY UTILITIES
// ============================================================================

/**
 * Get display value for a cell (handles foreign key lookups) using Supabase
 * @param {Object} column - Column information (or string column name)
 * @param {any} value - Cell value
 * @param {Array} foreignKeys - Foreign key information
 * @returns {Promise<string>} - Display value
 */
async function getCellDisplayValue(column, value, foreignKeys) {
    const colName = typeof column === 'object' ? column.name : column;
    const fk = foreignKeys.find(f => f.from === colName);

    if (fk) {
        const labelCol = getForeignKeyLabelColumn(fk.table);
        const tableName = fk.table.toLowerCase();
        const row = getCachedRow(tableName, value);
        return row ? row[labelCol] : 'N/A';
    }
    return value ?? 'N/A';
}

/**
 * Create action buttons for table rows
 * @param {string} table - Table name
 * @param {Object} row - Row data
 * @param {Array} columns - Table column information
 * @param {Function} onEdit - Edit callback
 * @param {Function} onDelete - Delete callback
 * @returns {HTMLElement} - Actions cell element
 */
function createActionButtons(table, row, columns, onEdit, onDelete) {
    const tdActions = document.createElement('td');
    tdActions.className = 'action-buttons-cell';

    const editBtn = document.createElement('button');
    editBtn.textContent = '✏️ Edit';
    editBtn.className = 'edit-btn';
    editBtn.title = 'Edit this record';
    editBtn.onclick = () => onEdit(table, columns, row);
    tdActions.appendChild(editBtn);

    const delBtn = document.createElement('button');
    delBtn.textContent = '🗑️ Delete';
    delBtn.className = 'delete-btn';
    delBtn.title = 'Delete this record';
    delBtn.onclick = async () => {
        if (confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
            await onDelete(table, row);
        }
    };
    tdActions.appendChild(delBtn);

    return tdActions;
}

/**
 * Delete a record from Supabase
 * @param {string} table - Table name
 * @param {Object} row - Row data
 * @returns {Promise<void>}
 */
async function deleteRecord(table, row) {
    try {
        const matchCol = table === 'CONFIG' ? 'key' : 'id';
        const matchValue = table === 'CONFIG' ? row.key : row.id;

        // Log transaction for inventory table before deletion
        if (table === 'inventory' && window.transactionLogger) {
            try {
                const inventoryId = row.id;
                await window.transactionLogger.logInventoryDeleted(inventoryId, row);
            } catch (logError) {
                console.warn('Failed to log inventory deletion transaction:', logError);
            }
        }

        const { error } = await supabase
            .from(table)
            .delete()
            .eq(matchCol, matchValue);

        if (error) throw error;

        await handleTableOperationSuccess(table);
        refreshAllApplicationLists();

    } catch (error) {
        console.error('Delete failed:', error);
        alert('Failed to delete record: ' + error.message);
    }
}

/**
 * Generate a table display for data using Supabase
 * @param {string} table - Table name
 * @param {Array} columns - Table column information
 * @param {Array} data - Table data
 * @param {Array} foreignKeys - Foreign key information
 * @returns {HTMLTableElement} - Generated table element
 */
async function generateTableDisplay(table, columns, data, foreignKeys) {
    const tableEl = document.createElement('table');

    // Create header
    const thead = document.createElement('thead');
    const tr = document.createElement('tr');

    columns.forEach(col => {
        const th = document.createElement('th');
        th.textContent = typeof col === 'object' ? col.name : col;
        tr.appendChild(th);
    });

    const thActions = document.createElement('th');
    thActions.textContent = 'Actions';
    tr.appendChild(thActions);
    thead.appendChild(tr);
    tableEl.appendChild(thead);

    // Create body
    const tbody = document.createElement('tbody');

    for (const row of data) {
        const trRow = document.createElement('tr');

        for (const col of columns) {
            const td = document.createElement('td');
            // Await foreign key display value if needed
            td.textContent = await getCellDisplayValue(col, row[typeof col === 'object' ? col.name : col], foreignKeys);
            trRow.appendChild(td);
        }

        const actionsCell = createActionButtons(
            table, row, columns,
            window.editRow, deleteRecord
        );
        trRow.appendChild(actionsCell);
        tbody.appendChild(trRow);
    }

    tableEl.appendChild(tbody);
    return tableEl;
}

// Export table generation utilities
window.generateTableDisplay = generateTableDisplay;

// ============================================================================
// RECORD MANAGEMENT UTILITIES
// ============================================================================

/**
 * Insert a new record into Supabase
 * @param {string} table - Table name
 * @param {FormData} formData - Form data
 * @param {Array} columns - Table column information
 * @returns {Promise<Object>} - {success: boolean, error?: string}
 */
async function insertRecord(table, formData, columns) {
    try {
        // Prepare insert object
        const insertObj = {};
        columns.forEach(c => {
            let val = formData.get(c);
            if (val !== null && val !== undefined && val !== '') {
                insertObj[c] = val;
            }
        });

        const { error } = await supabase.from(table).insert([insertObj]);
        if (error) return { success: false, error: error.message };
        await handleTableOperationSuccess(table);
        refreshAllApplicationLists();

        // Log transaction for inventory table
        if (table === 'inventory' && window.transactionLogger) {
            try {
                // You may want to fetch the inserted record's ID if needed
                await window.transactionLogger.logInventoryCreated(null, null);
            } catch (logError) {
                console.warn('Failed to log inventory creation transaction:', logError);
            }
        }

        return { success: true };
    } catch (error) {
        console.error(`Insert failed for table ${table}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Update an existing record in Supabase
 * @param {string} table - Table name
 * @param {FormData} formData - Form data
 * @param {Object} originalRow - Original row data
 * @param {Array} columns - Table column information
 * @returns {Promise<Object>} - {success: boolean, error?: string}
 */
async function updateRecord(table, formData, originalRow, columns) {
    try {
        // Prepare update object
        const updateObj = {};
        columns.forEach(c => {
            let val = formData.get(c);
            if (val !== null && val !== undefined && val !== '') {
                updateObj[c] = val;
            }
        });

        const matchCol = table === 'CONFIG' ? 'key' : 'id';
        const matchValue = table === 'CONFIG' ? originalRow.key : originalRow.id;

        const { error } = await supabase
            .from(table)
            .update(updateObj)
            .eq(matchCol, matchValue);

        if (error) return { success: false, error: error.message };

        await handleTableOperationSuccess(table);
        refreshAllApplicationLists();

        // Log transaction for inventory table
        if (table === 'inventory' && window.transactionLogger) {
            try {
                await window.transactionLogger.logInventoryUpdated(
                    originalRow.id,
                    originalRow,
                    { ...originalRow, ...updateObj },
                    Object.keys(updateObj)
                );
            } catch (logError) {
                console.warn('Failed to log inventory update transaction:', logError);
            }
        }

        return { success: true };
    } catch (error) {
        console.error('Update failed:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get table data as objects from Supabase
 * @param {string} table - Table name
 * @returns {Promise<Array<Object>>} - Array of row objects
 */
async function getTableData(table) {
    let query = supabase.from(table).select('*');

    if (table === 'item_types' && window.selectedMarketId) {
        query = query.eq('market_id', window.selectedMarketId);
    } else if (table === 'inventory' && window.selectedSlocId) {
        query = query.eq('sloc_id', window.selectedSlocId);
    }

    const { data, error } = await query;
    if (error) return [];
    return data;
}

// ============================================================================
// (Other utility functions such as createModal, clearFormFields, etc. can be kept as-is or updated similarly.)
// ============================================================================

/**
 * Create and configure a modal
 * @param {string} modalId - Modal ID
 * @param {HTMLElement} content - Modal content
 * @returns {HTMLElement} - Modal element
 */
function createModal(modalId, content) {
    const modal = document.createElement('div');
    modal.id = modalId;
    modal.className = 'table-management-modal';
    modal.style.display = 'block';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.backgroundColor = 'rgba(0,0,0,0.7)';
    modal.style.zIndex = '1000';

    const modalContent = document.createElement('div');
    modalContent.className = 'table-management-modal-content';

    // Header
    const header = document.createElement('div');
    header.className = 'table-management-header';

    const title = document.createElement('h2');
    title.className = 'table-management-title';
    title.textContent = 'Manage Table Records';

    const closeButton = document.createElement('button');
    closeButton.className = 'table-management-close-btn';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => { modal.style.display = 'none'; };

    header.appendChild(title);
    header.appendChild(closeButton);

    // Main content
    const mainContent = document.createElement('div');
    mainContent.className = 'table-management-content';
    mainContent.appendChild(content);

    // Footer
    const footer = document.createElement('div');
    footer.className = 'table-management-footer';

    const refreshButton = document.createElement('button');
    refreshButton.className = 'table-management-refresh-btn';
    refreshButton.innerHTML = '🔄 Refresh';
    refreshButton.onclick = () => {
        if (window.currentTableManager) {
            window.currentTableManager.refreshRecords();
        }
    };

    const doneButton = document.createElement('button');
    doneButton.className = 'table-management-done-btn';
    doneButton.textContent = 'Done';
    doneButton.onclick = () => { modal.style.display = 'none'; };

    footer.appendChild(refreshButton);
    footer.appendChild(doneButton);

    modalContent.appendChild(header);
    modalContent.appendChild(mainContent);
    modalContent.appendChild(footer);

    modal.appendChild(modalContent);
    return modal;
}

/**
 * Clear form fields after successful operation
 * @param {HTMLFormElement} form - Form element
 */
function clearFormFields(form) {
    const inputs = form.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') {
            input.checked = false;
        } else {
            input.value = '';
        }
    });

    // Focus the first input/select element
    const firstInput = form.querySelector('input, select');
    if (firstInput) {
        firstInput.focus();
    }
}

/**
 * Refresh table display after data changes
 * @param {Object} db - Database instance
 * @param {string} table - Table name
 * @param {Array} columns - Table column information
 * @param {Array} foreignKeys - Foreign key information
 * @param {HTMLElement} manager - Manager container element
 * @param {HTMLElement} modal - Modal element
 */
function refreshTableDisplay(db, table, columns, foreignKeys, manager, modal) {
    const newData = getTableData(db, table);
    const tableElement = manager.querySelector('table');
    if (tableElement) tableElement.remove();
    manager.insertBefore(generateTableDisplay(db, table, columns, newData, foreignKeys), modal);
}

// Function to load and manage a specific table's data
window.loadTableManager = async function(db, table) {
    console.log(`🔄 Loading table manager for: ${table}`);
    
    if (!table) {
        console.warn('No table specified for loadTableManager');
        return;
    }

    // Use the new enhanced table manager modal instead of the old container-based system
    try {
        openTableManager(table);
    } catch (error) {
        console.error('Error in loadTableManager:', error);
        
        // Fallback to old system if new system fails
        const manager = document.getElementById('tableManager');
        if (manager) {
            manager.innerHTML = `<p style="color: red;">Error loading table manager: ${error.message}</p>`;
        }
    }
};

// Function to handle editing a specific row
window.editRow = function(db, table, row) {
    if (!db) db = window.db;
    const manager = document.getElementById('tableManager');

    const columns = getTableInfo(table);
    const foreignKeys = getForeignKeys(table);
    const editForm = generateForm(db, table, columns, foreignKeys, row);
    const modal = createModal('editModal', editForm);
    
    manager.appendChild(modal);

    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(editForm);
        
        const result = await updateRecord(db, table, formData, row, columns);
        
        if (result.success) {
            refreshTableDisplay(db, table, columns, foreignKeys, manager, modal);
            modal.style.display = 'none';
            // Refresh all tables on the page
            if (window.refreshAllTables) {
                window.refreshAllTables();
            }
        } else {
            alert('Failed to update record: ' + result.error);
        }
    });
};

// ============================================================================
// BULK INVENTORY UTILITIES
// ============================================================================

/**
 * Combine bulk inventory records with matching criteria using Supabase
 * @returns {Promise<Object>} - {success: boolean, combinedCount: number, error?: string}
 */
async function combineBulkInventoryRecords() {
    try {
        // Get all inventory records
        const { data: inventoryRows, error: invError } = await supabase
            .from('inventory')
            .select('*');
        if (invError || !inventoryRows) return { success: false, combinedCount: 0, error: invError?.message };

        let combinedCount = 0;
        const processed = new Set();

        for (let i = 0; i < inventoryRows.length; i++) {
            const row = inventoryRows[i];
            const id = row.id;
            if (processed.has(id)) continue;

            // Get item_type_id and check if it's Bulk
            const { data: itemType, error: itemTypeError } = await supabase
                .from('item_types')
                .select('inventory_type_id')
                .eq('id', row.item_type_id)
                .single();
            if (itemTypeError || !itemType) continue;

            const { data: invType, error: invTypeError } = await supabase
                .from('inventory_types')
                .select('name')
                .eq('id', itemType.inventory_type_id)
                .single();
            if (invTypeError || !invType || invType.name !== 'Bulk') continue;

            // Find other matching bulk records (excluding itself)
            for (let j = i + 1; j < inventoryRows.length; j++) {
                const other = inventoryRows[j];
                const otherId = other.id;
                if (processed.has(otherId)) continue;

                // Check if other record matches on the 5 fields (including proper null handling)
                const fields = ['location_id', 'assigned_crew_id', 'dfn_id', 'item_type_id', 'status_id'];
                const isMatch = fields.every(field => {
                    const val1 = row[field];
                    const val2 = other[field];
                    if ((val1 == null) && (val2 == null)) return true;
                    if ((val1 == null) !== (val2 == null)) return false;
                    return val1 === val2;
                });

                // Check if other is also Bulk
                const { data: otherItemType, error: otherItemTypeError } = await supabase
                    .from('item_types')
                    .select('inventory_type_id')
                    .eq('id', other.item_type_id)
                    .single();
                if (otherItemTypeError || !otherItemType) continue;

                const { data: otherInvType, error: otherInvTypeError } = await supabase
                    .from('inventory_types')
                    .select('name')
                    .eq('id', otherItemType.inventory_type_id)
                    .single();
                if (otherInvTypeError || !otherInvType || otherInvType.name !== 'Bulk') continue;

                if (isMatch) {
                    // Combine quantities
                    const newQty = (row.quantity || 0) + (other.quantity || 0);

                    // Update the first record's quantity
                    await supabase
                        .from('inventory')
                        .update({ quantity: newQty })
                        .eq('id', id);

                    // Delete the duplicate record
                    await supabase
                        .from('inventory')
                        .delete()
                        .eq('id', otherId);

                    processed.add(otherId);
                    combinedCount++;

                    // Update our row's quantity for further matches
                    row.quantity = newQty;
                }
            }
            processed.add(id);
        }

        return { success: true, combinedCount };
    } catch (error) {
        console.error('Error combining bulk inventory:', error);
        return { success: false, error: error.message, combinedCount: 0 };
    }
}

// Export bulk inventory utility
window.combineBulkInventory = combineBulkInventoryRecords;

// ============================================================================
// Enhanced Table Manager Class
// ============================================================================

class TableManager {
    constructor(tableName, columns, foreignKeys) {
        this.tableName = tableName;
        this.columns = columns;
        this.foreignKeys = foreignKeys;
        this.modal = null;
        this.form = null;
        this.recordsTable = null;
    }

    createModal() {
        // Create the form
        this.form = generateForm(this.tableName, this.columns, this.foreignKeys);
        this.form.onsubmit = (e) => this.handleFormSubmit(e);

        // --- Search bar and count note ---
        const searchBarContainer = document.createElement('div');
        searchBarContainer.style.display = 'flex';
        searchBarContainer.style.alignItems = 'center';
        searchBarContainer.style.gap = '1em';
        searchBarContainer.style.marginBottom = '0.5em';

        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.placeholder = 'Search records...';
        searchInput.style.flex = '1 1 0px';
        searchInput.style.padding = '0.4em 0.7em';
        searchInput.style.border = '1px solid #ccc';
        searchInput.style.borderRadius = '4px';
        searchInput.style.fontSize = '1em';

        const countNote = document.createElement('span');
        countNote.id = 'recordsCountNote';
        countNote.style.fontSize = '0.95em';
        countNote.style.color = '#555';

        searchBarContainer.appendChild(searchInput);
        searchBarContainer.appendChild(countNote);

        // --- Records Section ---
        const recordsSection = document.createElement('div');
        recordsSection.className = 'table-management-records-section';

        recordsSection.appendChild(searchBarContainer);

        const recordsTitle = document.createElement('h3');
        recordsTitle.className = 'records-section-title';
        recordsTitle.textContent = 'Existing Records';

        const recordsContainer = document.createElement('div');
        recordsContainer.className = 'records-table-container';
        recordsContainer.id = 'modalRecordsContainer';

        recordsSection.appendChild(recordsTitle);
        recordsSection.appendChild(recordsContainer);

        // --- Two-panel layout ---
        const innerContent = document.createElement('div');
        innerContent.className = 'table-management-main-content';

        const formSection = document.createElement('div');
        formSection.className = 'table-management-form-section';
        formSection.appendChild(this.form);

        innerContent.appendChild(formSection);
        innerContent.appendChild(recordsSection);

        // --- Modal ---
        this.modal = createModal('manageModal', innerContent);
        document.body.appendChild(this.modal);

        // Wait for DOM, then set up records table and search
        setTimeout(() => {
            const recordsContainer = document.getElementById('modalRecordsContainer');
            if (recordsContainer) {
                recordsContainer.innerHTML = '';
                this.recordsTable = createRecordsTable(this.tableName, this.columns);
                recordsContainer.appendChild(this.recordsTable);
                this.refreshRecords();

                // Setup search
                const tbody = document.getElementById('recordsTableBody');
                if (tbody) {
                    const rows = tbody.querySelectorAll('tr');
                    countNote.textContent = `Showing ${rows.length} of ${rows.length} records`;
                    searchInput.addEventListener('input', () => {
                        filterRecordsTable(searchInput.value, this.tableName, this.columns);
                    });
                }
            }
        }, 10);

        window.currentTableManager = this;
        return this.modal;
    }

    async refreshRecords() {
        const recordsTableBody = this.modal ? this.modal.querySelector('#recordsTableBody') : document.getElementById('recordsTableBody');
        if (!recordsTableBody) return;
        recordsTableBody.innerHTML = '';
        await populateRecordsTable(this.tableName, this.columns);

        // Update count note if present
        const countNote = this.modal ? this.modal.querySelector('#recordsCountNote') : document.getElementById('recordsCountNote');
        if (countNote && recordsTableBody) {
            const rows = recordsTableBody.querySelectorAll('tr');
            countNote.textContent = `Showing ${rows.length} of ${rows.length} records`;
        }
    }

    async handleFormSubmit(e) {
        e.preventDefault();
        const formData = new FormData(this.form);
        const isEdit = window.currentEditingId !== null && window.currentEditingId !== undefined;
        try {
            if (isEdit) {
                await updateRecord(this.tableName, formData, this.getEditingRow(), this.columns);
            } else {
                await insertRecord(this.tableName, formData, this.columns);
            }
            this.form.reset();
            window.currentEditingId = null;
            await this.refreshRecords();

            // Update button back to Add mode
            const submitBtn = this.form.querySelector('.compact-btn-update, .compact-btn-add');
            if (submitBtn) {
                submitBtn.textContent = '➕ Add';
                submitBtn.className = 'compact-btn compact-btn-add';
            }
            const title = this.form.querySelector('h3');
            if (title) {
                title.textContent = `Add New ${this.tableName} Record`;
            }
        } catch (error) {
            console.error('Error submitting form:', error);
            showMessage(`Error: ${error.message}`, 'error');
        }
    }

    // Helper to get the row being edited (from the table, based on currentEditingId)
    getEditingRow() {
        // This assumes you have the current data loaded in the table
        // You may want to cache the last loaded data for efficiency
        // For now, fetch from Supabase
        if (window.currentEditingId === null || window.currentEditingId === undefined) return null;
        // For CONFIG table, use key, else use id
        const matchCol = this.tableName === 'CONFIG' ? 'key' : 'id';
        return { [matchCol]: window.currentEditingId };
    }
}

// Export TableManager
window.TableManager = TableManager;



// ============================================================================
// FOREIGN KEY DISPLAY UTILITIES
// ============================================================================

/**
 * Get the display value for a foreign key field using Supabase
 * @param {string} tableName - The current table name
 * @param {string} columnName - The column name that might be a foreign key
 * @param {any} value - The current value (might be an ID)
 * @returns {Promise<string>} - The display value (name if found, otherwise original value)
 */
async function getForeignKeyDisplay(tableName, columnName, value) {
    if (!value || value === '') {
        return value;
    }
    try {
        const foreignKeys = getForeignKeys(tableName);
        const fk = foreignKeys.find(f => f.from === columnName);
        if (!fk) return value;

        const labelCol = getForeignKeyLabelColumn(fk.table);
        const tableName = fk.table.toLowerCase();
        const row = getCachedRow(tableName, value);
        if (row && row[labelCol]) {
            return row[labelCol];
        }
        return value;
    } catch (error) {
        console.warn('Error getting foreign key display value:', error);
        return value;
    }
}

// ============================================================================
// Main Table Management Function
// ============================================================================


function showMessage(message, type = 'info') {
    // Simple alert-based message system
    if (type === 'error') {
        alert('Error: ' + message);
    } else if (type === 'success') {
        alert('Success: ' + message);
    } else {
        alert(message);
    }
    console.log(`[${type.toUpperCase()}] ${message}`);
}

// Update openTableManager to use new TableManager signature
function openTableManager(tableName) {
    try {
        // Clean up any existing table manager
        if (window.currentTableManager) {
            window.currentTableManager = null;
        }

        // Remove any existing modal with the same ID
        const existingModal = document.getElementById('manageModal');
        if (existingModal) {
            existingModal.remove();
        }

        // Get table column information
        const columns = getTableInfo(tableName);
        if (!columns || columns.length === 0) {
            throw new Error(`Table ${tableName} not found or has no columns`);
        }

        // Get foreign key information
        const foreignKeys = getForeignKeys(tableName);

        // Create and show the table manager
        const manager = new TableManager(tableName, columns, foreignKeys);
        const modal = manager.createModal();

        // Show the modal
        modal.style.display = 'block';

        // Reset the Manage Others dropdown
        resetManageOthersDropdown();

    } catch (error) {
        console.error('❌ Error opening table manager:', error);
        showMessage(`Error opening table manager: ${error.message}`, 'error');
    }
}

window.openTableManager = openTableManager;
window.manageRecords = openTableManager;


// reset the Manage Others dropdown
function resetManageOthersDropdown() {
    const dropdown = document.getElementById('manageOthersSelect');
    if (dropdown) {
        dropdown.selectedIndex = 0;
    }
}

// call after any table operation to refresh caches and dropdowns if needed
async function handleTableOperationSuccess(changedTableName) {
    // Only recache if the table is in the lookup cache list
    if (LOOKUP_TABLES.includes(changedTableName.toLowerCase())) {
        await cacheLookupTables();
        if (typeof window.refreshDropdowns === 'function') window.refreshDropdowns();
        if (typeof populateBulkSerializedDropdowns === 'function') populateBulkSerializedDropdowns();
    }
}

// ============================================================================
// COMPREHENSIVE REFRESH UTILITIES
// ============================================================================

/**
 * Comprehensive refresh of all application lists and dropdowns
 * This function should be called after any table management operation
 */
function refreshAllApplicationLists() {
    console.log('🔄 Starting comprehensive refresh of all application lists...');
    
    try {
        // Refresh main application dropdowns (existing function)
        if (typeof window.refreshDropdowns === 'function') {
            console.log('📋 Refreshing main dropdowns...');
            window.refreshDropdowns();
            populateBulkSerializedDropdowns();
        }
        
        // Refresh inventory form dropdowns specifically
        if (typeof window.refreshInventoryDropdowns === 'function') {
            console.log('📦 Refreshing inventory dropdowns...');
            window.refreshInventoryDropdowns();
        }
        
        // Refresh all data tables on the page
        if (typeof window.refreshAllTables === 'function') {
            console.log('📊 Refreshing all tables...');
            window.refreshAllTables();
        }
        
        // Refresh inventory table if it exists
        if (typeof window.refreshInventoryTable === 'function') {
            console.log('📋 Refreshing inventory table...');
            window.refreshInventoryTable();
        }
        
        // Refresh any cached lookup data
        if (typeof window.refreshLookupCache === 'function') {
            console.log('🔍 Refreshing lookup cache...');
            window.refreshLookupCache();
        }
        
        // Force refresh of any select elements on the page
        refreshAllSelectElements();
        
        // Dispatch custom event for other components to listen to
        window.dispatchEvent(new CustomEvent('tableDataUpdated', {
            detail: { timestamp: new Date().toISOString() }
        }));
        
        console.log('✅ Comprehensive refresh completed successfully');
        
    } catch (error) {
        console.error('❌ Error during comprehensive refresh:', error);
    }
}

/**
 * Refresh all select elements on the page by re-querying their data using Supabase
 */
async function refreshAllSelectElements() {
    console.log('🔄 Refreshing all select elements...');

    // Find all select elements with data attributes indicating they're lookup dropdowns
    const selects = document.querySelectorAll('select[data-table], select[data-lookup]');

    for (const select of selects) {
        try {
            const tableName = select.dataset.table || select.dataset.lookup;
            const valueField = select.dataset.valueField || 'id';
            const labelField = select.dataset.labelField || 'name';

            if (tableName) {
                console.log(`🔄 Refreshing select for table: ${tableName}`);

                // Store current value
                const currentValue = select.value;

                // Clear existing options (except first one if it's a placeholder)
                const firstOption = select.firstElementChild;
                const isPlaceholder = firstOption && (firstOption.value === '' || firstOption.textContent.includes('--'));

                select.innerHTML = '';

                // Re-add placeholder if it existed
                if (isPlaceholder) {
                    select.appendChild(firstOption.cloneNode(true));
                }

                // Re-populate options using Supabase
                const cachedRows = getCachedTable(tableName.toLowerCase());
                if (cachedRows && cachedRows.length > 0) {
                    cachedRows.forEach(row => {
                        const option = document.createElement('option');
                        option.value = row[valueField];
                        option.textContent = row[labelField] || row[valueField];
                        select.appendChild(option);
                    });
                }

                // Restore previous value if it still exists
                if (currentValue) {
                    select.value = currentValue;
                }
            }
        } catch (error) {
            console.error(`Error refreshing select element:`, error);
        }
    }
}

// ============================================================================
// SEARCH AND FILTER UTILITIES within Manage Records Modal
// ============================================================================
function filterRecordsTable(searchValue, table, columns) {
    const tbody = document.getElementById('recordsTableBody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr'));
    let shown = 0;
    const search = searchValue.trim().toLowerCase();

    rows.forEach(row => {
        // Concatenate all cell text for this row
        const rowText = Array.from(row.children)
            .map(td => td.textContent.toLowerCase())
            .join(' ');
        const match = rowText.includes(search);
        row.style.display = match ? '' : 'none';
        if (match) shown++;
    });

    // Update the count display
    const countNote = document.getElementById('recordsCountNote');
    if (countNote) {
        countNote.textContent = `Showing ${shown} of ${rows.length} records`;
    }
}

// ============================================================================
// EXPOSED UTILITIES FOR EXTERNAL USE
// ============================================================================

// Expose all utility functions globally for reuse
window.insertRecord = insertRecord;
window.updateRecord = updateRecord;
window.deleteRecord = deleteRecord;
window.getTableData = getTableData;
window.createModal = createModal;
window.clearFormFields = clearFormFields;
window.refreshTableDisplay = refreshTableDisplay;
window.combineBulkInventoryRecords = combineBulkInventoryRecords;
// Export the comprehensive refresh function
window.refreshAllApplicationLists = refreshAllApplicationLists;
window.refreshAllSelectElements = refreshAllSelectElements;

// Also create a shorter alias
window.refreshAll = refreshAllApplicationLists;

// Test function for debugging
window.testTableManager = function(tableName = 'ITEM_TYPES') {
    console.log('=== TESTING TABLE MANAGER ===');
    console.log(`Testing with table: ${tableName}`);

    // Test table info
    const columns = getTableInfo(tableName);
    console.log(`Columns for ${tableName}:`, columns);

    const foreignKeys = getForeignKeys(tableName);
    console.log(`Foreign keys for ${tableName}:`, foreignKeys);

    // Test opening table manager
    try {
        openTableManager(tableName);
        console.log('Table manager opened successfully');
    } catch (error) {
        console.error('Error opening table manager:', error);
    }
};



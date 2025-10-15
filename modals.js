// ============================================================================
// MODAL UTILITIES - Action Modals and Related Functionality
// ============================================================================

// ============================================================================
// COMMON MODAL UTILITIES
// ============================================================================

/**
 * Common modal utility functions for creating and managing modals
 */
const ModalUtils = {
    /**
     * Create a basic modal structure
     * @param {string} modalId - Unique ID for the modal
     * @param {string} modalClass - CSS class for the modal
     * @param {string} title - Modal title
     * @param {string} content - Modal body content (HTML)
     * @param {Array} buttons - Array of button objects {text, class, onclick}
     * @returns {HTMLElement} - The created modal element
     */
    createModal(modalId, options) {
        // Remove existing modal if present
        const existingModal = document.getElementById(modalId);
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.id = modalId;
        modal.className = `modal-base ${options.className || ''}`;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';

        // Create header
        const header = document.createElement('div');
        header.className = 'modal-header';
        const titleElement = document.createElement('h3');
        titleElement.textContent = options.title || 'Modal';
        const closeButton = document.createElement('span');
        closeButton.className = 'close-button';
        closeButton.innerHTML = '&times;';
        closeButton.addEventListener('click', () => this.closeModal(modalId));
        header.appendChild(titleElement);
        header.appendChild(closeButton);

        // Create body
        const body = document.createElement('div');
        body.className = 'modal-body';
        body.innerHTML = options.body || '';

        // Create footer with buttons
        const footer = document.createElement('div');
        footer.className = 'modal-footer';
        
        if (options.buttons && options.buttons.length > 0) {
            options.buttons.forEach(buttonConfig => {
                const btn = document.createElement('button');
                btn.id = buttonConfig.id || '';
                btn.textContent = buttonConfig.text || 'Button';
                btn.className = buttonConfig.className || 'btn-secondary';
                if (buttonConfig.disabled) {
                    btn.disabled = true;
                }
                footer.appendChild(btn);
            });
        }

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        modalContent.appendChild(footer);
        modal.appendChild(modalContent);

        // Add to DOM and show
        document.body.appendChild(modal);
        modal.style.display = 'block';

        // Add common event listeners
        this.addModalEventListeners(modal, modalId);

        return modal;
    },

    /**
     * Add common event listeners to modal
     * @param {HTMLElement} modal - Modal element
     * @param {string} modalId - Modal ID
     */
    addModalEventListeners(modal, modalId) {
        // Close on outside click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal(modalId);
            }
        });

        // Close on escape key
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    },

    /**
     * Close any modal by ID
     * @param {string} modalId - Modal ID to close
     */
    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.remove();
            console.log(`${modalId} closed`);
        }
    },

    /**
     * Show modal with common display logic
     * @param {HTMLElement} modal - Modal element to show
     */
    showModal(modal) {
        document.body.appendChild(modal);
        modal.style.display = 'block';
    },

    /**
     * Get inventory item data (common query) - SUPABASE VERSION
     * @param {string} inventoryId - Inventory ID
     * @returns {Object|null} - Inventory data or null
     */
    async getInventoryData(inventoryId) {
        try {
            // Use Supabase to fetch inventory data and joins
            const { data, error } = await supabase
                .from('inventory')
                .select(`
                    *,
                    item_types:item_types (
                        name,
                        inventory_type_id,
                        inventory_types:inventory_types (
                            name
                        )
                    ),
                    statuses:statuses (
                        name
                    ),
                    locations:locations (
                        name
                    ),
                    crews:crews (
                        name
                    )
                `)
                .eq('id', inventoryId)
                .single();
    
            if (error || !data) {
                console.error('Error fetching inventory data:', error);
                return null;
            }
    
            // Flatten joined data for easier access
            return {
                ...data,
                item_name: data.item_types?.name,
                inventory_type_id: data.item_types?.inventory_type_id,
                inventory_type: data.item_types?.inventory_types?.name,
                status_name: data.statuses?.name,
                location_name: data.locations?.name,
                crew_name: data.crews?.name
            };
        } catch (error) {
            console.error('Error fetching inventory data:', error);
            return null;
        }
    },

    /**
     * Common error handler for modal operations
     * @param {Error} error - Error object
     * @param {string} operation - Operation description
     */
    handleError(error, operation = 'operation') {
        console.error(`Error during ${operation}:`, error);
        alert(`Failed to ${operation}: ${error.message}`);
    },
    
    /**
     * Common success handler for modal operations
     * @param {string} modalId - Modal ID to close
     * @param {string} message - Success message
     */
    async handleSuccess(modalId, message = 'Operation completed successfully') {
        try {
            // Combine bulk inventory after operation if needed
            if (window.combineBulkInventory && typeof window.combineBulkInventory === 'function') {
                console.log('Combining bulk inventory...');
                await window.combineBulkInventory();
            }

            // Close modal
            this.closeModal(modalId);

            // Refresh inventory display
            if (typeof loadInventoryList === 'function') {
                loadInventoryList();
            }

            // Refresh allocation visualizations
            if (typeof loadAllocationsSection === 'function') {
                await loadAllocationsSection();
            }
            if (typeof loadAllocationVisualizations === 'function') {
                await loadAllocationVisualizations();
            }

            // Optionally refresh all tables
            if (typeof window.refreshAllTables === 'function') {
                window.refreshAllTables();
            }

            console.log(message);
        } catch (error) {
            console.error('Error in success handler:', error);
            // Still close modal even if refresh fails
            this.closeModal(modalId);
            throw error;
        }
    },

    /**
     * Generate common item information section HTML
     * @param {Object} inventoryData - Inventory item data
     * @param {boolean} isSerializedItem - Whether item is serialized
     * @param {string} quantityLabel - Label for quantity field
     * @returns {string} - HTML string
     */
    generateItemInfoSection(inventoryData, isSerializedItem = false, quantityLabel = 'Current Quantity') {
        return `
            <div class="info-section">
                <h4>Current Item Information</h4>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Item:</label>
                        <span>${inventoryData.item_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <label>Current Location:</label>
                        <span>${inventoryData.location_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <label>Status:</label>
                        <span>${inventoryData.status_name || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <label>${quantityLabel}:</label>
                        <span id="currentQuantityDisplay">${inventoryData.quantity || 0}</span>
                    </div>
                    ${isSerializedItem ? `
                        <div class="info-item">
                            <label>Serial Numbers:</label>
                            <span>Mfgr: ${inventoryData.mfgrSN || 'N/A'} | Tilson: ${inventoryData.tilsonSN || 'N/A'}</span>
                        </div>
                    ` : ''}
                    ${inventoryData.crew_name ? `
                        <div class="info-item">
                            <label>Assigned Crew:</label>
                            <span>${inventoryData.crew_name}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    /**
     * Generate dropdown options HTML
     * @param {Array} options - Array of {id, name} objects
     * @param {string} placeholder - Placeholder text
     * @returns {string} - HTML string
     */
    generateDropdownOptions(options, placeholder = null) {
        if (!placeholder) {
            return options.map(option => `<option value="${option.id}">${option.name}</option>`).join('');
        } else {
            return `<option value="">${placeholder}</option>` +
                options.map(option => `<option value="${option.id}">${option.name}</option>`).join('');
        }
    },

    /**
     * Generate quantity input section HTML
     * @param {Object} params - Parameters object
     * @param {boolean} params.isSerializedItem - Whether item is serialized
     * @param {number} params.maxQuantity - Maximum quantity allowed
     * @param {string} params.quantityLabel - Label for quantity input
     * @param {string} params.quantityId - ID for quantity input
     * @returns {string} - HTML string
     */
    generateQuantitySection({isSerializedItem = false, maxQuantity = 1, quantityLabel = 'Quantity', quantityId = 'quantityInput'}) {
        return `
            <div id="quantitySection" style="${isSerializedItem ? 'display: none;' : 'display: block;'}">
                <div class="input-group">
                    <label for="${quantityId}">${quantityLabel}:</label>
                    <input type="number" 
                           id="${quantityId}" 
                           min="1" 
                           max="${maxQuantity}" 
                           value="${maxQuantity}"
                           placeholder="Enter ${quantityLabel.toLowerCase()}">
                    <span class="quantity-note">Max: <span id="maxQuantity">${maxQuantity}</span></span>
                </div>
            </div>
            ${isSerializedItem ? `
                <div id="serialNotice" class="serial-notice">
                    Serialized item: All units will be processed
                </div>
            ` : ''}
        `;
    },

    /**
     * Common modal event setup with modern options API
     * @param {HTMLElement} modal - Modal element
     * @param {Object} options - Event setup options
     * @param {Array} options.closeHandlers - Array of element IDs that should close the modal
     * @param {Object} options.executeHandler - Execute button handler {id, handler}
     */
    setupModalEvents(modal, options) {
        // Handle legacy API for backward compatibility
        if (typeof options === 'string') {
            // Legacy API: setupModalEvents(modal, modalId, closeButtonClass, closeFunction)
            const modalId = options;
            const closeButtonClass = arguments[2];
            const closeFunction = arguments[3];
            
            // Close button
            const closeButton = modal.querySelector(`.${closeButtonClass}`);
            if (closeButton) {
                closeButton.onclick = closeFunction;
            }

            // Close modal when clicking outside
            modal.onclick = function(event) {
                if (event.target === modal) {
                    closeFunction();
                }
            };

            // Add common escape key handler
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    closeFunction();
                    document.removeEventListener('keydown', escapeHandler);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            return;
        }

        // Modern API with options object
        const modalId = modal.id;
        
        // Setup close handlers
        if (options.closeHandlers && Array.isArray(options.closeHandlers)) {
            options.closeHandlers.forEach(handlerId => {
                const element = document.getElementById(handlerId);
                if (element) {
                    element.addEventListener('click', () => this.closeModal(modalId));
                }
            });
        }
        
        // Setup execute handler
        if (options.executeHandler && options.executeHandler.id && options.executeHandler.handler) {
            const executeButton = document.getElementById(options.executeHandler.id);
            if (executeButton) {
                executeButton.addEventListener('click', options.executeHandler.handler);
            }
        }

        // --- Add this block for custom handlers ---
        if (options.customHandlers && Array.isArray(options.customHandlers)) {
            options.customHandlers.forEach(({id, handler}) => {
                const btn = document.getElementById(id);
                if (btn && typeof handler === 'function') {
                    btn.addEventListener('click', handler);
                }
            });
        }

        // Close modal when clicking outside
        modal.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal(modalId);
            }
        });

        // Add common escape key handler
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modalId);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    },

    /**
     * Execute async function with common error handling
     * @param {Function} asyncFunction - Async function to execute
     * @param {string} operationName - Name of the operation for error messages
     * @returns {Promise<any>} - Result of the function or null on error
     */
    async withErrorHandling(asyncFunction, operationName = 'operation') {
        try {
            return await asyncFunction();
        } catch (error) {
            this.handleError(error, operationName);
            return null;
        }
    },

    /**
     * Setup real-time validation for required notes fields
     * @param {string} textareaId - ID of the textarea element
     * @param {string} buttonId - ID of the submit button to enable/disable
     * @param {string} errorElementId - ID of error display element (optional)
     * @param {number} minLength - Minimum required length (default: 5)
     */
    setupNotesValidation(textareaId, buttonId, errorElementId = null, minLength = 5) {
        const textarea = document.getElementById(textareaId);
        const button = document.getElementById(buttonId);
        const errorElement = errorElementId ? document.getElementById(errorElementId) : null;
        
        if (!textarea || !button) {
            console.warn('Notes validation setup failed: missing elements', { textareaId, buttonId });
            return;
        }
        
        const validateNotes = () => {
            const value = textarea.value.trim();
            const isValid = value.length >= minLength;
            
            // Update button state
            button.disabled = !isValid;
            
            // Update error message
            if (errorElement) {
                if (value.length === 0) {
                    errorElement.textContent = 'Notes are required';
                    errorElement.style.display = 'block';
                } else if (value.length < minLength) {
                    errorElement.textContent = `Please provide at least ${minLength} characters`;
                    errorElement.style.display = 'block';
                } else {
                    errorElement.textContent = '';
                    errorElement.style.display = 'none';
                }
            }
            
            return isValid;
        };
        
        // Add event listeners
        textarea.addEventListener('input', validateNotes);
        textarea.addEventListener('blur', validateNotes);
        
        // Initial validation
        validateNotes();
        
        // Focus the textarea
        textarea.focus();
        
        return validateNotes;
    },

    /**
     * Setup auto-select functionality for quantity input fields
     * @param {string|Array} inputIds - Single input ID or array of input IDs
     */
    setupQuantityAutoSelect(inputIds) {
        const ids = Array.isArray(inputIds) ? inputIds : [inputIds];
        
        ids.forEach(inputId => {
            const input = document.getElementById(inputId);
            if (input && input.type === 'number') {
                input.addEventListener('focus', function() {
                    this.select();
                });
                
                input.addEventListener('click', function() {
                    this.select();
                });
            }
        });
    },

    /**
     * Create and execute a database statement with cleanup
     * @param {string} sql - SQL query
     * @param {Array} params - Parameters for the query
     * @param {Function} processor - Function to process results (optional)
     * @returns {any} - Query results
     */
    async executeQuery(sql, params = [], processor = null) {
        let stmt = null;
        try {
            stmt = db.prepare(sql);
            stmt.bind(params);
            
            if (processor) {
                return processor(stmt);
            } else {
                const results = [];
                while (stmt.step()) {
                    results.push(stmt.getAsObject());
                }
                return results;
            }
        } finally {
            if (stmt) {
                stmt.free();
            }
        }
    },

    /**
     * Get crew name by ID using Supabase
     * @param {string|number} crewId - Crew ID
     * @returns {Promise<string>} - Crew name or 'Unknown Crew'
     */
    async getCrewName(crewId) {
        if (!crewId) return 'Unknown Crew';
        return getCachedRow('crews', crewId)?.name || 'Unknown Crew';
    },

    /**
     * Get status ID by name using Supabase
     * @param {string} statusName - Status name
     * @returns {Promise<number|null>} - Status ID or null
     */
    async getStatusId(statusName) {
        const row = getCachedRowByField('statuses', 'name', statusName);
        return row ? row.id : null;
    },

    /**
     * Get location ID by name using Supabase
     * @param {string} locationName - Location name
     * @returns {Promise<number|null>} - Location ID or null
     */
    async getLocationId(locationName) {
        const row = getCachedRowByField('locations', 'name', locationName);
        return row ? row.id : null;
    },

    /**
     * Get all available crews for the current market using Supabase
     * @returns {Promise<Array>} - Array of crew objects
     */
    async getAllCrews() {
        const { data, error } = await supabase
            .from('crews')
            .select('id, name')
            .eq('market_id', window.selectedMarketId)
            .order('name');
        return data || [];
    }
};

// ============================================================================
// COMMON CLOSE FUNCTIONS (Unified)
// ============================================================================

// Unified close functions using ModalUtils
const closeActionModal = () => ModalUtils.closeModal('actionModal');
const closeInspectModal = () => ModalUtils.closeModal('inspectModal');
const closeReserveModal = () => ModalUtils.closeModal('reserveModal');
const closeUnreserveModal = () => ModalUtils.closeModal('unreserveModal');
const closeIssueModal = () => ModalUtils.closeModal('issueModal');
const closeRejectModal = () => ModalUtils.closeModal('rejectModal');
const closeInstallModal = () => ModalUtils.closeModal('installModal');
const closeRemoveModal = () => ModalUtils.closeModal('removeModal');
const closeReturnAsReservedModal = () => ModalUtils.closeModal('returnAsReservedModal');
const closeReturnAsAvailableModal = () => ModalUtils.closeModal('returnAsAvailableModal');
const closeAdjustModal = () => ModalUtils.closeModal('adjustModal');
const closeAssignDfnModal = () => ModalUtils.closeModal('assignDfnModal');

// Debug function to examine ACTION_STATUSES relationships
window.debugActionStatuses = async function() {
    console.log('=== ACTION_STATUSES DEBUG ===');
    try {
        // Get all statuses
        const statuses = getCachedTable('statuses');
        console.log('Available Statuses:');
        statuses.forEach(row => {
            console.log(`  ${row.id}: ${row.name}`);
        });

        // Get all action types
        const actions = getCachedTable('inv_action_types');
        console.log('\nAvailable Action Types:');
        actions.forEach(row => {
            console.log(`  ${row.id}: ${row.name} (loc_type: ${row.loc_type_id})`);
        });

        // Get all action-status relationships
        const relationships = getCachedTable('action_statuses');
        console.log('\nAction-Status Relationships:');
        relationships.forEach(row => {
            const actionType = getCachedRow('inv_action_types', row.inv_action_id);
            const status = getCachedRow('statuses', row.status_id);
            console.log(`  Action "${actionType?.name}" (ID: ${row.inv_action_id}) is available for status "${status?.name}" (ID: ${row.status_id}) at loc_type: ${actionType?.loc_type_id}`);
        });

        // Get location types
        const locationTypes = getCachedTable('location_types');
        console.log('\nLocation Types:');
        locationTypes.forEach(row => {
            console.log(`  ${row.id}: ${row.name}`);
        });

    } catch (error) {
        console.error('Error in debugActionStatuses:', error);
    }
    console.log('=== END ACTION_STATUSES DEBUG ===');
};

// Debug function to check what actions should be available for a specific item using Supabase
window.debugItemActions = async function(inventoryId) {
    console.log('=== DEBUGGING ITEM ACTIONS ===');
    console.log('Inventory ID:', inventoryId);

    try {
        // Get item details
        const { data: item } = await supabase
            .from('inventory')
            .select(`
                id,
                location_id,
                status_id,
                locations(name, loc_type_id, location_types(name)),
                statuses(name),
                item_types(name)
            `)
            .eq('id', inventoryId)
            .single();

        if (item) {
            console.log('Item Details:', {
                id: item.id,
                location_id: item.location_id,
                status_id: item.status_id,
                location_name: item.locations?.name,
                loc_type_id: item.locations?.loc_type_id,
                location_type_name: item.locations?.location_types?.name,
                status_name: item.statuses?.name,
                item_type_name: item.item_types?.name
            });

            // Get available actions using the same logic as getAvailableActions
            const availableActions = await getAvailableActionsSupabase(item.location_id, item.status_id, inventoryId);
            console.log('Available actions for this item:', availableActions);

        } else {
            console.log('Item not found with ID:', inventoryId);
        }

    } catch (error) {
        console.error('Error in debugItemActions:', error);
    }

    console.log('=== END ITEM ACTIONS DEBUG ===');
};

/**
 * Update the display of selected serialized items for issue.
 * Shows a list of selected serials in the UI.
 */
function updateSelectedSerializedForIssueDisplay() {
    const container = document.getElementById('selectedSerializedForIssue');
    if (!container) return;
    if (!window.selectedSerializedForIssue || window.selectedSerializedForIssue.length === 0) {
        container.innerHTML = '<em>No items selected for issue.</em>';
        return;
    }
    container.innerHTML = '<strong>Selected for Issue:</strong><ul>' +
        window.selectedSerializedForIssue.map(item =>
            `<li>${item.mfgrSN} (${item.tilsonSN})</li>`
        ).join('') +
        '</ul>';
}

window.updateSelectedSerializedForIssueDisplay = updateSelectedSerializedForIssueDisplay;

// Show modal to complete the issue of selected serialized items
async function showMultiSerializedIssueModal(selectedItems) {
    // selectedItems: [{inventoryId, mfgrSN, tilsonSN}, ...]
    if (!selectedItems || selectedItems.length === 0) {
        alert('No items selected for issue.');
        return;
    }

    // Get crews and DFNs for dropdowns using Supabase
    const crews = await ModalUtils.getAllCrews();
    const { data: dfns } = await supabase
        .from('dfns')
        .select('id, name')
        .eq('sloc_id', window.selectedSlocId)
        .order('name');

    // Generate options
    const crewOptions = ModalUtils.generateDropdownOptions(crews, 'Select a crew...');
    const dfnOptions = ModalUtils.generateDropdownOptions(dfns || [], 'Select a DFN...');

    // Generate serials list
    const serialsList = await Promise.all(selectedItems.map(async item => {
        // Fetch quantity for each item
        const data = await ModalUtils.getInventoryData(item.inventoryId);
        const qty = data?.quantity || 1;
        return `<li>${item.mfgrSN} (${item.tilsonSN}) - Qty: ${qty}</li>`;
    }));

    // Modal body
    const modalBody = `
        <div>
            <h4>Serials to Issue (${selectedItems.length}):</h4>
            <ul style="max-height:150px;overflow:auto;">${serialsList.join('')}</ul>
            <div class="modal-form-group">
                <label for="multiIssueCrewSelect"><strong>Crew:</strong></label>
                <select id="multiIssueCrewSelect">${crewOptions}</select>
            </div>
            <div class="modal-form-group">
                <label for="multiIssueDfnSelect"><strong>DFN:</strong></label>
                <select id="multiIssueDfnSelect">${dfnOptions}</select>
            </div>
            <div class="modal-form-group">
                <label for="multiIssueNotes"><strong>Notes (optional):</strong></label>
                <textarea id="multiIssueNotes" rows="2" style="width:95%"></textarea>
            </div>
            <div id="multi-issue-signature-area" style="margin-top:10px;">
                <label for="multi-issue-signature-pad"><strong>Signature:</strong></label><br>
                <canvas id="multi-issue-signature-pad" width="300" height="80" style="border:1px solid #ccc;"></canvas><br>
                <button type="button" id="multi-issue-clear-signature">Clear Signature</button>
            </div>
        </div>
    `;

    // Create modal
    const modal = ModalUtils.createModal('multiSerializedIssueModal', {
        title: 'Issue Multiple Serialized Items',
        className: 'modal-base issue-modal',
        body: modalBody,
        buttons: [
            { id: 'cancelMultiIssueBtn', text: 'Cancel', className: 'issue-btn-secondary' },
            { id: 'executeMultiIssueBtn', text: 'Issue Items', className: 'issue-btn-primary', disabled: true },
            { id: 'downloadMultiIssuePDFBtn', text: 'Download PDF', className: 'issue-btn-secondary' }
        ]
    });

    // Setup events
    ModalUtils.setupModalEvents(modal, {
        closeHandlers: ['cancelMultiIssueBtn'],
        executeHandler: {
            id: 'executeMultiIssueBtn',
            handler: async () => {
                const crewId = document.getElementById('multiIssueCrewSelect').value;
                const dfnId = document.getElementById('multiIssueDfnSelect').value;
                const notes = document.getElementById('multiIssueNotes').value.trim();

                // Validate
                if (!crewId || !dfnId) {
                    alert('Please select both Crew and DFN.');
                    return;
                }

                // Signature (optional: check if required)
                const signaturePad = window.multiIssueSignaturePad;
                let signatureImageBytes = null;
                if (signaturePad && !signaturePad.isEmpty()) {
                    const dataUrl = signaturePad.toDataURL('image/png');
                    signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
                }

                // Update all selected items in Supabase
                const issuedStatusId = await ModalUtils.getStatusId('Issued');
                // You may want to get the "With Crew" location ID from a config or lookup
                const { data: withCrewLocation } = await supabase
                    .from('locations')
                    .select('id')
                    .eq('name', 'With Crew')
                    .single();
                const withCrewLocationId = withCrewLocation?.id;

                for (const item of selectedItems) {
                    await supabase
                        .from('inventory')
                        .update({
                            status_id: issuedStatusId,
                            location_id: withCrewLocationId,
                            assigned_crew_id: crewId,
                            dfn_id: dfnId
                        })
                        .eq('id', item.inventoryId);

                    // Optionally log transaction here
                    if (window.transactionLogger) {
                        await window.transactionLogger.logInventoryUpdated(
                            item.inventoryId,
                            {}, // beforeData (optional)
                            {
                                status_id: issuedStatusId,
                                location_id: withCrewLocationId,
                                assigned_crew_id: crewId,
                                dfn_id: dfnId
                            },
                            ['Issued via multi-issue modal']
                        );
                    }
                }

                // Optionally: generate PDF receipt with signature

                // Success
                alert(`Issued ${selectedItems.length} items.`);
                ModalUtils.closeModal('multiSerializedIssueModal');
                // Reset the subaccordion UI and selection state
                if (typeof resetSerializedIssueProcess === 'function') resetSerializedIssueProcess();
                // Refresh inventory list
                if (typeof loadSerializedInventoryList === 'function') loadSerializedInventoryList();
            }
        },
        customHandlers: [
            { id: 'downloadMultiIssuePDFBtn', handler: async () => {
                await downloadMultiIssuePDF(selectedItems);
            }}
        ]
    });

    // Enable/disable Issue button based on selection
    const crewSelect = document.getElementById('multiIssueCrewSelect');
    const dfnSelect = document.getElementById('multiIssueDfnSelect');
    const executeBtn = document.getElementById('executeMultiIssueBtn');
    function validate() {
        executeBtn.disabled = !(crewSelect.value && dfnSelect.value);
    }
    crewSelect.addEventListener('change', validate);
    dfnSelect.addEventListener('change', validate);
    validate();

    // Setup signature pad
    setTimeout(() => {
        const canvas = document.getElementById('multi-issue-signature-pad');
        if (canvas) {
            window.multiIssueSignaturePad = new window.SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
            document.getElementById('multi-issue-clear-signature').onclick = () => window.multiIssueSignaturePad.clear();
        }
    }, 0);
}

// Expose to global scope
window.showMultiSerializedIssueModal = showMultiSerializedIssueModal;

// Filter inventory table to show only available serialized items
function showOnlyAvailableSerializedItems() {
    document.querySelectorAll('.inventory-item-row').forEach(row => {
        if (row.dataset.status !== "Available") {
            row.style.display = "none";
        } else {
            row.style.display = "";
        }
    });
}

/**
 * Generate and download a PDF for multi-issue operation.
 * @param {Array} selectedItems - Array of {inventoryId, mfgrSN, tilsonSN}
 */
async function downloadMultiIssuePDF(selectedItems) {
    // Gather modal info
    const modal = document.getElementById('multiSerializedIssueModal');
    if (!modal) return;

    const crew = document.getElementById('multiIssueCrewSelect')?.selectedOptions[0]?.textContent || '';
    const dfn = document.getElementById('multiIssueDfnSelect')?.selectedOptions[0]?.textContent || '';
    const notes = document.getElementById('multiIssueNotes')?.value || '';
    const signerName = ''; // Add a field for signer name if needed
    const signaturePad = window.multiIssueSignaturePad;
    let signatureImageBytes = null;
    if (signaturePad && !signaturePad.isEmpty()) {
        const dataUrl = signaturePad.toDataURL('image/png');
        signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
    }

    const rows = await Promise.all(selectedItems.map(async item => {
        const data = await ModalUtils.getInventoryData(item.inventoryId);
        const qty = data?.quantity || 1;
        return {
            name: `${item.mfgrSN} (${item.tilsonSN})`,
            quantity: qty
        };
    }));

    await generateInventoryOperationPDF({
        operationType: 'Serialized Issue',
        headerInfo: {
            'Crew': crew,
            'DFN': dfn,
            'Date': new Date().toLocaleDateString()
        },
        rows,
        extraFields: { name: signerName, comments: notes },
        signatureImageBytes
    });
}

window.downloadMultiIssuePDF = downloadMultiIssuePDF;


/**
 * Get available actions based on location and status using Supabase
 * @param {string} locationId - Location ID
 * @param {string} statusId - Status ID
 * @param {string} inventoryId - Inventory ID (optional, for future use)
 * @returns {Promise<Array>} - Array of available action objects
 */
async function getAvailableActionsSupabase(locationId, statusId, inventoryId = null) {
    try {
        // 1. Get the location type ID for this location
        const { data: location, error: locError } = await supabase
            .from('locations')
            .select('loc_type_id, location_types(name)')
            .eq('id', locationId)
            .single();
        if (locError || !location) {
            console.warn('Location type ID not found for location ID:', locationId);
            return [];
        }
        const locationTypeId = location.loc_type_id;

        // 2. Get all action_statuses for this status
        const { data: actionStatuses, error: asError } = await supabase
            .from('action_statuses')
            .select('inv_action_id')
            .eq('status_id', statusId);
        if (asError || !actionStatuses || actionStatuses.length === 0) {
            return [];
        }
        const actionIds = actionStatuses.map(row => row.inv_action_id);

        // 3. Get all actions for this location type and those action IDs
        let actions = [];
        if (actionIds.length > 0) {
            const { data: actionData, error: actError } = await supabase
                .from('inv_action_types')
                .select('id, name, description')
                .eq('loc_type_id', locationTypeId)
                .in('id', actionIds)
                .order('id');
            if (!actError && actionData) {
                actions = actionData;
            }
        }
        return actions;
    } catch (error) {
        console.error('Error getting available actions (Supabase):', error);
        return [];
    }
}

/**
 * Show action modal with available actions
 * @param {Array} actions - Available actions
 * @param {string} inventoryId - Inventory item ID
 * @param {HTMLTableRowElement} clickedRow - The clicked row element
 * @param {Event} event - The click event (optional, for cursor positioning)
 */
function showActionModal(actions, inventoryId, clickedRow, event = null) {
    try {
        // Remove any existing action modal
        const existingModal = document.getElementById('actionModal');
        if (existingModal) {
            existingModal.remove();
        }

        console.log('Showing action modal with actions:', actions);

        // Create modal container
        const modal = document.createElement('div');
        modal.id = 'actionModal';
        modal.className = 'action-modal';
        
        // Create modal content
        const modalContent = document.createElement('div');
        modalContent.className = 'action-modal-content';
        
        // Create header
        const header = document.createElement('div');
        header.className = 'action-modal-header';
        header.innerHTML = '<h3>Available Actions</h3>';
        modalContent.appendChild(header);
        
        // Create actions list
        const actionsList = document.createElement('div');
        actionsList.className = 'actions-list';
        
        actions.forEach(action => {
            const actionButton = document.createElement('button');
            actionButton.className = 'action-button';
            
            // Determine button styling based on action type
            const actionName = action.name.toLowerCase();
            let buttonClass = '';
            let isSmallButton = false;
            
            // Color-code buttons based on their modal colors
            switch(actionName) {
                case 'move':
                    buttonClass = 'action-button-blue';
                    break;
                case 'reserve':
                case 'unreserve':
                    buttonClass = 'action-button-green';
                    break;
                case 'issue':
                case 'remove':
                    buttonClass = 'action-button-red';
                    break;
                case 'adjust':
                case 'assign dfn':
                case 'reject':
                    buttonClass = 'action-button-gray';
                    isSmallButton = true; // Make gray buttons smaller
                    break;
                default:
                    buttonClass = 'action-button-default';
            }
            
            actionButton.classList.add(buttonClass);
            if (isSmallButton) {
                actionButton.classList.add('action-button-small');
            }
            
            actionButton.innerHTML = `
                <div class="action-name">${action.name}</div>
                <div class="action-description">${action.description}</div>
            `;
            
            actionButton.addEventListener('click', () => {
                handleActionSelect(action, inventoryId);
            });
            
            actionsList.appendChild(actionButton);
        });
        
        modalContent.appendChild(actionsList);
        
        // Create footer with cancel button
        const footer = document.createElement('div');
        footer.className = 'action-modal-footer';
        
        const cancelButton = document.createElement('button');
        cancelButton.className = 'cancel-button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', closeActionModal);
        
        footer.appendChild(cancelButton);
        modalContent.appendChild(footer);
        
        modal.appendChild(modalContent);
        
        // Position modal near the cursor/clicked row
        positionModalNearRow(modal, clickedRow, event);
        
        // Add modal to page
        document.body.appendChild(modal);
        
        // Add click outside to close
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeActionModal();
            }
        });
        
        // Add escape key to close
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                closeActionModal();
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
        
    } catch (error) {
        console.error('Error showing action modal:', error);
    }
}



/**
 * Position modal near the clicked row, centered vertically at cursor position
 * @param {HTMLElement} modal - Modal element
 * @param {HTMLTableRowElement} row - Clicked row element
 * @param {Event} event - The click event (optional, for cursor positioning)
 */
function positionModalNearRow(modal, row, event = null) {
    const rowRect = row.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    // Get cursor position if event is available, otherwise use row center
    let cursorY;
    if (event && event.clientY) {
        cursorY = event.clientY + scrollTop;
    } else {
        cursorY = rowRect.top + scrollTop + (rowRect.height / 2);
    }
    
    // Position modal to the right of the row, or left if not enough space
    let left = rowRect.right + scrollLeft + 10;
    
    // Check if modal would go off-screen horizontally
    const modalWidth = 400; // Estimated modal width
    if (left + modalWidth > window.innerWidth + scrollLeft) {
        left = rowRect.left + scrollLeft - modalWidth - 10;
    }
    
    // Center modal vertically at cursor position
    const modalHeight = 300; // Estimated modal height
    let top = cursorY - (modalHeight / 2);
    
    // Check if modal would go off-screen vertically and adjust
    const viewportTop = scrollTop;
    const viewportBottom = scrollTop + window.innerHeight;
    
    // Ensure modal doesn't go above viewport
    if (top < viewportTop + 10) {
        top = viewportTop + 10;
    }
    
    // Ensure modal doesn't go below viewport
    if (top + modalHeight > viewportBottom - 10) {
        top = viewportBottom - modalHeight - 10;
    }
    
    modal.style.position = 'absolute';
    modal.style.left = `${Math.max(10, left)}px`;
    modal.style.top = `${Math.max(10, top)}px`;
    modal.style.zIndex = '10000';
}

/**
 * Handle action selection
 * @param {Object} action - Selected action
 * @param {string} inventoryId - Inventory item ID
 */
function handleActionSelect(action, inventoryId = null) {
    console.log('Action selected:', action, 'for inventory ID:', inventoryId);
    
    // Close the action modal first
    closeActionModal();
    
    // Handle different action types
    switch(action.name.toLowerCase()) {
        case 'move':
            showMoveModal(inventoryId);
            break;
        case 'inspect':
            showInspectModal(inventoryId);
            break;
        case 'reserve':
            showReserveModal(inventoryId);
            break;
        case 'unreserve':
            showUnreserveModal(inventoryId);
            break;
        case 'issue':
            showIssueModal(inventoryId);
            break;
        case 'adjust':
            console.log('Attempting to show adjust modal for inventory ID:', inventoryId);
            try {
                showAdjustModal(inventoryId);
            } catch (error) {
                console.error('Error showing adjust modal:', error);
                alert('Error opening adjust modal: ' + error.message);
            }
            break;
        case 'assign dfn':
            console.log('Attempting to show assign DFN modal for inventory ID:', inventoryId);
            try {
                showAssignDfnModal(inventoryId);
            } catch (error) {
                console.error('Error showing assign DFN modal:', error);
                alert('Error opening assign DFN modal: ' + error.message);
            }
            break;
        case 'reject':
            console.log('Attempting to show reject modal for inventory ID:', inventoryId);
            try {
                showRejectModal(inventoryId);
            } catch (error) {
                console.error('Error showing reject modal:', error);
                alert('Error opening reject modal: ' + error.message);
            }
            break;
        case 'field install':
            console.log('Attempting to show install modal for inventory ID:', inventoryId);
            try {
                showInstallModal(inventoryId);
            } catch (error) {
                console.error('Error showing install modal:', error);
                alert('Error opening install modal: ' + error.message);
            }
            break;
        case 'remove':
            console.log('Attempting to show remove modal for inventory ID:', inventoryId);
            try {
                showRemoveModal(inventoryId);
            } catch (error) {
                console.error('Error showing remove modal:', error);
                alert('Error opening remove modal: ' + error.message);
            }
            break;

        case 'return material':
            console.log('Attempting to show return as available modal for inventory ID:', inventoryId);
            try {
                showReturnAsAvailableModal(inventoryId);
            } catch (error) {
                console.error('Error showing return as available modal:', error);
                alert('Error opening return as available modal: ' + error.message);
            }
            break;

        case 'displaybulkreceivereceiptmodal':
            console.log('Attempting to show bulk receive receipt modal');
            try {
                const receiptData = getBulkReceiveReceiptData().then(data => {
                    console.log("receiptData (from promise): ", data);
                    displayBulkReceiveReceipt(data);
                });
            } catch (error) {
                console.error('Error showing bulk receive receipt modal:', error);
                alert('Error opening bulk receive receipt modal: ' + error.message);
            }
            break;

        case 'displaybulkissuereceiptmodal':
            console.log('Attempting to show bulk issue receipt modal');
            try {
                const receiptData = getBulkIssueReceiptData().then(data => {
                    console.log("receiptData (from promise): ", data);
                    displayBulkIssueReceipt(data);
                });
            } catch (error) {
                console.error('Error showing bulk issue receipt modal:', error);
                alert('Error opening bulk issue receipt modal: ' + error.message);
            }
            break;
        case 'executeBulkIssueAction':
            console.log('Attempting to execute bulk issue action');
            try {
                processBulkInventoryInsertion('issue');
            } catch (error) {
                console.error('Error executing bulk issue action:', error);
                alert('Error executing bulk issue action: ' + error.message);
            }

        default:
            alert(`Selected action: ${action.name}\nFor inventory ID: ${inventoryId}\n\nThis will open a specific modal for the action.`);
    }
}


async function getBulkReceiveReceiptData() {
    // Get the next receipt number from Supabase CONFIG table
    const receiptNum = await getReceiptNumber();
    const receiptString = "BR-" + String(receiptNum).padStart(6, '0');

    // Iterate through the Manage Bulk Items html table and get the names and quantities of items with quantities to receive
    const items = [];
    $('#bulkItemTypesMatrix tbody tr').each(function() {
        const itemName = $(this).find('.bulk-item-name-cell').text();
        const itemQuantity = parseInt($(this).find('.bulk-quantity-input').val()) || 0;
        if (itemQuantity > 0) {
            items.push({ name: itemName, quantity: itemQuantity });
        }
    });

    return {
        receiptNumber: receiptString,
        items: items
    };
}


async function getReceiptNumber() {
    try {
        const { data, error } = await supabase
            .from('config')
            .select('value')
            .eq('key', 'receiptNumber')
            .single();
        if (error) throw error;
        return parseInt(data.value, 10) || 1;
    } catch (e) {
        console.warn('Could not get receiptNumber:', e);
        return 1;
    }
}

async function setReceiptNumber(newNumber) {
    try {
        const { error } = await supabase
            .from('config')
            .update({ value: String(newNumber) })
            .eq('key', 'receiptNumber');
        if (error) throw error;
    } catch (e) {
        console.error('Could not set receiptNumber:', e);
    }
}


/**
 * Get data for the bulk issue receipt.
 * Returns an object with receipt number, crew, dfn, and items.
 * Uses Supabase for receipt number.
 */
async function getBulkIssueReceiptData() {
    // Get the next receipt number from Supabase CONFIG table
    const receiptNum = await getReceiptNumber();
    const receiptString = "BI-" + String(receiptNum).padStart(6, '0');

    // Iterate through the Manage Bulk Items html table and get the names and quantities of items to issue
    const items = [];
    $('#bulkItemTypesMatrix tbody tr').each(function() {
        const itemName = $(this).find('.bulk-item-name-cell').text();
        const itemQuantity = parseInt($(this).find('.bulk-quantity-input').val()) || 0;
        if (itemQuantity > 0) {
            items.push({ name: itemName, quantity: itemQuantity });
        }
    });

    const assignedCrew = $('#bulk_issue_assigned_crew_id').val();
    const dfn = $('#bulk_issue_dfn_id').val();

    return {
        receiptNumber: receiptString,
        crewIssuedTo: assignedCrew,
        dfn: dfn,
        items: items
    };
}


/**
 * Display the bulk receive receipt modal.
 * @param {Object} receiptData - { receiptNumber, items }
 */
async function displayBulkReceiveReceipt(receiptData) {
    // Optionally, get the current user's name or allow input
    let receivedBy = '';
    if (window.currentUser && window.currentUser.name) {
        receivedBy = window.currentUser.name;
    }

    // Modal body HTML
    const modalBody = `
        <div>
            <h4>Bulk Receive Receipt</h4>
            <div><strong>Receipt Number:</strong> ${receiptData.receiptNumber}</div>
            <div class="modal-form-group">
                <label for="bulkReceiveReceivedBy"><strong>Received By:</strong></label>
                <input type="text" id="bulkReceiveReceivedBy" value="${receivedBy}" style="width: 95%;" placeholder="Enter your name">
            </div>
            <div style="margin-top: 12px;"><strong>Items Received:</strong></div>
            <ul>
                ${receiptData.items.map(item => `<li>${item.name} (Qty: ${item.quantity})</li>`).join('')}
            </ul>
            <div style="margin-top: 16px;">
                <button type="button" class="btn btn-primary" id="processBulkReceiveAction">Submit</button>
                <button type="button" class="btn btn-secondary" id="cancelBulkReceiveReceiptBtn">Cancel</button>
            </div>
        </div>
    `;

    // Create and show modal
    const modal = ModalUtils.createModal('bulkReceiveReceiptModal', {
        title: 'Bulk Receive Receipt',
        className: 'modal-base bulk-receive-modal',
        body: modalBody,
        buttons: [] // Buttons are in the body for layout
    });

    // Setup close handler
    document.getElementById('cancelBulkReceiveReceiptBtn').onclick = () => ModalUtils.closeModal('bulkReceiveReceiptModal');

    // Setup submit handler
    document.getElementById('processBulkReceiveAction').onclick = async () => {
        // You can process the form data as needed here
        // For example, you might want to save the receipt, update inventory, etc.
        // You can also increment the receipt number if needed:
        await setReceiptNumber(await getReceiptNumber() + 1);

        ModalUtils.closeModal('bulkReceiveReceiptModal');
        if (typeof processBulkInventoryInsertion === 'function') {
            processBulkInventoryInsertion('receive');
        }
    };
}


/**
 * Display the bulk issue receipt modal.
 * @param {Object} receiptData - { receiptNumber, crewIssuedTo, dfn, items }
 */
async function displayBulkIssueReceipt(receiptData) {
    console.log('Displaying bulk issue receipt with data:', receiptData);
    // Get crew name for display
    let crewName = receiptData.crewIssuedTo ? (getCachedRow('crews', receiptData.crewIssuedTo)?.name || 'Unknown Crew') : 'Unknown Crew';
    let dfnName = receiptData.dfn ? (getCachedRow('dfns', receiptData.dfn)?.name || 'No DFN') : 'No DFN';

    // Generate form section (left side)
    const formSection = `
        <div class="issue-form-section">
            <h4>Issue Receipt Summary</h4>
            <div class="modal-form-group">
                <label><strong>Receipt Number:</strong></label>
                <div class="receipt-info">${receiptData.receiptNumber}</div>
            </div>
            <div class="modal-form-group">
                <label><strong>Issued to Crew:</strong></label>
                <div class="receipt-info">${crewName}</div>
            </div>
            <div class="modal-form-group">
                <label><strong>DFN Assignment:</strong></label>
                <div class="receipt-info">${dfnName}</div>
            </div>
            <div class="modal-form-group">
                <label><strong>Issue Date:</strong></label>
                <div class="receipt-info">${new Date().toLocaleDateString()}</div>
            </div>
            <div class="issue-warning">
                <strong>Note:</strong> This bulk issue operation will process all selected items and move them to "With Crew" status.
            </div>
        </div>
    `;

    // Generate info section (right side) - items list
    const infoSection = `
        <div class="info-section">
            <h4>Items to be Issued</h4>
            <div class="items-list">
                <table class="receipt-items-table">
                    <thead>
                        <tr>
                            <th>Item Name</th>
                            <th>Quantity</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${receiptData.items.map(item => `
                            <tr>
                                <td>${item.name}</td>
                                <td>${item.quantity}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                    <tfoot>
                        <tr class="total-row">
                            <td><strong>Total Items:</strong></td>
                            <td><strong>${receiptData.items.reduce((sum, item) => sum + item.quantity, 0)}</strong></td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
        <div id="receipt-extra-fields" style="margin-top:16px;">
            <label for="receipt-signer-name"><strong>Name:</strong></label><br>
            <input type="text" id="receipt-signer-name" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your name"><br>
            <label for="receipt-email"><strong>Email:</strong></label><br>
            <input type="email" id="receipt-email" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your email"><br>
            <label for="receipt-notes"><strong>Notes:</strong></label><br>
            <textarea id="receipt-notes" rows="2" style="width: 95%; margin-bottom: 8px;" placeholder="Enter any notes..."></textarea>
        </div>
        <div id="signature-area" style="margin-top:10px;">
            <label for="modal-signature-pad"><strong>Signature:</strong></label><br>
            <canvas id="modal-signature-pad" width="300" height="80" style="border:1px solid #ccc;"></canvas><br>
            <button type="button" id="modal-clear-signature">Clear Signature</button>
        </div>
    `;

    // Create two-column layout
    const twoColumnBody = `
        <div class="issue-two-column">
            <div class="issue-left-column">
                ${formSection}
            </div>
            <div class="issue-right-column">
                ${infoSection}
            </div>
        </div>
    `;

    // Create modal using ModalUtils
    const modal = ModalUtils.createModal('bulkIssueReceiptModal', {
        title: 'Bulk Issue Receipt',
        className: 'modal-base issue-modal',
        body: twoColumnBody,
        buttons: [
            { id: 'cancelBulkIssueReceiptBtn', text: 'Cancel', className: 'issue-btn-secondary' },
            { id: 'processBulkIssueAction', text: 'Process Bulk Issue', className: 'issue-btn-primary' },
            { id: 'downloadBulkIssuePDFBtn', text: 'Download PDF', className: 'issue-btn-secondary' }
        ]
    });

    // Setup event listeners using ModalUtils
    ModalUtils.setupModalEvents(modal, {
        closeHandlers: ['cancelBulkIssueReceiptBtn'],
        executeHandler: { 
            id: 'processBulkIssueAction', 
            handler: async () => {
                try {
                    await processBulkInventoryInsertion('issue');
                    await setReceiptNumber(await getReceiptNumber() + 1);
                    ModalUtils.closeModal('bulkIssueReceiptModal');
                } catch (error) {
                    console.error('Error processing bulk issue:', error);
                }
            }
        },
        customHandlers: [
            { id: 'downloadBulkIssuePDFBtn', handler: downloadBulkIssueReceiptPDF }
        ]
    });

    // Setup signature pad after modal is rendered
    setTimeout(() => {
        const modalCanvas = document.getElementById('modal-signature-pad');
        if (modalCanvas) {
            window.modalSignaturePad = new window.SignaturePad(modalCanvas, {
                backgroundColor: 'rgb(255,255,255)'
            });
            document.getElementById('modal-clear-signature').onclick = () => window.modalSignaturePad.clear();
        }
    }, 0);
}


/**
 * Generate and download a PDF for an inventory operation.
 * @param {Object} options
 * @param {string} options.operationType - e.g. 'Issue', 'Return', 'Bulk Issue', etc.
 * @param {Object} options.headerInfo - Key-value pairs for header fields (e.g. { 'Receipt Number': '...', 'Crew': '...' })
 * @param {Array} options.rows - Array of row objects, each with { name, quantity } or similar fields
 * @param {Object} options.extraFields - { name, email, comments }
 * @param {Uint8Array|ArrayBuffer|null} options.signatureImageBytes - PNG image bytes for signature, or null
 */
async function generateInventoryOperationPDF({
    operationType,
    headerInfo = {},
    rows = [],
    extraFields = {},
    signatureImageBytes = null
}) {
    const { PDFDocument, rgb } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size

    const marginLeft = 50;
    let y = 740;

    // Title
    page.drawRectangle({ x: marginLeft, y: y - 5, width: 512, height: 1, color: rgb(0, 0, 0) });
    page.drawText(`${operationType.toUpperCase()} RECEIPT`, { x: marginLeft, y, size: 18 });
    y -= 24;

    // Header fields
    for (const [label, value] of Object.entries(headerInfo)) {
        page.drawText(`${label}: ${value}`, { x: marginLeft, y, size: 12 });
        y -= 16;
    }

    // Extra fields (Name, Email, Comments)
    if (extraFields.name) {
        page.drawText(`Signed by: ${extraFields.name}`, { x: marginLeft, y, size: 12 });
        y -= 16;
    }
    if (extraFields.email) {
        page.drawText(`Email: ${extraFields.email}`, { x: marginLeft, y, size: 12 });
        y -= 16;
    }
    if (extraFields.comments) {
        page.drawText(`Comments: ${extraFields.comments}`, { x: marginLeft, y, size: 12 });
        y -= 16;
    }
    y -= 8;

    // Table header
    if (rows.length > 0) {
        const colWidths = [300, 100];
        const headers = Object.keys(rows[0]);
        headers.forEach((header, i) => {
            page.drawText(header.charAt(0).toUpperCase() + header.slice(1), { x: marginLeft + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, size: 12 });
        });
        y -= 16;

        // Table rows
        rows.forEach(row => {
            let x = marginLeft;
            headers.forEach(header => {
                page.drawText(String(row[header]), { x, y, size: 12 });
                x += colWidths[headers.indexOf(header)];
            });
            y -= 16;
        });
        y -= 16;
    }

    // Signature
    y -= 40;
    const sigX = marginLeft;
    const sigY = y - 60;
    const sigW = 200;
    const sigH = 50;
    page.drawText('Signature:', { x: sigX, y: sigY + sigH + 10, size: 12 });
    page.drawRectangle({
        x: sigX,
        y: sigY,
        width: sigW,
        height: sigH,
        borderColor: rgb(0, 0, 0),
        borderWidth: 2
    });
    if (signatureImageBytes) {
        const pngImage = await pdfDoc.embedPng(signatureImageBytes);
        page.drawImage(pngImage, {
            x: sigX + 2,
            y: sigY + 2,
            width: sigW - 4,
            height: sigH - 4
        });
    }

    // Save and download
    const pdfBytes = await pdfDoc.save();
    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const filename = `${operationType.replace(/\s+/g, '_').toUpperCase()}_${headerInfo['Receipt Number'] || ''}_${extraFields.name || ''}.pdf`;

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
}




async function downloadBulkIssueReceiptPDF() {
    const modal = document.getElementById('bulkIssueReceiptModal');
    if (!modal) return;

    const receiptNumber = getReceiptNumber();
    const receiptString = "BI-" + String(receiptNumber).padStart(6, '0');
    const crew = modal.querySelectorAll('.receipt-info')[1]?.textContent || '';
    const dfn = modal.querySelectorAll('.receipt-info')[2]?.textContent || '';
    const date = modal.querySelectorAll('.receipt-info')[3]?.textContent || '';
    const itemsTable = modal.querySelector('.receipt-items-table');
    const itemsRows = itemsTable ? itemsTable.querySelectorAll('tbody tr') : [];

    const signerName = document.getElementById('receipt-signer-name')?.value || '';
    const signerEmail = document.getElementById('receipt-email')?.value || '';
    const comments = document.getElementById('receipt-notes')?.value || '';

    const signaturePad = window.modalSignaturePad;
    let signatureImageBytes = null;
    if (signaturePad && !signaturePad.isEmpty()) {
        const dataUrl = signaturePad.toDataURL('image/png');
        signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
    }

    const rows = Array.from(itemsRows).map(row => {
        const tds = row.querySelectorAll('td');
        return { name: tds[0]?.textContent || '', quantity: tds[1]?.textContent || '' };
    });

    await generateInventoryOperationPDF({
        operationType: 'Bulk Issue',
        headerInfo: {
            'Receipt Number': receiptString,
            'Crew': crew,
            'DFN': dfn,
            'Date': date
        },
        rows,
        extraFields: { name: signerName, email: signerEmail, comments },
        signatureImageBytes
    });
}


/**
 * Generate and download a PDF for the issue modal.
 */
async function downloadIssuePDF() {
    const modal = document.getElementById('issueModal');
    if (!modal) return;

    // Get receipt number and format
    const receiptNum = await getReceiptNumber();
    const receiptString = "IS-" + String(receiptNum).padStart(6, '0');

    // Get item name and quantity
    const itemName = modal.querySelector('.info-item span')?.textContent || '';
    const quantity = modal.querySelector('#currentQuantityDisplay')?.textContent || '';

    // Get crew, dfn, and date from modal
    const crew = document.getElementById('crewSelect')?.selectedOptions[0]?.textContent || '';
    const dfn = document.getElementById('dfnSelect')?.selectedOptions[0]?.textContent || '';
    const date = new Date().toLocaleDateString();

    // Get extra fields
    const signerName = document.getElementById('issue-signer-name')?.value || '';
    const signerEmail = document.getElementById('issue-email')?.value || '';
    const comments = document.getElementById('issue-comments')?.value || '';

    // Get signature image if present
    const signaturePad = window.issueSignaturePad;
    let signatureImageBytes = null;
    if (signaturePad && !signaturePad.isEmpty()) {
        const dataUrl = signaturePad.toDataURL('image/png');
        signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
    }

    const rows = [{ name: itemName, quantity }];

    await generateInventoryOperationPDF({
        operationType: 'Issue',
        headerInfo: {
            'Receipt Number': receiptString,
            'Crew': crew,
            'DFN': dfn,
            'Date': date
        },
        rows,
        extraFields: { name: signerName, email: signerEmail, comments },
        signatureImageBytes
    });
}


/**
 * Generate and download a PDF for the return as available modal.
 */
async function downloadReturnPDF() {
    const modal = document.getElementById('returnAsAvailableModal');
    if (!modal) return;

    // Get receipt number and format
    const receiptNum = await getReceiptNumber();
    const receiptString = "RA-" + String(receiptNum).padStart(6, '0');

    // Get item name and quantity
    const itemName = modal.querySelector('.info-item span')?.textContent || '';
    const quantity = modal.querySelector('#currentQuantityDisplay')?.textContent || '';

    // Get crew and date from modal
    const crew = modal.querySelector('.info-item:nth-child(5) span')?.textContent || '';
    const date = new Date().toLocaleDateString();

    // Get extra fields
    const signerName = document.getElementById('return-signer-name')?.value || '';
    const signerEmail = document.getElementById('return-email')?.value || '';
    const comments = document.getElementById('return-comments')?.value || '';

    // Get signature image if present
    const signaturePad = window.returnSignaturePad;
    let signatureImageBytes = null;
    if (signaturePad && !signaturePad.isEmpty()) {
        const dataUrl = signaturePad.toDataURL('image/png');
        signatureImageBytes = await fetch(dataUrl).then(res => res.arrayBuffer());
    }

    const rows = [{ name: itemName, quantity }];

    await generateInventoryOperationPDF({
        operationType: 'Return',
        headerInfo: {
            'Receipt Number': receiptString,
            'Crew': crew,
            'Date': date
        },
        rows,
        extraFields: { name: signerName, email: signerEmail, comments },
        signatureImageBytes
    });
}


// ============================================================================
// MOVE MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the move modal for an inventory item (Supabase version, succinct)
 * @param {string} inventoryId - Inventory item ID
 */
async function showMoveModal(inventoryId) {
    try {
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return alert('Could not load inventory item data');

        // Get storage locations (excluding current)
        const { data: storageLocations } = await supabase
            .from('locations')
            .select('id, name')
            .in('loc_type_id', [
                (await supabase.from('location_types').select('id').eq('name', 'Storage')).data[0]?.id
            ])
            .neq('id', inventoryData.location_id)
            .order('name');

        if (!storageLocations || storageLocations.length === 0) {
            alert('No available storage locations found for moving this item.');
            return;
        }

        const locationOptions = ModalUtils.generateDropdownOptions(storageLocations, 'Select a storage location...');
        const formSection = `
            <div class="move-form-section">
                <h4>Move Details</h4>
                <div class="move-form-group">
                    <label for="moveToLocation"><strong>Move to Location:</strong></label>
                    <select id="moveToLocation" required>${locationOptions}</select>
                </div>
                <div class="move-form-group">
                    <label for="moveQuantity"><strong>Quantity to Move:</strong></label>
                    <input type="number" id="moveQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" required>
                    <div class="quantity-info">Available: ${inventoryData.quantity}</div>
                </div>
                <div class="move-warning">
                    <strong>Note:</strong> This will move the item(s) to the selected location.
                </div>
            </div>
        `;
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, false, 'Current Quantity');
        const modalBody = `
            <div class="move-two-column">
                <div class="move-left-column">${formSection}</div>
                <div class="move-right-column">${infoSection}</div>
            </div>
        `;

        const modal = ModalUtils.createModal('moveModal', {
            title: 'Move Inventory Item',
            className: 'modal-base move-modal',
            body: modalBody,
            buttons: [
                { id: 'cancelMoveBtn', text: 'Cancel', className: 'move-cancel-button' },
                { id: 'executeMoveBtn', text: 'Move', className: 'move-button', disabled: true }
            ]
        });

        // Validation and event listeners
        const moveBtn = document.getElementById('executeMoveBtn');
        const locationSelect = document.getElementById('moveToLocation');
        const quantityInput = document.getElementById('moveQuantity');
        function validateMove() {
            const qty = parseInt(quantityInput.value) || 0;
            moveBtn.disabled = !locationSelect.value || qty < 1 || qty > inventoryData.quantity;
        }
        locationSelect.addEventListener('change', validateMove);
        quantityInput.addEventListener('input', validateMove);
        validateMove();

        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelMoveBtn'],
            executeHandler: {
                id: 'executeMoveBtn',
                handler: async () => {
                    const qty = parseInt(quantityInput.value);
                    const destId = locationSelect.value;
                    if (qty === inventoryData.quantity) {
                        await supabase.from('inventory').update({ location_id: destId }).eq('id', inventoryId);
                    } else {
                        await supabase.from('inventory').update({ quantity: inventoryData.quantity - qty }).eq('id', inventoryId);
                        await supabase.from('inventory').insert([{
                            ...inventoryData,
                            id: undefined,
                            location_id: destId,
                            quantity: qty
                        }]);
                    }
                    await ModalUtils.handleSuccess('moveModal', 'Move completed.');
                }
            }
        });
    } catch (error) {
        console.error('Error showing move modal:', error);
        alert('Failed to show move modal: ' + error.message);
    }
}

/**
 * Get storage locations for the move modal dropdown, excluding current location.
 * @param {string|null} currentLocationId - Location ID to exclude (optional)
 * @returns {Promise<Array>} - Array of {id, name}
 */
async function getStorageLocations(currentLocationId = null) {
    // Get the ID for the "Storage" location type
    const { data: storageType } = await supabase
        .from('location_types')
        .select('id')
        .eq('name', 'Storage')
        .single();
    if (!storageType) return [];

    let query = supabase
        .from('locations')
        .select('id, name')
        .eq('loc_type_id', storageType.id);

    if (currentLocationId) {
        query = query.neq('id', currentLocationId);
    }

    const { data: locations } = await query.order('name');
    return locations || [];
}

/**
 * Setup succinct event listeners for the move modal.
 * @param {string} inventoryId
 * @param {Object} inventoryData
 */
function setupMoveModalEventListeners(inventoryId, inventoryData) {
    const modal = document.getElementById('moveModal');
    const moveBtn = document.getElementById('executeMoveBtn');
    const locationSelect = document.getElementById('moveToLocation');
    const quantityInput = document.getElementById('moveQuantity');

    function validate() {
        const qty = parseInt(quantityInput.value) || 0;
        moveBtn.disabled = !locationSelect.value || qty < 1 || qty > inventoryData.quantity;
    }

    locationSelect.addEventListener('change', validate);
    quantityInput.addEventListener('input', validate);
    validate();

    moveBtn.addEventListener('click', async () => {
        const qty = parseInt(quantityInput.value);
        const destId = locationSelect.value;
        if (qty === inventoryData.quantity) {
            await supabase.from('inventory').update({ location_id: destId }).eq('id', inventoryId);
        } else {
            await supabase.from('inventory').update({ quantity: inventoryData.quantity - qty }).eq('id', inventoryId);
            await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                location_id: destId,
                quantity: qty
            }]);
        }
        await ModalUtils.handleSuccess('moveModal', 'Move completed.');
    });

    // Close modal on cancel or outside click
    document.getElementById('cancelMoveBtn').onclick = () => ModalUtils.closeModal('moveModal');
    modal.addEventListener('click', e => {
        if (e.target === modal) ModalUtils.closeModal('moveModal');
    });
    document.addEventListener('keydown', function escHandler(e) {
        if (e.key === 'Escape') {
            ModalUtils.closeModal('moveModal');
            document.removeEventListener('keydown', escHandler);
        }
    });
}

/**
 * Execute the move operation (Supabase succinct version)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Current inventory data
 */
async function executeMoveOperation(inventoryId, inventoryData) {
    try {
        const locationId = document.getElementById('moveToLocation').value;
        const moveQuantity = parseInt(document.getElementById('moveQuantity').value);
        const currentQuantity = parseInt(inventoryData.quantity);

        if (!locationId || !moveQuantity || moveQuantity < 1 || moveQuantity > currentQuantity) {
            alert('Please select a valid location and quantity.');
            return;
        }

        if (moveQuantity === currentQuantity) {
            // Full move: just update location
            await supabase.from('inventory').update({ location_id: locationId }).eq('id', inventoryId);
            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    { location_id: inventoryData.location_id },
                    { location_id: locationId },
                    ['Move: Full quantity moved to new location']
                );
            }
        } else {
            // Partial move: update original, insert new
            await supabase.from('inventory').update({ quantity: currentQuantity - moveQuantity }).eq('id', inventoryId);
            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                location_id: locationId,
                quantity: moveQuantity
            }]).select('id').single();
            if (window.transactionLogger) {
                if (data?.id) {
                    await window.transactionLogger.logInventoryCreated(data.id, {
                        ...inventoryData,
                        location_id: locationId,
                        quantity: moveQuantity
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    currentQuantity,
                    currentQuantity - moveQuantity,
                    `Move: ${moveQuantity} units moved to new location`
                );
            }
        }
        await ModalUtils.handleSuccess('moveModal', 'Move completed.');
    } catch (error) {
        ModalUtils.handleError(error, 'move operation');
    }
}

// ============================================================================
// INSPECT MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the inspect modal for an inventory item (succinct, Supabase version)
 * @param {string} inventoryId - Inventory item ID
 */
async function showInspectModal(inventoryId) {
    try {
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Could not load inventory item data');

        // Determine if item is serialized (assume inventory_type is available)
        const isSerialized = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        // Form section
        const formSection = isSerialized
            ? `<div class="inspect-form-section">
                    <h4>Inspection Result</h4>
                    <div>
                        <input type="radio" id="inspectPassed" name="inspectionResult" value="passed" checked>
                        <label for="inspectPassed">Passed</label>
                        <input type="radio" id="inspectRejected" name="inspectionResult" value="rejected">
                        <label for="inspectRejected">Rejected</label>
                    </div>
                    <div class="serialized-notice">Serialized item: must be fully passed or rejected.</div>
                </div>`
            : `<div class="inspect-form-section">
                    <h4>Inspection Quantities</h4>
                    <label>Passed:</label>
                    <input type="number" id="passedQuantity" min="0" max="${inventoryData.quantity}" value="${inventoryData.quantity}">
                    <label>Rejected:</label>
                    <input type="number" id="rejectedQuantity" min="0" max="${inventoryData.quantity}" value="0">
                    <div class="quantity-info">Total: ${inventoryData.quantity}</div>
                    <div id="inspectQuantityError" class="error-message"></div>
                </div>`;

        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerialized, 'Current Quantity');
        const modalBody = `
            <div class="inspect-two-column">
                <div class="inspect-left-column">${formSection}</div>
                <div class="inspect-right-column">${infoSection}</div>
            </div>
        `;

        const modal = ModalUtils.createModal('inspectModal', {
            title: 'Inspect Inventory Item',
            className: 'modal-base inspect-modal',
            body: modalBody,
            buttons: [
                { id: 'cancelInspectBtn', text: 'Cancel', className: 'inspect-btn-secondary' },
                { id: 'executeInspectBtn', text: 'Complete Inspection', className: 'inspect-btn-primary', disabled: false }
            ]
        });

        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelInspectBtn'],
            executeHandler: {
                id: 'executeInspectBtn',
                handler: async () => {
                    let passed = 0, rejected = 0;
                    if (isSerialized) {
                        const result = document.querySelector('input[name="inspectionResult"]:checked').value;
                        passed = result === 'passed' ? inventoryData.quantity : 0;
                        rejected = result === 'rejected' ? inventoryData.quantity : 0;
                    } else {
                        passed = parseInt(document.getElementById('passedQuantity').value) || 0;
                        rejected = parseInt(document.getElementById('rejectedQuantity').value) || 0;
                        if (passed + rejected !== inventoryData.quantity) {
                            document.getElementById('inspectQuantityError').textContent = 'Passed + Rejected must equal total quantity.';
                            return;
                        }
                    }
                    // Update inventory status in Supabase
                    if (passed === inventoryData.quantity) {
                        await supabase.from('inventory').update({ status_id: await ModalUtils.getStatusId('Available') }).eq('id', inventoryId);
                    } else if (rejected === inventoryData.quantity) {
                        await supabase.from('inventory').update({ status_id: await ModalUtils.getStatusId('Rejected') }).eq('id', inventoryId);
                    } else {
                        // Partial: update original, insert rejected
                        await supabase.from('inventory').update({ quantity: passed }).eq('id', inventoryId);
                        await supabase.from('inventory').insert([{
                            ...inventoryData,
                            id: undefined,
                            quantity: rejected,
                            status_id: await ModalUtils.getStatusId('Rejected')
                        }]);
                    }
                    await ModalUtils.handleSuccess('inspectModal', 'Inspection completed.');
                }
            }
        });
    } catch (error) {
        ModalUtils.handleError(error, 'showing inspect modal');
    }
}

/**
 * Setup validation for the inspect modal (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
function setupInspectValidation(inventoryData, isSerializedItem) {
    const executeBtn = document.getElementById('executeInspectBtn');
    if (!isSerializedItem) {
        const passedInput = document.getElementById('passedQuantity');
        const rejectedInput = document.getElementById('rejectedQuantity');
        const errorElement = document.getElementById('inspectQuantityError');
        function validate() {
            const passed = parseInt(passedInput.value) || 0;
            const rejected = parseInt(rejectedInput.value) || 0;
            if (passed < 0 || rejected < 0) {
                errorElement.textContent = 'Quantities cannot be negative';
                errorElement.style.display = 'block';
                executeBtn.disabled = true;
            } else if (passed + rejected !== inventoryData.quantity) {
                errorElement.textContent = 'Passed + Rejected must equal total quantity.';
                errorElement.style.display = 'block';
                executeBtn.disabled = true;
            } else {
                errorElement.textContent = '';
                errorElement.style.display = 'none';
                executeBtn.disabled = false;
            }
        }
        passedInput.addEventListener('input', validate);
        rejectedInput.addEventListener('input', validate);
        validate();
    } else {
        executeBtn.disabled = false;
    }
}

/**
 * Execute inspection operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
async function executeInspectOperation(inventoryId, inventoryData, isSerializedItem) {
    try {
        let passed = 0, rejected = 0;
        if (isSerializedItem) {
            const result = document.querySelector('input[name="inspectionResult"]:checked').value;
            passed = result === 'passed' ? inventoryData.quantity : 0;
            rejected = result === 'rejected' ? inventoryData.quantity : 0;
        } else {
            passed = parseInt(document.getElementById('passedQuantity').value) || 0;
            rejected = parseInt(document.getElementById('rejectedQuantity').value) || 0;
        }
        const totalInspected = passed + rejected;
        if (totalInspected > inventoryData.quantity) {
            ModalUtils.handleError('Total inspected quantity cannot exceed available quantity');
            return;
        }
        if (totalInspected === 0) {
            ModalUtils.handleError('You must inspect at least some quantity');
            return;
        }

        const availableStatusId = await ModalUtils.getStatusId('Available');
        const rejectedStatusId = await ModalUtils.getStatusId('Rejected');

        // Track new record IDs for logging
        let passedRecordId = null, rejectedRecordId = null;

        // Process passed units
        if (passed > 0) {
            if (passed === inventoryData.quantity) {
                await supabase.from('inventory').update({ status_id: availableStatusId }).eq('id', inventoryId);
                if (window.transactionLogger) {
                    await window.transactionLogger.logInventoryUpdated(
                        inventoryId,
                        { status_name: inventoryData.status_name },
                        { status_name: 'Available' },
                        ['Inspection: Item passed']
                    );
                }
            } else {
                const { data, error } = await supabase.from('inventory').insert([{
                    ...inventoryData,
                    id: undefined,
                    quantity: passed,
                    status_id: availableStatusId
                }]).select('id').single();
                passedRecordId = data?.id;
                if (window.transactionLogger && passedRecordId) {
                    await window.transactionLogger.logInventoryCreated(passedRecordId, {
                        ...inventoryData,
                        quantity: passed,
                        status_id: availableStatusId
                    });
                }
            }
        }

        // Process rejected units
        if (rejected > 0) {
            if (rejected === inventoryData.quantity && passed === 0) {
                await supabase.from('inventory').update({ status_id: rejectedStatusId }).eq('id', inventoryId);
                if (window.transactionLogger) {
                    await window.transactionLogger.logInventoryUpdated(
                        inventoryId,
                        { status_name: inventoryData.status_name },
                        { status_name: 'Rejected' },
                        ['Inspection: Item rejected']
                    );
                }
            } else {
                const { data, error } = await supabase.from('inventory').insert([{
                    ...inventoryData,
                    id: undefined,
                    quantity: rejected,
                    status_id: rejectedStatusId
                }]).select('id').single();
                rejectedRecordId = data?.id;
                if (window.transactionLogger && rejectedRecordId) {
                    await window.transactionLogger.logInventoryCreated(rejectedRecordId, {
                        ...inventoryData,
                        quantity: rejected,
                        status_id: rejectedStatusId
                    });
                }
            }
        }

        // Handle remaining uninspected quantity
        const uninspected = inventoryData.quantity - totalInspected;
        if (uninspected > 0) {
            await supabase.from('inventory').update({ quantity: uninspected }).eq('id', inventoryId);
            if (window.transactionLogger) {
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    uninspected,
                    `Inspection: ${totalInspected} units inspected (${passed} passed, ${rejected} rejected)`
                );
            }
        } else if (passed > 0 && rejected > 0) {
            await supabase.from('inventory').delete().eq('id', inventoryId);
            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    inventoryData,
                    null,
                    [`Inspection: Item fully split into passed (${passed}) and rejected (${rejected}) units`]
                );
            }
        }

        await ModalUtils.handleSuccess('inspectModal');
    } catch (error) {
        ModalUtils.handleError(error, 'inspection operation');
    }
}

// ============================================================================
// RESERVE MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the reserve modal for an inventory item (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showReserveModal(inventoryId) {
    try {
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Could not load inventory item data');

        // Determine if item is serialized
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        // Get available crews
        const crews = await ModalUtils.getAllCrews();
        if (!crews.length) return ModalUtils.handleError('No crews available for reservation.');

        const crewOptions = ModalUtils.generateDropdownOptions(crews, 'Select a crew...');
        const formSection = `
            <div class="reserve-form-section">
                <h4>Reservation Details</h4>
                <div class="modal-form-group">
                    <label for="reserveToCrew"><strong>Reserve to Crew:</strong></label>
                    <select id="reserveToCrew" required>${crewOptions}</select>
                </div>
                <div class="modal-form-group">
                    <label for="reserveQuantity"><strong>Quantity to Reserve:</strong></label>
                    <input type="number" id="reserveQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" ${isSerializedItem ? 'disabled' : ''} required>
                    <div class="quantity-info">Available: ${inventoryData.quantity} | <span id="remainingAfterReserve">Remaining: 0</span></div>
                    ${isSerializedItem ? '<div class="serialized-notice"><strong>Serialized Item:</strong> Must be reserved as complete unit</div>' : ''}
                    <div class="error-message" id="reserveQuantityError"></div>
                </div>
                <div class="reserve-warning">
                    <strong>Note:</strong> This will reserve the item(s) for the selected crew.
                    ${!isSerializedItem ? ' Partial quantities are allowed for bulk items.' : ' The entire item will be reserved.'}
                </div>
            </div>
        `;
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Available Quantity');
        const modalBody = `
            <div class="reserve-two-column">
                <div class="reserve-left-column">${formSection}</div>
                <div class="reserve-right-column">${infoSection}</div>
            </div>
        `;

        const modal = ModalUtils.createModal('reserveModal', {
            title: 'Reserve Inventory Item',
            className: 'modal-base reserve-modal',
            body: modalBody,
            buttons: [
                { id: 'cancelReserveBtn', text: 'Cancel', className: 'reserve-cancel-button' },
                { id: 'executeReserveBtn', text: 'Reserve', className: 'reserve-button', disabled: true }
            ]
        });

        // Validation
        const crewSelect = document.getElementById('reserveToCrew');
        const quantityInput = document.getElementById('reserveQuantity');
        const executeBtn = document.getElementById('executeReserveBtn');
        const errorElement = document.getElementById('reserveQuantityError');
        function validate() {
            const qty = parseInt(quantityInput.value) || 0;
            const valid = crewSelect.value && qty > 0 && qty <= inventoryData.quantity;
            errorElement.textContent = !crewSelect.value ? 'Select a crew.' : (qty <= 0 ? 'Quantity must be > 0.' : (qty > inventoryData.quantity ? 'Cannot reserve more than available.' : ''));
            errorElement.style.display = errorElement.textContent ? 'block' : 'none';
            document.getElementById('remainingAfterReserve').textContent = `Remaining: ${inventoryData.quantity - qty}`;
            executeBtn.disabled = !valid;
        }
        crewSelect.addEventListener('change', validate);
        if (!isSerializedItem) quantityInput.addEventListener('input', validate);
        validate();

        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelReserveBtn'],
            executeHandler: {
                id: 'executeReserveBtn',
                handler: async () => {
                    const crewId = crewSelect.value;
                    const reserveQty = isSerializedItem ? inventoryData.quantity : parseInt(quantityInput.value);
                    const reservedStatusId = await ModalUtils.getStatusId('Reserved');
                    if (reserveQty === inventoryData.quantity) {
                        await supabase.from('inventory').update({ assigned_crew_id: crewId, status_id: reservedStatusId }).eq('id', inventoryId);
                        if (window.transactionLogger) {
                            await window.transactionLogger.logInventoryUpdated(
                                inventoryId,
                                { assigned_crew_id: inventoryData.assigned_crew_id, status_name: inventoryData.status_name },
                                { assigned_crew_id: crewId, status_name: 'Reserved' },
                                [`Reserved ${reserveQty} units to crew`]
                            );
                        }
                    } else {
                        await supabase.from('inventory').update({ quantity: inventoryData.quantity - reserveQty }).eq('id', inventoryId);
                        const { data } = await supabase.from('inventory').insert([{
                            ...inventoryData,
                            id: undefined,
                            assigned_crew_id: crewId,
                            quantity: reserveQty,
                            status_id: reservedStatusId
                        }]).select('id').single();
                        if (window.transactionLogger) {
                            if (data?.id) {
                                await window.transactionLogger.logInventoryCreated(data.id, {
                                    ...inventoryData,
                                    assigned_crew_id: crewId,
                                    quantity: reserveQty,
                                    status_id: reservedStatusId
                                });
                            }
                            await window.transactionLogger.logQuantityAdjusted(
                                inventoryId,
                                inventoryData.quantity,
                                inventoryData.quantity - reserveQty,
                                `Partial reservation: ${reserveQty} units reserved to crew`
                            );
                        }
                    }
                    await ModalUtils.handleSuccess('reserveModal');
                }
            }
        });
    } catch (error) {
        ModalUtils.handleError(error, 'showing reserve modal');
    }
}



/**
 * Setup validation for the reserve modal (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
function setupReserveValidation(inventoryData, isSerializedItem) {
    const crewSelect = document.getElementById('reserveToCrew');
    const quantityInput = document.getElementById('reserveQuantity');
    const executeBtn = document.getElementById('executeReserveBtn');
    const errorElement = document.getElementById('reserveQuantityError');
    const remainingSpan = document.getElementById('remainingAfterReserve');

    function validate() {
        const qty = isSerializedItem ? inventoryData.quantity : (parseInt(quantityInput.value) || 0);
        const remaining = inventoryData.quantity - qty;
        let isValid = true;
        let errorMsg = '';

        if (!crewSelect.value) {
            errorMsg = 'Please select a crew';
            isValid = false;
        } else if (qty <= 0) {
            errorMsg = 'Quantity must be greater than 0';
            isValid = false;
        } else if (qty > inventoryData.quantity) {
            errorMsg = 'Cannot reserve more than available quantity';
            isValid = false;
        }

        if (remainingSpan) remainingSpan.textContent = `Remaining: ${remaining}`;
        errorElement.textContent = errorMsg;
        errorElement.style.display = errorMsg ? 'block' : 'none';
        executeBtn.disabled = !isValid;
    }

    crewSelect.addEventListener('change', validate);
    if (!isSerializedItem) quantityInput.addEventListener('input', validate);
    validate();
}

/**
 * Execute reserve operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
async function executeReserveOperation(inventoryId, inventoryData, isSerializedItem) {
    try {
        const crewId = document.getElementById('reserveToCrew').value;
        const reserveQuantity = isSerializedItem
            ? inventoryData.quantity
            : parseInt(document.getElementById('reserveQuantity').value);
        const currentQuantity = parseInt(inventoryData.quantity);

        if (!crewId || !reserveQuantity || reserveQuantity < 1 || reserveQuantity > currentQuantity) {
            ModalUtils.handleError('Please select a crew and enter a valid quantity');
            return;
        }

        const reservedStatusId = await ModalUtils.getStatusId('Reserved');
        let newRecordId = null;

        if (reserveQuantity === currentQuantity) {
            // Full reservation - update existing record
            await supabase.from('inventory').update({
                assigned_crew_id: crewId,
                status_id: reservedStatusId
            }).eq('id', inventoryId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    { assigned_crew_id: inventoryData.assigned_crew_id, status_name: inventoryData.status_name },
                    { assigned_crew_id: crewId, status_name: 'Reserved' },
                    [`Reserved ${reserveQuantity} units to crew`]
                );
            }
        } else {
            // Partial reservation - create new record and update existing
            await supabase.from('inventory').update({
                quantity: currentQuantity - reserveQuantity
            }).eq('id', inventoryId);

            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                assigned_crew_id: crewId,
                quantity: reserveQuantity,
                status_id: reservedStatusId
            }]).select('id').single();
            newRecordId = data?.id;

            if (window.transactionLogger) {
                if (newRecordId) {
                    await window.transactionLogger.logInventoryCreated(newRecordId, {
                        ...inventoryData,
                        assigned_crew_id: crewId,
                        quantity: reserveQuantity,
                        status_id: reservedStatusId
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    currentQuantity,
                    currentQuantity - reserveQuantity,
                    `Partial reservation: ${reserveQuantity} units reserved to crew`
                );
            }
        }

        await ModalUtils.handleSuccess('reserveModal');
    } catch (error) {
        ModalUtils.handleError(error, 'reserve operation');
    }
}

/**
 * Show unreserve modal for removing crew assignments from reserved items (Supabase version, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showUnreserveModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) return ModalUtils.handleError('No item selected for unreserve.');

        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Selected item not found in database.');

        if (!inventoryData.assigned_crew_id) {
            return ModalUtils.handleError('This item is not assigned to any crew. No unreservation needed.');
        }

        const crewName = await ModalUtils.getCrewName(inventoryData.assigned_crew_id);
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Current Quantity');
        const formSection = `
            <div class="unreserve-form-section">
                <h4>Unreservation Details</h4>
                <input type="hidden" id="unreserveItemId" value="${inventoryData.id}">
                <div id="unreserveQuantitySection" style="${isSerializedItem ? 'display: none;' : 'display: block;'}">
                    <div class="modal-form-group">
                        <label for="unreserveQuantityInput">Quantity to Unreserve:</label>
                        <input type="number" id="unreserveQuantityInput" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}">
                        <span class="quantity-info">Max: <span id="unreserveMaxQuantity">${inventoryData.quantity}</span></span>
                    </div>
                </div>
                <div id="unreserveSerialNotice" style="${isSerializedItem ? 'display: block;' : 'display: none;'}" class="serialized-notice">
                    <strong>Serialized Item:</strong> All ${inventoryData.quantity} units will be unreserved
                </div>
                <div class="modal-warning-section">
                    <div class="modal-warning">
                        <strong>Warning:</strong> This will remove the crew assignment from the specified quantity.
                        ${isSerializedItem ? 'The entire serialized item will be unreserved.' : 'If partial quantity, a new record will be created for the unreserved portion.'}
                    </div>
                </div>
            </div>
        `;
        const twoColumnBody = `
            <div class="unreserve-two-column">
                <div class="unreserve-left-column">${formSection}</div>
                <div class="unreserve-right-column">${infoSection}</div>
            </div>
        `;
        const modal = ModalUtils.createModal('unreserveModal', {
            title: 'Unreserve Inventory Item',
            className: 'modal-base unreserve-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelUnreserveBtn', text: 'Cancel', className: 'unreserve-btn-secondary' },
                { id: 'executeUnreserveBtn', text: 'Unreserve', className: 'unreserve-btn-primary', disabled: true }
            ]
        });

        // Validation
        const executeBtn = document.getElementById('executeUnreserveBtn');
        if (!isSerializedItem) {
            const quantityInput = document.getElementById('unreserveQuantityInput');
            function validate() {
                const qty = parseInt(quantityInput.value) || 0;
                executeBtn.disabled = qty < 1 || qty > inventoryData.quantity;
            }
            quantityInput.addEventListener('input', validate);
            validate();
        } else {
            executeBtn.disabled = false;
        }

        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelUnreserveBtn'],
            executeHandler: {
                id: 'executeUnreserveBtn',
                handler: async () => {
                    const unreserveQty = isSerializedItem
                        ? inventoryData.quantity
                        : parseInt(document.getElementById('unreserveQuantityInput').value);

                    if (!unreserveQty || unreserveQty < 1 || unreserveQty > inventoryData.quantity) {
                        ModalUtils.handleError('Please enter a valid quantity to unreserve.');
                        return;
                    }

                    const availableStatusId = await ModalUtils.getStatusId('Available');
                    if (unreserveQty === inventoryData.quantity) {
                        // Full unreserve
                        await supabase.from('inventory').update({
                            assigned_crew_id: null,
                            status_id: availableStatusId
                        }).eq('id', inventoryId);
                        if (window.transactionLogger) {
                            await window.transactionLogger.logInventoryUpdated(
                                inventoryId,
                                { ...inventoryData },
                                { ...inventoryData, assigned_crew_id: null, status_id: availableStatusId },
                                [`Unreserved all units from crew: ${crewName}`]
                            );
                        }
                    } else {
                        // Partial unreserve
                        await supabase.from('inventory').update({
                            quantity: unreserveQty
                        }).eq('id', inventoryId);
                        const { data } = await supabase.from('inventory').insert([{
                            ...inventoryData,
                            id: undefined,
                            assigned_crew_id: null,
                            quantity: inventoryData.quantity - unreserveQty,
                            status_id: availableStatusId
                        }]).select('id').single();
                        if (window.transactionLogger) {
                            if (data?.id) {
                                await window.transactionLogger.logInventoryCreated(data.id, {
                                    ...inventoryData,
                                    assigned_crew_id: null,
                                    quantity: inventoryData.quantity - unreserveQty,
                                    status_id: availableStatusId
                                });
                            }
                            await window.transactionLogger.logQuantityAdjusted(
                                inventoryId,
                                inventoryData.quantity,
                                unreserveQty,
                                `Partial unreserve: ${inventoryData.quantity - unreserveQty} units returned to available`
                            );
                        }
                    }
                    await ModalUtils.handleSuccess('unreserveModal');
                }
            }
        });
    } catch (error) {
        ModalUtils.handleError(error, 'showing unreserve modal');
    }
}

/**
 * Setup validation for the unreserve modal (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
function setupUnreserveValidation(inventoryData, isSerializedItem) {
    const executeBtn = document.getElementById('executeUnreserveBtn');
    if (!isSerializedItem) {
        const quantityInput = document.getElementById('unreserveQuantityInput');
        ModalUtils.setupQuantityAutoSelect('unreserveQuantityInput');
        function validate() {
            const qty = parseInt(quantityInput.value) || 0;
            executeBtn.disabled = qty < 1 || qty > inventoryData.quantity;
        }
        quantityInput.addEventListener('input', validate);
        validate();
    } else {
        executeBtn.disabled = false;
    }
}

/**
 * Execute the unreserve operation (Supabase version, includes transaction logging)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
async function executeUnreserveOperation(inventoryData, isSerializedItem) {
    try {
        const itemId = inventoryData.id;
        const currentQuantity = inventoryData.quantity;
        const currentCrewId = inventoryData.assigned_crew_id;

        let unreserveQuantity = isSerializedItem
            ? currentQuantity
            : parseInt(document.getElementById('unreserveQuantityInput').value);

        if (!unreserveQuantity || unreserveQuantity < 1 || unreserveQuantity > currentQuantity) {
            ModalUtils.handleError('Please enter a valid quantity to unreserve.');
            return;
        }

        const availableStatusId = await ModalUtils.getStatusId('Available');
        const crewName = await ModalUtils.getCrewName(currentCrewId);

        if (unreserveQuantity === currentQuantity) {
            // Full unreserve
            await supabase.from('inventory').update({
                assigned_crew_id: null,
                status_id: availableStatusId
            }).eq('id', itemId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    itemId,
                    { ...inventoryData },
                    { ...inventoryData, assigned_crew_id: null, status_id: availableStatusId },
                    [`Unreserved all units from crew: ${crewName}`]
                );
            }
        } else {
            // Partial unreserve
            await supabase.from('inventory').update({
                quantity: unreserveQuantity
            }).eq('id', itemId);

            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                assigned_crew_id: null,
                quantity: currentQuantity - unreserveQuantity,
                status_id: availableStatusId
            }]).select('id').single();

            if (window.transactionLogger) {
                if (data?.id) {
                    await window.transactionLogger.logInventoryCreated(data.id, {
                        ...inventoryData,
                        assigned_crew_id: null,
                        quantity: currentQuantity - unreserveQuantity,
                        status_id: availableStatusId
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    itemId,
                    currentQuantity,
                    unreserveQuantity,
                    `Partial unreserve: ${currentQuantity - unreserveQuantity} units returned to available`
                );
            }
        }

        await ModalUtils.handleSuccess('unreserveModal');
    } catch (error) {
        ModalUtils.handleError(error, 'unreserve operation');
    }
}

/**
 * Show the issue modal for issuing reserved items to crews (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showIssueModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) return ModalUtils.handleError('No item selected for issue.');

        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Selected item not found in database.');

        // Determine if item is serialized
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        // Get available crews and DFNs
        const crews = await ModalUtils.getAllCrews();
        const { data: dfns } = await supabase
            .from('dfns')
            .select('id, name')
            .eq('sloc_id', window.selectedSlocId)
            .order('name');
        if (!crews.length) return ModalUtils.handleError('No crews available for issue.');

        // Generate dropdown options
        const crewOptions = ModalUtils.generateDropdownOptions(crews, 'Select a crew...');
        const dfnOptions = ModalUtils.generateDropdownOptions(dfns || [], 'Select a DFN...');

        // Receipt number
        const receiptNum = await getReceiptNumber();
        const receiptString = "IS-" + String(receiptNum).padStart(6, '0');

        // Form section
        const formSection = `
            <div class="issue-form-section">
                <h4>Issue Details</h4>
                <div class="modal-form-group">
                    <label><strong>Receipt Number:</strong></label>
                    <div class="receipt-info">${receiptString}</div>
                </div>
                <input type="hidden" id="issueItemId" value="${inventoryData.id}">
                ${!isSerializedItem ? `
                    <div class="modal-form-group">
                        <label for="issueQuantityInput"><strong>Quantity to Issue:</strong></label>
                        <input type="number" id="issueQuantityInput" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}">
                        <div class="quantity-info">
                            Available: ${inventoryData.quantity} | <span id="remainingAfterIssue">Remaining: 0</span>
                            <div id="issueQuantityError" class="error-message" style="display: none;"></div>
                        </div>
                    </div>
                ` : `
                    <div class="modal-form-group">
                        <div class="serialized-notice">
                            <strong>Serialized Item:</strong> All ${inventoryData.quantity} units will be issued
                        </div>
                    </div>
                `}
                <div class="modal-form-group">
                    <label for="crewSelect"><strong>Crew:</strong></label>
                    <select id="crewSelect">${crewOptions}</select>
                    <label for="dfnSelect"><strong>DFN:</strong></label>
                    <select id="dfnSelect">${dfnOptions}</select>
                    <label for="issueNotesInput"><strong>Issue Notes (Optional):</strong></label>
                    <textarea id="issueNotesInput" rows="3" placeholder="Enter any notes about this issue"></textarea>
                </div>
                <div class="issue-warning">
                    <strong>Important:</strong> Issuing items removes them from inventory and marks them as "Issued" by the assigned crew.
                    ${isSerializedItem ? ' Serialized items must be issued in full.' : ' If partial quantity, remaining items will stay reserved to the crew.'}
                </div>
            </div>
        `;

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Reserved Quantity');
        const modalBody = `
            <div class="issue-two-column">
                <div class="issue-left-column">${formSection}</div>
                <div class="issue-right-column">
                    ${infoSection}
                    <div id="issue-extra-fields" style="margin-top:16px;">
                        <label for="issue-signer-name"><strong>Name:</strong></label><br>
                        <input type="text" id="issue-signer-name" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your name"><br>
                        <label for="issue-email"><strong>Email:</strong></label><br>
                        <input type="email" id="issue-email" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your email"><br>
                        <label for="issue-comments"><strong>Comments:</strong></label><br>
                        <textarea id="issue-comments" rows="2" style="width: 95%; margin-bottom: 8px;" placeholder="Enter any comments..."></textarea>
                    </div>
                    <div id="issue-signature-area" style="margin-top:10px;">
                        <label for="issue-signature-pad"><strong>Signature:</strong></label><br>
                        <canvas id="issue-signature-pad" width="300" height="80" style="border:1px solid #ccc;"></canvas><br>
                        <button type="button" id="issue-clear-signature">Clear Signature</button>
                    </div>
                </div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('issueModal', {
            title: 'Issue Inventory Item',
            className: 'modal-base issue-modal',
            body: modalBody,
            buttons: [
                { id: 'cancelIssueBtn', text: 'Cancel', className: 'issue-btn-secondary' },
                { id: 'executeIssueBtn', text: 'Issue Items', className: 'issue-btn-primary', disabled: true },
                { id: 'downloadIssuePDFBtn', text: 'Download PDF', className: 'issue-btn-secondary' }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelIssueBtn'],
            executeHandler: {
                id: 'executeIssueBtn',
                handler: () => executeIssueOperation(inventoryData, isSerializedItem)
            },
            customHandlers: [
                { id: 'downloadIssuePDFBtn', handler: downloadIssuePDF }
            ]
        });

        // Setup auto-select for quantity input (for non-serialized items)
        if (!isSerializedItem) ModalUtils.setupQuantityAutoSelect('issueQuantityInput');

        // Setup validation and signature pad
        setTimeout(() => {
            setupIssueValidation(inventoryData, isSerializedItem);
            const canvas = document.getElementById('issue-signature-pad');
            if (canvas) {
                window.issueSignaturePad = new window.SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
                document.getElementById('issue-clear-signature').onclick = () => window.issueSignaturePad.clear();
            }
        }, 0);

    } catch (error) {
        ModalUtils.handleError(error, 'showing issue modal');
    }
}

/**
 * Setup validation for the issue modal (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
function setupIssueValidation(inventoryData, isSerializedItem) {
    const crewSelect = document.getElementById('crewSelect');
    const dfnSelect = document.getElementById('dfnSelect');
    const executeBtn = document.getElementById('executeIssueBtn');
    const quantityInput = document.getElementById('issueQuantityInput');
    const errorElement = document.getElementById('issueQuantityError');
    const remainingSpan = document.getElementById('remainingAfterIssue');

    function validate() {
        let isValid = true;
        let errorMsg = '';
        let quantity = isSerializedItem ? inventoryData.quantity : (parseInt(quantityInput?.value) || 0);

        if (!crewSelect.value) {
            errorMsg += 'Select a crew to issue to. ';
            isValid = false;
        }
        if (!dfnSelect.value) {
            errorMsg += 'Select a DFN to issue to. ';
            isValid = false;
        }
        if (!isSerializedItem) {
            if (quantity <= 0) {
                errorMsg += 'Quantity must be greater than 0. ';
                isValid = false;
            } else if (quantity > inventoryData.quantity) {
                errorMsg += 'Cannot issue more than available quantity. ';
                isValid = false;
            }
            if (remainingSpan) remainingSpan.textContent = `Remaining: ${inventoryData.quantity - quantity}`;
        }
        if (errorElement) {
            errorElement.textContent = errorMsg;
            errorElement.style.display = errorMsg ? 'block' : 'none';
        }
        executeBtn.disabled = !isValid;
    }

    crewSelect.addEventListener('change', validate);
    dfnSelect.addEventListener('change', validate);
    if (!isSerializedItem && quantityInput) quantityInput.addEventListener('input', validate);

    validate();
}

/**
 * Update validation for the issue modal (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
function updateIssueValidation(inventoryData, isSerializedItem) {
    const crewSelect = document.getElementById('crewSelect');
    const dfnSelect = document.getElementById('dfnSelect');
    const executeBtn = document.getElementById('executeIssueBtn');
    const quantityInput = document.getElementById('issueQuantityInput');
    const errorElement = document.getElementById('issueQuantityError');
    const remainingSpan = document.getElementById('remainingAfterIssue');

    let isValid = true;
    let errorMsg = '';
    let quantity = isSerializedItem ? inventoryData.quantity : (parseInt(quantityInput?.value) || 0);

    if (!crewSelect.value) {
        errorMsg += 'Select a crew to issue to. ';
        isValid = false;
    }
    if (!dfnSelect.value) {
        errorMsg += 'Select a DFN to issue to. ';
        isValid = false;
    }
    if (!isSerializedItem) {
        if (quantity <= 0) {
            errorMsg += 'Quantity must be greater than 0. ';
            isValid = false;
        } else if (quantity > inventoryData.quantity) {
            errorMsg += 'Cannot issue more than available quantity. ';
            isValid = false;
        }
        if (remainingSpan) remainingSpan.textContent = `Remaining: ${inventoryData.quantity - quantity}`;
    }
    if (errorElement) {
        errorElement.textContent = errorMsg;
        errorElement.style.display = errorMsg ? 'block' : 'none';
    }
    executeBtn.disabled = !isValid;
}

/**
 * Execute the issue operation (Supabase version, includes transaction logging)
 * Ensures only valid inventory columns are inserted for partial issues.
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 */
async function executeIssueOperation(inventoryData, isSerializedItem) {
    try {
        const itemId = inventoryData.id;
        const crewId = document.getElementById('crewSelect').value;
        const dfnId = document.getElementById('dfnSelect').value;
        const issueNotes = document.getElementById('issueNotesInput').value.trim();
        const currentQuantity = inventoryData.quantity;

        let issueQuantity = isSerializedItem
            ? currentQuantity
            : parseInt(document.getElementById('issueQuantityInput').value);

        if (!crewId || !dfnId || !issueQuantity || issueQuantity < 1 || issueQuantity > currentQuantity) {
            ModalUtils.handleError('Please select a crew, DFN, and enter a valid quantity to issue.');
            return;
        }

        const issuedStatusId = await ModalUtils.getStatusId('Issued');
        // Use cached "With Crew" location
        const withCrewLocationRow = getCachedRowByField('locations', 'name', 'With Crew');
        const withCrewLocationId = withCrewLocationRow?.id;

        let newIssuedRecordId = null;

        if (issueQuantity === currentQuantity) {
            // Full issue: update status/location/crew/dfn
            await supabase.from('inventory').update({
                status_id: issuedStatusId,
                location_id: withCrewLocationId,
                assigned_crew_id: crewId,
                dfn_id: dfnId
            }).eq('id', itemId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    itemId,
                    {
                        quantity: currentQuantity,
                        status_name: inventoryData.status_name,
                        assigned_crew_id: inventoryData.assigned_crew_id,
                        dfn_id: inventoryData.dfn_id
                    },
                    {
                        quantity: currentQuantity,
                        status_name: 'Issued',
                        location_name: 'With Crew',
                        assigned_crew_id: crewId,
                        dfn_id: dfnId,
                        issue_notes: issueNotes
                    },
                    ['Full issue to crew']
                );
            }
        } else {
            // Partial issue: update original, insert new issued record
            await supabase.from('inventory').update({
                quantity: currentQuantity - issueQuantity
            }).eq('id', itemId);

            // Only include valid inventory columns for insert
            const safeInt = v => v === null || v === undefined ? null : parseInt(v, 10);
            
            const {
                id, item_name, status_name, location_name, crew_name,
                item_types, statuses, locations, crews,
                ...rawInsertData
            } = inventoryData;
            
            const insertData = {
                item_type_id: safeInt(inventoryData.item_type_id),
                location_id: safeInt(withCrewLocationId),
                assigned_crew_id: safeInt(crewId),
                dfn_id: safeInt(dfnId),
                mfgrsn: inventoryData.mfgrsn,
                tilsonsn: inventoryData.tilsonsn,
                quantity: issueQuantity,
                status_id: safeInt(issuedStatusId),
                sloc_id: safeInt(inventoryData.sloc_id),
                // ...any other actual inventory columns
            };
            
            const { data } = await supabase.from('inventory').insert([insertData]).select('id').single();
            newIssuedRecordId = data?.id;

            if (window.transactionLogger) {
                if (newIssuedRecordId) {
                    await window.transactionLogger.logInventoryCreated(newIssuedRecordId, {
                        ...insertData,
                        quantity: issueQuantity,
                        status_id: issuedStatusId,
                        location_id: withCrewLocationId,
                        assigned_crew_id: crewId,
                        dfn_id: dfnId,
                        issue_notes: issueNotes
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    itemId,
                    currentQuantity,
                    currentQuantity - issueQuantity,
                    `Partial issue: ${issueQuantity} units issued to crew`
                );
            }
        }

        // Increment receipt number for next issue
        await setReceiptNumber(await getReceiptNumber() + 1);

        await ModalUtils.handleSuccess('issueModal');
    } catch (error) {
        ModalUtils.handleError(error, 'issue operation');
    }
}

// ============================================================================
// REJECT MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the reject modal for an inventory item (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showRejectModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) return ModalUtils.handleError('No item selected for rejection.');

        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Inventory item not found.');

        const isBulk = (inventoryData.inventory_type || '').toLowerCase() === 'bulk';

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, !isBulk, 'Current Quantity');

        // Form section
        const formSection = `
            <div class="reject-form-section">
                <h4>Rejection Details</h4>
                ${isBulk ? `
                    <div class="modal-form-group">
                        <label for="rejectQuantity">Quantity to Reject:</label>
                        <input type="number" id="rejectQuantity" min="1" max="${inventoryData.quantity}" value="1" class="quantity-input">
                        <span class="quantity-info">of ${inventoryData.quantity} available</span>
                        <div class="quantity-preview">
                            <strong>Remaining after rejection: <span id="remainingQuantity">${inventoryData.quantity - 1}</span></strong>
                        </div>
                    </div>
                ` : `
                    <div class="modal-form-group">
                        <p><strong>This will reject the entire serialized item.</strong></p>
                    </div>
                `}
                <div class="modal-form-group">
                    <label for="rejectReason">Reason for Rejection:</label>
                    <textarea id="rejectReason" rows="3" placeholder="Enter reason for rejection..." class="reason-textarea"></textarea>
                    <div class="error-message" id="rejectReasonError" style="display: none;"></div>
                </div>
            </div>
        `;

        // Two-column layout
        const twoColumnBody = `
            <div class="reject-two-column">
                <div class="reject-left-column">${formSection}</div>
                <div class="reject-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('rejectModal', {
            title: 'Reject Material',
            className: 'modal-base reject-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelRejectBtn', text: 'Cancel', className: 'cancel-button' },
                { id: 'executeRejectBtn', text: 'Reject Material', className: 'reject-button', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelRejectBtn'],
            executeHandler: {
                id: 'executeRejectBtn',
                handler: () => executeRejectOperation(inventoryId, inventoryData)
            }
        });

        // Notes validation
        ModalUtils.setupNotesValidation('rejectReason', 'executeRejectBtn', 'rejectReasonError');

        // Quantity validation for bulk items
        if (isBulk) {
            const quantityInput = document.getElementById('rejectQuantity');
            const remainingSpan = document.getElementById('remainingQuantity');
            const rejectButton = document.getElementById('executeRejectBtn');
            quantityInput.addEventListener('input', () => {
                const rejectQty = parseInt(quantityInput.value) || 0;
                const remaining = inventoryData.quantity - rejectQty;
                remainingSpan.textContent = remaining;
                rejectButton.disabled = rejectQty <= 0 || rejectQty > inventoryData.quantity;
                remainingSpan.style.color = (rejectQty <= 0 || rejectQty > inventoryData.quantity) ? 'red' : 'black';
            });
        }
    } catch (error) {
        ModalUtils.handleError(error, 'showing reject modal');
    }
}

/**
 * Setup quantity validation for bulk reject items (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory item data
 */
function setupRejectQuantityValidation(inventoryData) {
    const quantityInput = document.getElementById('rejectQuantity');
    const remainingSpan = document.getElementById('remainingQuantity');
    const rejectButton = document.getElementById('executeRejectBtn');

    function validate() {
        const rejectQty = parseInt(quantityInput.value) || 0;
        const remaining = inventoryData.quantity - rejectQty;
        remainingSpan.textContent = remaining;
        if (rejectQty <= 0 || rejectQty > inventoryData.quantity) {
            rejectButton.disabled = true;
            remainingSpan.style.color = 'red';
        } else {
            rejectButton.disabled = false;
            remainingSpan.style.color = 'black';
        }
    }

    quantityInput.addEventListener('input', validate);
    validate();
}

/**
 * Execute the reject operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Current inventory data
 */
async function executeRejectOperation(inventoryId, inventoryData) {
    try {
        const reasonTextarea = document.getElementById('rejectReason');
        const reason = reasonTextarea.value.trim();

        if (!reason) {
            ModalUtils.handleError('Please provide a reason for rejection');
            return;
        }

        const isBulk = (inventoryData.inventory_type || '').toLowerCase() === 'bulk';
        let rejectQuantity = inventoryData.quantity; // Default to full quantity for serialized

        if (isBulk) {
            const quantityInput = document.getElementById('rejectQuantity');
            rejectQuantity = parseInt(quantityInput.value);
            if (!rejectQuantity || rejectQuantity <= 0 || rejectQuantity > inventoryData.quantity) {
                ModalUtils.handleError('Please enter a valid quantity to reject');
                return;
            }
        }

        const rejectedStatusId = await ModalUtils.getStatusId('Rejected');
        let newRejectedRecordId = null;

        if (isBulk && rejectQuantity < inventoryData.quantity) {
            // Partial rejection for bulk items
            const newQuantity = inventoryData.quantity - rejectQuantity;
            // 1. Reduce quantity of original item
            await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryId);
            // 2. Create new rejected item (only include valid inventory table columns)
            const { data } = await supabase.from('inventory').insert([{
                item_type_id: inventoryData.item_type_id,
                location_id: inventoryData.location_id,
                assigned_crew_id: null, // Clear crew assignment for rejected items
                dfn_id: inventoryData.dfn_id,
                mfgrsn: inventoryData.mfgrsn,
                tilsonsn: inventoryData.tilsonsn,
                quantity: rejectQuantity,
                status_id: rejectedStatusId,
                sloc_id: inventoryData.sloc_id
            }]).select('id').single();
            newRejectedRecordId = data?.id;

            // Log transaction for partial rejection
            if (window.transactionLogger) {
                if (newRejectedRecordId) {
                    await window.transactionLogger.logInventoryCreated(newRejectedRecordId, {
                        item_type_id: inventoryData.item_type_id,
                        location_id: inventoryData.location_id,
                        assigned_crew_id: null,
                        dfn_id: inventoryData.dfn_id,
                        mfgrsn: inventoryData.mfgrsn,
                        tilsonsn: inventoryData.tilsonsn,
                        quantity: rejectQuantity,
                        status_id: rejectedStatusId,
                        sloc_id: inventoryData.sloc_id
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    newQuantity,
                    `Rejected ${rejectQuantity} units: ${reason}`
                );
            }
        } else {
            // Full rejection (serialized items or full bulk rejection)
            await supabase.from('inventory').update({
                status_id: rejectedStatusId,
                assigned_crew_id: null
            }).eq('id', inventoryId);

            // Log transaction for full rejection
            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    { status_name: inventoryData.status_name },
                    { status_name: 'Rejected', assigned_crew_id: null },
                    [`Rejected: ${reason}`]
                );
            }
        }

        await ModalUtils.handleSuccess('rejectModal');
    } catch (error) {
        ModalUtils.handleError(error, 'reject operation');
    }
}

// ============================================================================
// INSTALL MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the install modal for an inventory item (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showInstallModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) return ModalUtils.handleError('No item selected for install.');

        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Inventory item not found.');

        const isSerialized = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        // Get DFNs for dropdown
        const { data: dfns } = await supabase
            .from('dfns')
            .select('id, name')
            .eq('sloc_id', window.selectedSlocId)
            .order('name');

        // Form section
        const formSection = isSerialized
            ? `
                <div class="install-form-section">
                    <h4>Installation Details</h4>
                    <div class="modal-form-group">
                        <label for="installSerializedQuantity"><strong>Install Quantity:</strong></label>
                        <input type="number" id="installSerializedQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}">
                        <div class="quantity-info">Available: ${inventoryData.quantity}</div>
                    </div>
                    <div class="modal-form-group">
                        <label for="installDfnSelect"><strong>DFN:</strong></label>
                        <select id="installDfnSelect">${ModalUtils.generateDropdownOptions(dfns || [], 'Select DFN...')}</select>
                    </div>
                    <div class="modal-form-group">
                        <label for="installNotes"><strong>Installation Notes:</strong></label>
                        <textarea id="installNotes" rows="3" placeholder="Enter installation notes..."></textarea>
                    </div>
                    <div class="install-warning">
                        <strong>Note:</strong> All serialized units will be installed together.
                    </div>
                </div>
            `
            : `
                <div class="install-form-section">
                    <h4>Installation Details</h4>
                    <div class="modal-form-group">
                        <label for="installQuantity"><strong>Quantity to Install:</strong></label>
                        <input type="number" id="installQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}">
                        <div class="quantity-info">Available: ${inventoryData.quantity} | <span id="remainingInstall">Remaining: 0</span></div>
                    </div>
                    <div class="modal-form-group">
                        <label for="installNotes"><strong>Installation Notes:</strong></label>
                        <textarea id="installNotes" rows="3" placeholder="Enter installation notes..."></textarea>
                    </div>
                    <div class="install-warning">
                        <strong>Note:</strong> This will mark the selected quantity as installed.
                    </div>
                </div>
            `;

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerialized, 'Current Quantity');
        const modalBody = `
            <div class="install-two-column">
                <div class="install-left-column">${formSection}</div>
                <div class="install-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('installModal', {
            title: 'Install Inventory Item',
            className: 'modal-base install-modal',
            body: modalBody,
            buttons: [
                { id: 'cancelInstallBtn', text: 'Cancel', className: 'install-btn-secondary' },
                { id: 'executeInstallBtn', text: 'Install', className: 'install-btn-primary', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelInstallBtn'],
            executeHandler: {
                id: 'executeInstallBtn',
                handler: () => executeInstallOperation(inventoryId, inventoryData, isSerialized)
            }
        });

        // Setup validation
        setTimeout(() => {
            const dfnSelect = document.getElementById('installDfnSelect');
            if (dfnSelect && inventoryData.dfn_id) {
                dfnSelect.value = String(inventoryData.dfn_id);
            }
            if (isSerialized) {
                const qtyInput = document.getElementById('installSerializedQuantity');
                const dfnSelect = document.getElementById('installDfnSelect');
                const executeBtn = document.getElementById('executeInstallBtn');
                function validate() {
                    const qty = parseInt(qtyInput.value) || 0;
                    executeBtn.disabled = !dfnSelect.value || qty < 1 || qty > inventoryData.quantity;
                }
                qtyInput.addEventListener('input', validate);
                dfnSelect.addEventListener('change', validate);
                validate();
            } else {
                const qtyInput = document.getElementById('installQuantity');
                const executeBtn = document.getElementById('executeInstallBtn');
                const remainingSpan = document.getElementById('remainingInstall');
                function validate() {
                    const qty = parseInt(qtyInput.value) || 0;
                    if (remainingSpan) remainingSpan.textContent = inventoryData.quantity - qty;
                    executeBtn.disabled = qty < 1 || qty > inventoryData.quantity;
                }
                qtyInput.addEventListener('input', validate);
                validate();
            }
        }, 0);

    } catch (error) {
        ModalUtils.handleError(error, 'showing install modal');
    }
}

/**
 * Generate bulk install form (succinct, Supabase version)
 * @param {Object} inventoryData - Inventory data
 * @param {Array} dfns - Array of DFN objects for dropdown (optional)
 * @returns {string} HTML for bulk install form
 */
function generateBulkInstallForm(inventoryData, dfns = []) {
    const dfnOptions = dfns.length > 0
        ? ModalUtils.generateDropdownOptions(dfns, 'Select DFN...')
        : '<option value="">No DFNs available</option>';

    return `
        <div class="install-form-section">
            <h4>Installation Details</h4>
            <div class="modal-form-group">
                <label for="installQuantity"><strong>Quantity to Install:</strong></label>
                <input type="number" 
                       id="installQuantity" 
                       min="1" 
                       max="${inventoryData.quantity}" 
                       value="${inventoryData.quantity}" 
                       class="quantity-input">
                <div class="quantity-info">
                    Available: ${inventoryData.quantity} | 
                    <span id="remainingQuantity">Remaining: 0</span>
                </div>
            </div>
            <div class="modal-form-group">
                <label for="dfnSelect"><strong>DFN:</strong></label>
                <select id="dfnSelect" class="reason-input">
                    ${dfnOptions}
                </select>
            </div>
            <div class="modal-form-group">
                <label for="installNotes"><strong>Installation Notes:</strong></label>
                <textarea id="installNotes" 
                          rows="3" 
                          placeholder="Enter installation notes..."
                          class="reason-textarea"></textarea>
            </div>
            <div class="install-warning">
                <strong>Note:</strong> This will mark the selected quantity as installed.
            </div>
        </div>
    `;
}


/**
 * Generate serialized install form with allocation breakdown (Supabase version)
 * @param {Object} inventoryData - Inventory data
 * @param {Array} allocations - Allocation data
 * @param {Array} dfns - Array of DFN objects for dropdown (optional)
 * @returns {string} HTML for serialized install form
 */
function generateSerializedInstallForm(inventoryData, allocations = [], dfns = []) {
    // Use global/cached config for allocations if available
    const usingAllocations = window.useAllocations === true ||
        (getCachedTable('config').find(cfg => cfg.key === 'useAllocations')?.value === "YES");

    const dfnOptions = dfns.length > 0
        ? ModalUtils.generateDropdownOptions(dfns, 'Select DFN...')
        : '<option value="">No DFNs available</option>';

    if (usingAllocations && allocations && allocations.length > 0) {
        const allocationRows = allocations.map(allocation => `
            <tr class="allocation-row" data-dfn-id="${allocation.dfn_id}">
                <td class="dfn-name">${allocation.dfn_name}</td>
                <td class="allocated-qty">${allocation.allocated_quantity}</td>
                <td class="install-qty-cell">
                    <input type="number" 
                        class="install-allocation-input" 
                        data-dfn-id="${allocation.dfn_id}"
                        min="0" 
                        max="${allocation.remaining_quantity}" 
                        value="0"
                        ${allocation.remaining_quantity === 0 ? 'disabled' : ''}>
                </td>
                <td class="remaining-qty" id="remaining-${allocation.dfn_id}">${allocation.remaining_quantity}</td>
                <td class="installed-qty">${allocation.installed_quantity}</td>
            </tr>
        `).join('');
        return `
            <div class="install-form-section">
                <h4>Installation Details by Allocation</h4>
                <div class="allocation-install-container">
                    <table class="allocation-install-table">
                        <thead>
                            <tr>
                                <th>DFN</th>
                                <th>Allocated</th>
                                <th>Install Qty</th>
                                <th>Remaining</th>
                                <th>Previously Installed</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${allocationRows}
                        </tbody>
                        <tfoot>
                            <tr class="total-row">
                                <td><strong>Total:</strong></td>
                                <td id="totalAllocated">${allocations.reduce((sum, a) => sum + a.allocated_quantity, 0)}</td>
                                <td id="totalToInstall">0</td>
                                <td id="totalRemaining">${allocations.reduce((sum, a) => sum + a.remaining_quantity, 0)}</td>
                                <td id="totalInstalled">${allocations.reduce((sum, a) => sum + a.installed_quantity, 0)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                <div class="modal-form-group">
                    <label for="installNotes"><strong>Installation Notes:</strong></label>
                    <textarea id="installNotes" rows="3" placeholder="Enter installation notes..." class="reason-textarea"></textarea>
                </div>
                <div class="install-warning">
                    <strong>Note:</strong> This will update installation quantities for each allocation.
                </div>
            </div>
        `;
    } else {
        // Not using allocations or no allocations present
        return `
            <div class="install-form-section">
                <h4>Installation Details</h4>
                <div class="modal-form-group">
                    <label for="installSerializedQuantity"><strong>Install Quantity:</strong></label>
                    <input type="number" id="installSerializedQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" class="reason-input">
                    <div class="quantity-info">
                        Available: ${inventoryData.quantity}
                    </div>
                </div>
                <div class="modal-form-group">
                    <label for="dfnSelect"><strong>DFN:</strong></label>
                    <select id="dfnSelect" class="reason-input">
                        ${dfnOptions}
                    </select>
                </div>
                <div class="modal-form-group">
                    <label for="installNotes"><strong>Installation Notes:</strong></label>
                    <textarea id="installNotes" rows="3" placeholder="Enter installation notes..." class="reason-textarea"></textarea>
                </div>
                <div class="install-warning">
                    <strong>Note:</strong> This will update installation quantities for each allocation.
                </div>
            </div>
        `;
    }
}

/**
 * Setup quantity validation for serialized install items with allocations (Supabase version)
 * @param {Object} inventoryData - Inventory item data
 * @param {Array} allocations - Allocation data
 */
function setupSerializedInstallValidation(inventoryData, allocations = []) {
    const installButton = document.getElementById('executeInstallBtn');
    const dfnSelect = document.getElementById('dfnSelect');
    const usingAllocations = window.useAllocations === true;

    if (!usingAllocations) {
        // Not using allocations: validate main install quantity input and DFN selection
        const installQuantityInput = document.getElementById('installSerializedQuantity');
        installQuantityInput.setAttribute('max', inventoryData.quantity);
        installQuantityInput.setAttribute('min', 1);
        installQuantityInput.value = inventoryData.quantity;
        if (dfnSelect) dfnSelect.value = inventoryData.dfn_id || '';

        function validate() {
            const qty = parseInt(installQuantityInput.value) || 0;
            installButton.disabled = !dfnSelect.value || qty < 1 || qty > inventoryData.quantity;
        }
        installQuantityInput.addEventListener('input', validate);
        if (dfnSelect) dfnSelect.addEventListener('change', validate);
        validate();
    } else {
        // Using allocations: validate all allocation inputs
        if (!allocations.length) {
            installButton.disabled = true;
            return;
        }
        const installInputs = document.querySelectorAll('.install-allocation-input');
        function validate() {
            let isValid = true;
            let totalToInstall = 0;
            installInputs.forEach(input => {
                const maxAllowed = parseInt(input.getAttribute('max')) || 0;
                const val = parseInt(input.value) || 0;
                totalToInstall += val;
                if (val < 0 || val > maxAllowed) isValid = false;
            });
            installButton.disabled = !isValid || totalToInstall === 0;
        }
        installInputs.forEach(input => {
            input.addEventListener('input', validate);
            input.addEventListener('focus', () => input.select());
        });
        validate();
    }
}

/**
 * Update totals in the serialized install form (Supabase version)
 */
function updateSerializedInstallTotals() {
    const usingAllocations = window.useAllocations === true;
    if (usingAllocations) {
        const installInputs = document.querySelectorAll('.install-allocation-input');
        let totalToInstall = 0;
        installInputs.forEach(input => {
            totalToInstall += parseInt(input.value) || 0;
        });
        const totalToInstallCell = document.getElementById('totalToInstall');
        if (totalToInstallCell) {
            totalToInstallCell.textContent = totalToInstall;
        }
    } else {
        const quantityInput = document.getElementById('installSerializedQuantity');
        const maxAllowed = parseInt(quantityInput.getAttribute('max')) || 0;
        const currentQuantity = parseInt(quantityInput.value) || 0;
        if (currentQuantity < 1 || currentQuantity > maxAllowed) {
            quantityInput.style.borderColor = 'red';
        } else {
            quantityInput.style.borderColor = '';
        }
    }
}

/**
 * Validate the serialized install form (Supabase version)
 */
function validateSerializedInstallForm() {
    const installButton = document.getElementById('executeInstallBtn');
    const usingAllocations = window.useAllocations === true;
    let isValid = true;
    let totalToInstall = 0;

    if (usingAllocations) {
        const installInputs = document.querySelectorAll('.install-allocation-input');
        installInputs.forEach(input => {
            const installQty = parseInt(input.value) || 0;
            const maxAllowed = parseInt(input.getAttribute('max')) || 0;
            totalToInstall += installQty;
            if (installQty < 0 || installQty > maxAllowed) {
                isValid = false;
            }
        });
    } else {
        const quantityInput = document.getElementById('installSerializedQuantity');
        const dfnSelect = document.getElementById('dfnSelect');
        const maxAllowed = parseInt(quantityInput.getAttribute('max')) || 0;
        const qty = parseInt(quantityInput.value) || 0;
        if (qty < 1 || qty > maxAllowed) {
            isValid = false;
        }
        if (!dfnSelect.value) {
            isValid = false;
        }
    }

    installButton.disabled = !isValid;
}

/**
 * Setup quantity validation for bulk install items (Supabase version)
 * @param {Object} inventoryData - Inventory item data
 */
function setupInstallQuantityValidation(inventoryData) {
    const quantityInput = document.getElementById('installQuantity');
    const remainingSpan = document.getElementById('remainingQuantity');
    const installButton = document.getElementById('executeInstallBtn');

    // Setup auto-select for quantity input
    ModalUtils.setupQuantityAutoSelect('installQuantity');

    function validate() {
        const installQty = parseInt(quantityInput.value) || 0;
        const remaining = inventoryData.quantity - installQty;
        if (remainingSpan) remainingSpan.textContent = remaining;
        if (installQty < 1 || installQty > inventoryData.quantity) {
            installButton.disabled = true;
            if (remainingSpan) remainingSpan.style.color = 'red';
        } else {
            installButton.disabled = false;
            if (remainingSpan) remainingSpan.style.color = 'black';
        }
    }

    quantityInput.addEventListener('input', validate);
    validate();
}

/**
 * Execute the install operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Current inventory data
 * @param {boolean} isSerializedType - Whether this is a serialized item type
 */
async function executeInstallOperation(inventoryId, inventoryData, isSerializedType) {
    try {
        const notes = document.getElementById('installNotes')?.value.trim() || '';
        const installedStatusId = await ModalUtils.getStatusId('Installed');
        // Use cached "Field Installed" location
        const fieldInstalledLocRow = getCachedRowByField('locations', 'name', 'Field Installed');
        const fieldInstalledLocationId = fieldInstalledLocRow?.id;

        if (!fieldInstalledLocationId) {
            ModalUtils.handleError('Could not find "Field Installed" location in cached values.');
            return;
        }

        if (isSerializedType) {
            // Serialized: install all units together
            const qtyInput = document.getElementById('installSerializedQuantity');
            const dfnSelect = document.getElementById('installDfnSelect') || document.getElementById('dfnSelect');
            const installQty = parseInt(qtyInput?.value) || inventoryData.quantity;
            const dfnId = dfnSelect?.value || null;

            if (!installQty || installQty < 1 || installQty > inventoryData.quantity || !dfnId) {
                ModalUtils.handleError('Please enter a valid quantity and select a DFN.');
                return;
            }

            if (installQty === inventoryData.quantity) {
                // Full install
                await supabase.from('inventory').update({
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }).eq('id', inventoryId);

                if (window.transactionLogger) {
                    await window.transactionLogger.logInventoryUpdated(
                        inventoryId,
                        {
                            quantity: inventoryData.quantity,
                            status_name: inventoryData.status_name,
                            location_name: inventoryData.location_name,
                            dfn_id: inventoryData.dfn_id
                        },
                        {
                            quantity: inventoryData.quantity,
                            status_name: 'Installed',
                            location_name: 'Field Installed',
                            dfn_id: dfnId,
                            install_notes: notes
                        },
                        [`Fully installed (serialized): ${notes}`]
                    );
                }
            } else {
                // Partial install: update original, insert new installed record
                await supabase.from('inventory').update({
                    quantity: inventoryData.quantity - installQty
                }).eq('id', inventoryId);

                const { data } = await supabase.from('inventory').insert([{
                    ...inventoryData,
                    id: undefined,
                    quantity: installQty,
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }]).select('id').single();

                if (window.transactionLogger) {
                    if (data?.id) {
                        await window.transactionLogger.logInventoryCreated(data.id, {
                            ...inventoryData,
                            quantity: installQty,
                            status_id: installedStatusId,
                            location_id: fieldInstalledLocationId,
                            dfn_id: dfnId,
                            install_notes: notes
                        });
                    }
                    await window.transactionLogger.logQuantityAdjusted(
                        inventoryId,
                        inventoryData.quantity,
                        inventoryData.quantity - installQty,
                        `Partial install: ${installQty} units installed (serialized): ${notes}`
                    );
                }
            }
        } else {
            // Bulk: install some or all units
            const qtyInput = document.getElementById('installQuantity');
            const dfnSelect = document.getElementById('dfnSelect');
            const installQty = parseInt(qtyInput?.value) || 0;
            const dfnId = dfnSelect?.value || null;

            if (!installQty || installQty < 1 || installQty > inventoryData.quantity || !dfnId) {
                ModalUtils.handleError('Please enter a valid quantity and select a DFN.');
                return;
            }

            if (installQty === inventoryData.quantity) {
                // Full install
                await supabase.from('inventory').update({
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }).eq('id', inventoryId);

                if (window.transactionLogger) {
                    await window.transactionLogger.logInventoryUpdated(
                        inventoryId,
                        {
                            quantity: inventoryData.quantity,
                            status_name: inventoryData.status_name,
                            location_name: inventoryData.location_name,
                            dfn_id: inventoryData.dfn_id
                        },
                        {
                            quantity: inventoryData.quantity,
                            status_name: 'Installed',
                            location_name: 'Field Installed',
                            dfn_id: dfnId,
                            install_notes: notes
                        },
                        [`Fully installed (bulk): ${notes}`]
                    );
                }
            } else {
                // Partial install: update original, insert new installed record
                await supabase.from('inventory').update({
                    quantity: inventoryData.quantity - installQty
                }).eq('id', inventoryId);

                const { data } = await supabase.from('inventory').insert([{
                    ...inventoryData,
                    id: undefined,
                    quantity: installQty,
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }]).select('id').single();

                if (window.transactionLogger) {
                    if (data?.id) {
                        await window.transactionLogger.logInventoryCreated(data.id, {
                            ...inventoryData,
                            quantity: installQty,
                            status_id: installedStatusId,
                            location_id: fieldInstalledLocationId,
                            dfn_id: dfnId,
                            install_notes: notes
                        });
                    }
                    await window.transactionLogger.logQuantityAdjusted(
                        inventoryId,
                        inventoryData.quantity,
                        inventoryData.quantity - installQty,
                        `Partial install: ${installQty} units installed (bulk): ${notes}`
                    );
                }
            }
        }

        await ModalUtils.handleSuccess('installModal');
    } catch (error) {
        ModalUtils.handleError(error, 'install operation');
    }
}

/**
 * Execute bulk install operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Current inventory data
 * @param {string} notes - Installation notes
 */
async function executeBulkInstallOperation(inventoryId, inventoryData, notes) {
    try {
        const quantityInput = document.getElementById('installQuantity');
        const installQuantity = parseInt(quantityInput.value);
        const dfnSelect = document.getElementById('dfnSelect');
        const dfnId = dfnSelect?.value || null;
        const dfnName = dfnSelect?.selectedOptions[0]?.text || null;

        if (!installQuantity || installQuantity <= 0 || installQuantity > inventoryData.quantity || !dfnId) {
            ModalUtils.handleError('Please enter a valid quantity and select a DFN.');
            return;
        }

        const installedStatusId = await ModalUtils.getStatusId('Installed');
        const { data: fieldInstalledLoc } = await supabase
            .from('locations')
            .select('id')
            .eq('name', 'Field Installed')
            .single();
        const fieldInstalledLocationId = fieldInstalledLoc?.id;

        if (installQuantity < inventoryData.quantity) {
            // Partial installation for bulk items
            const newQuantity = inventoryData.quantity - installQuantity;
            // 1. Reduce quantity of original item
            await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryId);
            // 2. Create new installed item
            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                quantity: installQuantity,
                status_id: installedStatusId,
                location_id: fieldInstalledLocationId,
                dfn_id: dfnId
            }]).select('id').single();

            // Log transaction for partial installation
            if (window.transactionLogger) {
                if (data?.id) {
                    await window.transactionLogger.logInventoryCreated(data.id, {
                        ...inventoryData,
                        quantity: installQuantity,
                        status_id: installedStatusId,
                        location_id: fieldInstalledLocationId,
                        dfn_id: dfnId,
                        dfn_name: dfnName,
                        install_notes: notes
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    newQuantity,
                    `Partially installed ${installQuantity} units (bulk): ${notes}`
                );
            }
        } else {
            // Full installation (all quantity for bulk items)
            await supabase.from('inventory').update({
                status_id: installedStatusId,
                location_id: fieldInstalledLocationId,
                dfn_id: dfnId
            }).eq('id', inventoryId);

            // Log transaction for full installation
            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    {
                        quantity: inventoryData.quantity,
                        status_name: inventoryData.status_name,
                        location_name: inventoryData.location_name,
                        dfn_id: inventoryData.dfn_id,
                        dfn_name: inventoryData.dfn_name
                    },
                    {
                        quantity: inventoryData.quantity,
                        status_name: 'Installed',
                        location_name: 'Field Installed',
                        dfn_id: dfnId,
                        dfn_name: dfnName,
                        install_notes: notes
                    },
                    [`Fully installed (bulk): ${notes}`]
                );
            }
        }

        await ModalUtils.handleSuccess('installModal');
    } catch (error) {
        ModalUtils.handleError(error, 'bulk install operation');
    }
}

/**
 * Execute serialized install operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Current inventory data
 * @param {Array} allocations - Allocation data (if using allocations)
 * @param {string} notes - Installation notes
 */
async function executeSerializedInstallOperation(inventoryId, inventoryData, allocations = [], notes = '') {
    try {
        const usingAllocations = window.useAllocations === true;
        const installedStatusId = await ModalUtils.getStatusId('Installed');
        const { data: fieldInstalledLoc } = await supabase
            .from('locations')
            .select('id')
            .eq('name', 'Field Installed')
            .single();
        const fieldInstalledLocationId = fieldInstalledLoc?.id;

        if (usingAllocations && allocations.length > 0) {
            // Collect install quantities from allocation inputs
            const installInputs = document.querySelectorAll('.install-allocation-input');
            let totalToInstall = 0;
            const installData = [];
            installInputs.forEach(input => {
                const dfnId = input.dataset.dfnId;
                const installQty = parseInt(input.value) || 0;
                if (installQty > 0) {
                    const allocation = allocations.find(a => String(a.dfn_id) === String(dfnId));
                    installData.push({
                        dfnId,
                        dfnName: allocation?.dfn_name || '',
                        installQuantity: installQty,
                        allocation
                    });
                    totalToInstall += installQty;
                }
            });

            if (totalToInstall === 0) {
                ModalUtils.handleError('Please enter quantities to install');
                return;
            }

            // Update allocations (this assumes you have a Supabase table for allocations)
            for (const install of installData) {
                const newInstalledQty = (install.allocation?.installed_quantity || 0) + install.installQuantity;
                await supabase.from('qty_allocations').update({
                    installed_quantity: newInstalledQty
                }).eq('quantity_id', inventoryId).eq('dfn_id', install.dfnId);
            }

            // Check if all allocations are fully installed
            const totalAllocated = allocations.reduce((sum, a) => sum + a.allocated_quantity, 0);
            const totalInstalled = allocations.reduce((sum, a) => sum + a.installed_quantity, 0) + totalToInstall;
            const isFullyInstalled = totalInstalled >= totalAllocated;

            if (isFullyInstalled) {
                // Mark the entire inventory item as installed
                await supabase.from('inventory').update({
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId
                }).eq('id', inventoryId);
            }

            // Transaction logging
            if (window.transactionLogger) {
                const installSummary = installData.map(d => `${d.dfnName}: ${d.installQuantity}`).join(', ');
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    {
                        quantity: inventoryData.quantity,
                        status_name: inventoryData.status_name,
                        location_name: inventoryData.location_name,
                        allocations: allocations.map(a => ({
                            dfn_id: a.dfn_id,
                            dfn_name: a.dfn_name,
                            allocated_quantity: a.allocated_quantity,
                            installed_quantity: a.installed_quantity
                        }))
                    },
                    {
                        quantity: inventoryData.quantity,
                        status_name: isFullyInstalled ? 'Installed' : inventoryData.status_name,
                        location_name: isFullyInstalled ? 'Field Installed' : inventoryData.location_name,
                        allocations: allocations.map(a => {
                            const installForThisDfn = installData.find(d => String(d.dfnId) === String(a.dfn_id));
                            const additionalInstalled = installForThisDfn ? installForThisDfn.installQuantity : 0;
                            return {
                                dfn_id: a.dfn_id,
                                dfn_name: a.dfn_name,
                                allocated_quantity: a.allocated_quantity,
                                installed_quantity: a.installed_quantity + additionalInstalled
                            };
                        }),
                        total_installed: totalToInstall,
                        install_summary: installSummary
                    },
                    [`Installed ${totalToInstall} units from allocations (${installSummary}): ${notes}`]
                );
            }
        } else {
            // Not using allocations: treat as standard serialized install
            const qtyInput = document.getElementById('installSerializedQuantity');
            const dfnSelect = document.getElementById('installDfnSelect') || document.getElementById('dfnSelect');
            const installQty = parseInt(qtyInput?.value) || inventoryData.quantity;
            const dfnId = dfnSelect?.value || null;

            if (!installQty || installQty < 1 || installQty > inventoryData.quantity || !dfnId) {
                ModalUtils.handleError('Please enter a valid quantity and select a DFN.');
                return;
            }

            if (installQty === inventoryData.quantity) {
                // Full install
                await supabase.from('inventory').update({
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }).eq('id', inventoryId);

                if (window.transactionLogger) {
                    await window.transactionLogger.logInventoryUpdated(
                        inventoryId,
                        {
                            quantity: inventoryData.quantity,
                            status_name: inventoryData.status_name,
                            location_name: inventoryData.location_name,
                            dfn_id: inventoryData.dfn_id
                        },
                        {
                            quantity: inventoryData.quantity,
                            status_name: 'Installed',
                            location_name: 'Field Installed',
                            dfn_id: dfnId,
                            install_notes: notes
                        },
                        [`Fully installed (serialized): ${notes}`]
                    );
                }
            } else {
                // Partial install: update original, insert new installed record
                await supabase.from('inventory').update({
                    quantity: inventoryData.quantity - installQty
                }).eq('id', inventoryId);

                const { data } = await supabase.from('inventory').insert([{
                    ...inventoryData,
                    id: undefined,
                    quantity: installQty,
                    status_id: installedStatusId,
                    location_id: fieldInstalledLocationId,
                    dfn_id: dfnId
                }]).select('id').single();

                if (window.transactionLogger) {
                    if (data?.id) {
                        await window.transactionLogger.logInventoryCreated(data.id, {
                            ...inventoryData,
                            quantity: installQty,
                            status_id: installedStatusId,
                            location_id: fieldInstalledLocationId,
                            dfn_id: dfnId,
                            install_notes: notes
                        });
                    }
                    await window.transactionLogger.logQuantityAdjusted(
                        inventoryId,
                        inventoryData.quantity,
                        inventoryData.quantity - installQty,
                        `Partial install: ${installQty} units installed (serialized): ${notes}`
                    );
                }
            }
        }

        await ModalUtils.handleSuccess('installModal');
    } catch (error) {
        ModalUtils.handleError(error, 'serialized install operation');
    }
}

// ============================================================================
// REMOVE MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the remove modal for an inventory item (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showRemoveModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) return ModalUtils.handleError('No item selected for removal.');

        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) return ModalUtils.handleError('Inventory item not found.');

        // Get outgoing locations from Supabase
        const { data: outgoingLocations } = await supabase
            .from('locations')
            .select('id, name')
            .in('loc_type_id', [
                (await supabase.from('location_types').select('id').eq('name', 'Outgoing')).data[0]?.id
            ])
            .order('name');
        if (!outgoingLocations || outgoingLocations.length === 0) {
            ModalUtils.handleError('No outgoing locations found. Please configure outgoing locations first.');
            return;
        }

        // Generate location dropdown options
        const locationOptions = ModalUtils.generateDropdownOptions(outgoingLocations, 'Select destination location...');

        // Form section
        const formSection = `
            <div class="remove-form-section">
                <h4>Removal Details</h4>
                <div class="modal-form-group">
                    <label for="removeToLocation"><strong>Destination Location:</strong></label>
                    <select id="removeToLocation" required>
                        ${locationOptions}
                    </select>
                    <div class="location-info">
                        Item will be moved to the selected outgoing location and marked as "Removed"
                    </div>
                    <div id="removeLocationError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                <div class="modal-form-group">
                    <label for="removeNotes"><strong>Removal Notes (Required):</strong></label>
                    <textarea 
                        id="removeNotes" 
                        placeholder="Enter reason for removal (required for audit trail)"
                        rows="4"
                        required
                    ></textarea>
                    <div id="removeNotesError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                <div class="remove-warning">
                    <strong>⚠️ Important:</strong> This will move the item to the selected outgoing location and mark it as "Removed" from active inventory. This action can be reversed if needed.
                </div>
            </div>
        `;

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, (inventoryData.inventory_type || '').toLowerCase() === 'serialized', 'Current Quantity');

        // Two-column layout
        const twoColumnBody = `
            <div class="remove-two-column">
                <div class="remove-left-column">${formSection}</div>
                <div class="remove-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('removeModal', {
            title: 'Remove Inventory Item',
            className: 'modal-base remove-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelRemoveBtn', text: 'Cancel', className: 'remove-btn-secondary' },
                { id: 'executeRemoveBtn', text: 'Remove Item', className: 'remove-btn-danger', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelRemoveBtn'],
            executeHandler: {
                id: 'executeRemoveBtn',
                handler: () => executeRemoveOperation(inventoryId, inventoryData)
            }
        });

        // Setup validation for both location and notes
        setupRemoveValidation(inventoryData);

        // Focus on location dropdown
        setTimeout(() => {
            const locationSelect = document.getElementById('removeToLocation');
            if (locationSelect) locationSelect.focus();
        }, 100);

    } catch (error) {
        ModalUtils.handleError(error, 'showing remove modal');
    }
}

/**
 * Setup validation for the remove modal (Supabase version)
 * @param {Object} inventoryData - Inventory item data
 */
function setupRemoveValidation(inventoryData) {
    const locationSelect = document.getElementById('removeToLocation');
    const notesTextarea = document.getElementById('removeNotes');
    const executeBtn = document.getElementById('executeRemoveBtn');
    const locationError = document.getElementById('removeLocationError');
    const notesError = document.getElementById('removeNotesError');

    function validate() {
        let isValid = true;

        // Validate location selection
        if (!locationSelect.value) {
            locationError.textContent = 'Please select a destination location';
            locationError.style.display = 'block';
            isValid = false;
        } else {
            locationError.style.display = 'none';
        }

        // Validate notes (minimum 10 characters)
        const notes = notesTextarea.value.trim();
        if (notes.length < 10) {
            notesError.textContent = 'Please provide detailed removal notes (at least 10 characters) for the audit trail';
            notesError.style.display = 'block';
            isValid = false;
        } else {
            notesError.style.display = 'none';
        }

        executeBtn.disabled = !isValid;
    }

    locationSelect.addEventListener('change', validate);
    notesTextarea.addEventListener('input', validate);
    validate();
}

/**
 * Execute remove operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 */
async function executeRemoveOperation(inventoryId, inventoryData) {
    try {
        const locationSelect = document.getElementById('removeToLocation');
        const notesTextarea = document.getElementById('removeNotes');
        const destinationLocationId = locationSelect.value;
        const notes = notesTextarea.value.trim();

        // Validate inputs
        if (!destinationLocationId) {
            ModalUtils.handleError('Please select a destination location');
            return;
        }
        if (notes.length < 10) {
            ModalUtils.handleError('Please provide detailed removal notes (at least 10 characters)');
            return;
        }

        // Get removed status ID from Supabase
        const removedStatusId = await ModalUtils.getStatusId('Removed');
        if (!removedStatusId) {
            ModalUtils.handleError('Removed status not found in database');
            return;
        }

        // Get destination location name for logging
        const { data: locationData } = await supabase
            .from('locations')
            .select('name')
            .eq('id', destinationLocationId)
            .single();
        const destinationLocationName = locationData?.name || 'Unknown Location';

        // Update the inventory item - change location and status to 'Removed'
        await supabase.from('inventory').update({
            location_id: destinationLocationId,
            status_id: removedStatusId
        }).eq('id', inventoryId);

        // Log the removal transaction
        if (window.transactionLogger) {
            try {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    {
                        status_name: inventoryData.status_name,
                        location_name: inventoryData.location_name,
                        quantity: inventoryData.quantity
                    },
                    {
                        status_name: 'Removed',
                        location_name: destinationLocationName,
                        quantity: inventoryData.quantity
                    },
                    [`Item removed from inventory: ${notes}`]
                );
            } catch (logError) {
                console.warn('Failed to log removal transaction:', logError);
            }
        }

        await ModalUtils.handleSuccess('removeModal');
    } catch (error) {
        ModalUtils.handleError(error, 'remove operation');
    }
}

// ============================================================================
// RETURN AS RESERVED MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the return as reserved modal for returning issued items back to storage (Supabase version, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showReturnAsReservedModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) {
            ModalUtils.handleError('No item selected for return.');
            return;
        }

        // Get the item data from Supabase
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) {
            ModalUtils.handleError('Selected item not found in database.');
            return;
        }

        // Only allow return if item is issued to a crew and status is 'Issued'
        if (!inventoryData.assigned_crew_id) {
            ModalUtils.handleError('This item is not assigned to any crew. Only issued items can be returned as reserved.');
            return;
        }
        if (inventoryData.status_name !== 'Issued') {
            ModalUtils.handleError('Only items with "Issued" status can be returned as reserved.');
            return;
        }

        // Get crew name for display
        const crewName = await ModalUtils.getCrewName(inventoryData.assigned_crew_id);

        // Determine item type
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';
        const isBulkItem = (inventoryData.inventory_type || '').toLowerCase() === 'bulk';

        // Get storage locations from Supabase
        const { data: storageLocations } = await supabase
            .from('locations')
            .select('id, name')
            .in('loc_type_id', [
                (await supabase.from('location_types').select('id').eq('name', 'Storage')).data[0]?.id
            ])
            .order('name');
        if (!storageLocations || storageLocations.length === 0) {
            ModalUtils.handleError('No storage locations found. Please configure storage locations first.');
            return;
        }

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Current Quantity');

        // Location dropdown options
        const locationOptions = ModalUtils.generateDropdownOptions(storageLocations, 'Select storage location...');

        // Form section
        const formSection = `
            <div class="return-reserved-form-section">
                <h4>Return Details</h4>
                <div class="modal-form-group">
                    <label for="returnToLocation"><strong>Return to Storage Location (Required):</strong></label>
                    <select id="returnToLocation" required>
                        ${locationOptions}
                    </select>
                    <div class="location-info">
                        <em>Item will be moved to the selected storage location and status changed to "Reserved"</em>
                    </div>
                    <div id="returnLocationError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                ${!isSerializedItem && isBulkItem ? `
                    <div class="modal-form-group">
                        <label for="returnQuantity"><strong>Quantity to Return:</strong></label>
                        <input type="number" id="returnQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" required>
                        <div class="quantity-info">
                            Available: ${inventoryData.quantity} | <span id="remainingAfterReturn">Remaining: 0</span>
                            <br><em>Bulk items allow partial quantity returns</em>
                        </div>
                        <div id="returnQuantityError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                    </div>
                ` : `
                    <div class="modal-form-group">
                        <div class="serialized-notice">
                            <strong>Serialized Item:</strong> All ${inventoryData.quantity} units will be returned
                            <br><em>Serialized items must be returned in full - partial quantities are not allowed</em>
                        </div>
                    </div>
                `}
                <div class="modal-form-group">
                    <label for="returnNotes">Return Notes (Optional):</label>
                    <textarea id="returnNotes" placeholder="Enter any notes about this return (optional)" rows="3"></textarea>
                </div>
                <div class="modal-warning-section">
                    <div class="modal-warning">
                        <strong>Note:</strong> This will return the item(s) to storage, change status to "Reserved", and maintain the crew assignment for future re-issue.
                        ${!isSerializedItem && isBulkItem ? 'If partial quantity, remaining items will stay issued with the crew.' : 'The entire item will be returned and marked as reserved.'}
                    </div>
                </div>
            </div>
        `;

        // Two-column layout
        const twoColumnBody = `
            <div class="return-reserved-two-column">
                <div class="return-reserved-left-column">${formSection}</div>
                <div class="return-reserved-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('returnAsReservedModal', {
            title: 'Return as Reserved',
            className: 'modal-base return-as-reserved-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelReturnAsReservedBtn', text: 'Cancel', className: 'return-as-reserved-btn-secondary' },
                { id: 'executeReturnAsReservedBtn', text: 'Return as Reserved', className: 'return-as-reserved-btn-primary', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelReturnAsReservedBtn'],
            executeHandler: {
                id: 'executeReturnAsReservedBtn',
                handler: () => executeReturnAsReservedOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem)
            }
        });

        // Setup validation
        setupReturnAsReservedValidation(inventoryData, isSerializedItem, isBulkItem);

        // Setup auto-select for quantity input (for bulk items)
        if (!isSerializedItem && isBulkItem) {
            ModalUtils.setupQuantityAutoSelect('returnQuantity');
        }

        // Focus on location dropdown
        setTimeout(() => {
            const locationSelect = document.getElementById('returnToLocation');
            if (locationSelect) locationSelect.focus();
        }, 100);

    } catch (error) {
        ModalUtils.handleError(error, 'showing return as reserved modal');
    }
}

/**
 * Setup validation for the return as reserved modal
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
function setupReturnAsReservedValidation(inventoryData, isSerializedItem, isBulkItem) {
    const locationSelect = document.getElementById('returnToLocation');
    const executeBtn = document.getElementById('executeReturnAsReservedBtn');
    const locationError = document.getElementById('returnLocationError');
    let quantityInput = null;
    let quantityError = null;

    if (!isSerializedItem && isBulkItem) {
        quantityInput = document.getElementById('returnQuantity');
        quantityError = document.getElementById('returnQuantityError');
    }

    function validate() {
        let isValid = true;

        // Validate location selection
        if (!locationSelect.value) {
            locationError.textContent = 'Please select a storage location';
            locationError.style.display = 'block';
            isValid = false;
        } else {
            locationError.style.display = 'none';
        }

        // Validate quantity for bulk items
        if (!isSerializedItem && isBulkItem && quantityInput && quantityError) {
            const returnQuantity = parseInt(quantityInput.value) || 0;
            const remaining = inventoryData.quantity - returnQuantity;
            const remainingSpan = document.getElementById('remainingAfterReturn');
            if (remainingSpan) remainingSpan.textContent = `Remaining: ${remaining}`;
            if (returnQuantity <= 0) {
                quantityError.textContent = 'Quantity must be greater than 0';
                quantityError.style.display = 'block';
                isValid = false;
            } else if (returnQuantity > inventoryData.quantity) {
                quantityError.textContent = 'Cannot return more than current quantity';
                quantityError.style.display = 'block';
                isValid = false;
            } else {
                quantityError.style.display = 'none';
            }
        }

        executeBtn.disabled = !isValid;
    }

    locationSelect.addEventListener('change', validate);
    if (!isSerializedItem && isBulkItem && quantityInput) {
        quantityInput.addEventListener('input', validate);
    }
    validate();
}

/**
 * Execute the return as reserved operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
async function executeReturnAsReservedOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem) {
    try {
        const locationSelect = document.getElementById('returnToLocation');
        const notesTextarea = document.getElementById('returnNotes');
        const destinationLocationId = locationSelect.value;
        const notes = notesTextarea ? notesTextarea.value.trim() : '';

        // Validate location
        if (!destinationLocationId) {
            ModalUtils.handleError('Please select a storage location');
            return;
        }

        let returnQuantity;
        if (isSerializedItem || !isBulkItem) {
            returnQuantity = inventoryData.quantity;
        } else {
            const quantityInput = document.getElementById('returnQuantity');
            if (!quantityInput) {
                ModalUtils.handleError('Quantity input not found.');
                return;
            }
            returnQuantity = parseInt(quantityInput.value);
            if (isNaN(returnQuantity) || returnQuantity <= 0) {
                ModalUtils.handleError('Please enter a valid quantity to return.');
                return;
            }
            if (returnQuantity > inventoryData.quantity) {
                ModalUtils.handleError('Cannot return more units than currently issued.');
                return;
            }
        }

        const reservedStatusId = await ModalUtils.getStatusId('Reserved');
        const { data: locationData } = await supabase
            .from('locations')
            .select('name')
            .eq('id', destinationLocationId)
            .single();
        const destinationLocationName = locationData?.name || 'Unknown Location';

        // Get crew name for logging
        const crewName = await ModalUtils.getCrewName(inventoryData.assigned_crew_id);

        if (returnQuantity === inventoryData.quantity) {
            // Full return - update existing record
            await supabase.from('inventory').update({
                status_id: reservedStatusId,
                location_id: destinationLocationId
            }).eq('id', inventoryId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    {
                        status_name: inventoryData.status_name,
                        location_name: inventoryData.location_name,
                        quantity: inventoryData.quantity
                    },
                    {
                        status_name: 'Reserved',
                        location_name: destinationLocationName,
                        quantity: returnQuantity
                    },
                    [notes ? `Returned as reserved: ${notes}` : 'Returned as reserved']
                );
            }
        } else {
            // Partial return - reduce original quantity and create new "Reserved" record
            const newIssuedQuantity = inventoryData.quantity - returnQuantity;
            await supabase.from('inventory').update({
                quantity: newIssuedQuantity
            }).eq('id', inventoryId);

            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                location_id: destinationLocationId,
                quantity: returnQuantity,
                status_id: reservedStatusId
            }]).select('id').single();
            const newReservedRecordId = data?.id;

            if (window.transactionLogger) {
                if (newReservedRecordId) {
                    await window.transactionLogger.logInventoryCreated(newReservedRecordId, {
                        ...inventoryData,
                        location_id: destinationLocationId,
                        quantity: returnQuantity,
                        status_id: reservedStatusId
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    newIssuedQuantity,
                    notes ? `Partial return as reserved: ${notes}` : 'Partial return as reserved'
                );
            }
        }

        await ModalUtils.handleSuccess('returnAsReservedModal');
    } catch (error) {
        ModalUtils.handleError(error, 'return as reserved operation');
    }
}

// ============================================================================
// RETURN AS AVAILABLE MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the return as available modal for returning issued items back to storage as available (Supabase version, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showReturnAsAvailableModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) {
            ModalUtils.handleError('No item selected for return.');
            return;
        }

        // Get the item data from Supabase
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) {
            ModalUtils.handleError('Selected item not found in database.');
            return;
        }

        // Only allow return if item is issued to a crew and status is 'Issued'
        if (!inventoryData.assigned_crew_id) {
            ModalUtils.handleError('This item is not assigned to any crew. Only issued items can be returned as available.');
            return;
        }
        if (inventoryData.status_name !== 'Issued') {
            ModalUtils.handleError('Only items with "Issued" status can be returned as available.');
            return;
        }

        // Get crew name for display
        const crewName = await ModalUtils.getCrewName(inventoryData.assigned_crew_id);

        // Determine item type
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';
        const isBulkItem = (inventoryData.inventory_type || '').toLowerCase() === 'bulk';

        // Get storage locations from Supabase
        const { data: storageLocations } = await supabase
            .from('locations')
            .select('id, name')
            .in('loc_type_id', [
                (await supabase.from('location_types').select('id').eq('name', 'Storage')).data[0]?.id
            ])
            .order('name');
        if (!storageLocations || storageLocations.length === 0) {
            ModalUtils.handleError('No storage locations found. Please configure storage locations first.');
            return;
        }

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Current Quantity');

        // Location dropdown options
        const locationOptions = ModalUtils.generateDropdownOptions(storageLocations, 'Select storage location...');

        // Form section
        const formSection = `
            <div class="return-available-form-section">
                <h4>Return Details</h4>
                <div class="modal-form-group">
                    <label for="returnToLocationAvailable"><strong>Return to Storage Location (Required):</strong></label>
                    <select id="returnToLocationAvailable" required>
                        ${locationOptions}
                    </select>
                    <div class="location-info">
                        <em>Item will be moved to the selected storage location and status changed to "Available"</em>
                    </div>
                    <div id="returnLocationAvailableError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                ${!isSerializedItem && isBulkItem ? `
                    <div class="modal-form-group">
                        <label for="returnQuantityAvailable"><strong>Quantity to Return:</strong></label>
                        <input type="number" id="returnQuantityAvailable" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" required>
                        <div class="quantity-info">
                            Available: ${inventoryData.quantity} | <span id="remainingAfterReturnAvailable">Remaining: 0</span>
                            <br><em>Bulk items allow partial quantity returns</em>
                        </div>
                        <div id="returnQuantityAvailableError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                    </div>
                ` : `
                    <div class="modal-form-group">
                        <div class="serialized-notice">
                            <strong>Serialized Item:</strong> All ${inventoryData.quantity} units will be returned
                            <br><em>Serialized items must be returned in full - partial quantities are not allowed</em>
                        </div>
                    </div>
                `}
                <div class="modal-form-group">
                    <label for="returnNotesAvailable">Return Notes (Optional):</label>
                    <textarea id="returnNotesAvailable" placeholder="Enter any notes about this return (optional)" rows="3"></textarea>
                </div>
                <div class="modal-warning-section">
                    <div class="modal-warning">
                        <strong>Note:</strong> This will return the item(s) to storage, change status to "Available", and remove the crew assignment for general availability.
                        ${!isSerializedItem && isBulkItem ? 'If partial quantity, remaining items will stay issued with the crew.' : 'The entire item will be returned and marked as available.'}
                    </div>
                </div>
            </div>
        `;

        // Two-column layout with extra fields and signature in right column
        const twoColumnBody = `
            <div class="return-available-two-column">
                <div class="return-available-left-column">${formSection}</div>
                <div class="return-available-right-column">
                    ${infoSection}
                    <div id="return-extra-fields" style="margin-top:16px;">
                        <label for="return-signer-name"><strong>Name:</strong></label><br>
                        <input type="text" id="return-signer-name" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your name"><br>
                        <label for="return-email"><strong>Email:</strong></label><br>
                        <input type="email" id="return-email" style="width: 95%; margin-bottom: 8px;" placeholder="Enter your email"><br>
                        <label for="return-comments"><strong>Comments:</strong></label><br>
                        <textarea id="return-comments" rows="2" style="width: 95%; margin-bottom: 8px;" placeholder="Enter any comments..."></textarea>
                    </div>
                    <div id="return-signature-area" style="margin-top:10px;">
                        <label for="return-signature-pad"><strong>Signature:</strong></label><br>
                        <canvas id="return-signature-pad" width="300" height="80" style="border:1px solid #ccc;"></canvas><br>
                        <button type="button" id="return-clear-signature">Clear Signature</button>
                    </div>
                </div>
            </div>
        `;

        // Create modal with download PDF button
        const modal = ModalUtils.createModal('returnAsAvailableModal', {
            title: 'Return as Available',
            className: 'modal-base return-as-available-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelReturnAsAvailableBtn', text: 'Cancel', className: 'return-as-available-btn-secondary' },
                { id: 'executeReturnAsAvailableBtn', text: 'Return as Available', className: 'return-as-available-btn-primary', disabled: true },
                { id: 'downloadReturnPDFBtn', text: 'Download PDF', className: 'return-btn-secondary' }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelReturnAsAvailableBtn'],
            executeHandler: {
                id: 'executeReturnAsAvailableBtn',
                handler: () => executeReturnAsAvailableOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem)
            },
            customHandlers: [
                { id: 'downloadReturnPDFBtn', handler: downloadReturnPDF }
            ]
        });

        // Setup validation
        setupReturnAsAvailableValidation(inventoryData, isSerializedItem, isBulkItem);

        // Setup auto-select for quantity input (for bulk items)
        if (!isSerializedItem && isBulkItem) {
            ModalUtils.setupQuantityAutoSelect('returnQuantityAvailable');
        }

        // Setup PDF download button and signature pad
        setTimeout(() => {
            const btn = document.getElementById('downloadReturnPDFBtn');
            if (btn) btn.addEventListener('click', downloadReturnPDF);

            const locationSelect = document.getElementById('returnToLocationAvailable');
            if (locationSelect) locationSelect.focus();

            // Initialize signature pad
            const canvas = document.getElementById('return-signature-pad');
            if (canvas) {
                window.returnSignaturePad = new window.SignaturePad(canvas, { backgroundColor: 'rgb(255,255,255)' });
                document.getElementById('return-clear-signature').onclick = () => window.returnSignaturePad.clear();
            }
        }, 100);

    } catch (error) {
        ModalUtils.handleError(error, 'showing return as available modal');
    }
}

/**
 * Setup validation for the return as available modal
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
function setupReturnAsAvailableValidation(inventoryData, isSerializedItem, isBulkItem) {
    const locationSelect = document.getElementById('returnToLocationAvailable');
    const executeBtn = document.getElementById('executeReturnAsAvailableBtn');
    const locationError = document.getElementById('returnLocationAvailableError');
    
    let quantityInput = null;
    let quantityError = null;
    
    // Only get quantity elements for bulk items
    if (!isSerializedItem && isBulkItem) {
        quantityInput = document.getElementById('returnQuantityAvailable');
        quantityError = document.getElementById('returnQuantityAvailableError');
    }
    
    function validate() {
        let isValid = true;

        // Validate location selection
        if (!locationSelect.value) {
            locationError.textContent = 'Please select a storage location';
            locationError.style.display = 'block';
            isValid = false;
        } else {
            locationError.style.display = 'none';
        }

        // Validate quantity for bulk items
        if (!isSerializedItem && isBulkItem && quantityInput && quantityError) {
            const returnQuantity = parseInt(quantityInput.value) || 0;
            const remaining = inventoryData.quantity - returnQuantity;
            const remainingSpan = document.getElementById('remainingAfterReturnAvailable');
            if (remainingSpan) remainingSpan.textContent = `Remaining: ${remaining}`;
            if (returnQuantity <= 0) {
                quantityError.textContent = 'Quantity must be greater than 0';
                quantityError.style.display = 'block';
                isValid = false;
            } else if (returnQuantity > inventoryData.quantity) {
                quantityError.textContent = 'Cannot return more than current quantity';
                quantityError.style.display = 'block';
                isValid = false;
            } else {
                quantityError.style.display = 'none';
            }
        }

        executeBtn.disabled = !isValid;
    }

    locationSelect.addEventListener('change', validate);
    if (!isSerializedItem && isBulkItem && quantityInput) {
        quantityInput.addEventListener('input', validate);
    }
    validate();
}

/**
 * Execute the return as available operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
async function executeReturnAsAvailableOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem) {
    try {
        const locationSelect = document.getElementById('returnToLocationAvailable');
        const notesTextarea = document.getElementById('returnNotesAvailable');
        const destinationLocationId = locationSelect.value;
        const notes = notesTextarea ? notesTextarea.value.trim() : '';

        // Validate location
        if (!destinationLocationId) {
            ModalUtils.handleError('Please select a storage location');
            return;
        }

        let returnQuantity;
        if (isSerializedItem || !isBulkItem) {
            returnQuantity = inventoryData.quantity;
        } else {
            const quantityInput = document.getElementById('returnQuantityAvailable');
            if (!quantityInput) {
                ModalUtils.handleError('Quantity input not found.');
                return;
            }
            returnQuantity = parseInt(quantityInput.value);
            if (isNaN(returnQuantity) || returnQuantity <= 0) {
                ModalUtils.handleError('Please enter a valid quantity to return.');
                return;
            }
            if (returnQuantity > inventoryData.quantity) {
                ModalUtils.handleError('Cannot return more units than currently issued.');
                return;
            }
        }

        const availableStatusId = await ModalUtils.getStatusId('Available');
        const { data: locationData } = await supabase
            .from('locations')
            .select('name')
            .eq('id', destinationLocationId)
            .single();
        const destinationLocationName = locationData?.name || 'Unknown Location';

        // Get crew name for logging
        const crewName = await ModalUtils.getCrewName(inventoryData.assigned_crew_id);

        if (returnQuantity === inventoryData.quantity) {
            // Full return - update existing record
            await supabase.from('inventory').update({
                status_id: availableStatusId,
                location_id: destinationLocationId,
                assigned_crew_id: null,
                dfn_id: null
            }).eq('id', inventoryId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    {
                        status_name: inventoryData.status_name,
                        location_name: inventoryData.location_name,
                        quantity: inventoryData.quantity,
                        assigned_crew_id: inventoryData.assigned_crew_id
                    },
                    {
                        status_name: 'Available',
                        location_name: destinationLocationName,
                        quantity: returnQuantity,
                        assigned_crew_id: null
                    },
                    [notes ? `Returned as available: ${notes}` : 'Returned as available']
                );
            }
        } else {
            // Partial return - reduce original quantity and create new "Available" record
            const newIssuedQuantity = inventoryData.quantity - returnQuantity;
            await supabase.from('inventory').update({
                quantity: newIssuedQuantity
            }).eq('id', inventoryId);

            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                location_id: destinationLocationId,
                quantity: returnQuantity,
                status_id: availableStatusId,
                assigned_crew_id: null,
                dfn_id: null
            }]).select('id').single();
            const newAvailableRecordId = data?.id;

            if (window.transactionLogger) {
                if (newAvailableRecordId) {
                    await window.transactionLogger.logInventoryCreated(newAvailableRecordId, {
                        ...inventoryData,
                        location_id: destinationLocationId,
                        quantity: returnQuantity,
                        status_id: availableStatusId,
                        assigned_crew_id: null,
                        dfn_id: null
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    newIssuedQuantity,
                    notes ? `Partial return as available: ${notes}` : 'Partial return as available'
                );
            }
        }

        // Increment receipt number for next operation
        await setReceiptNumber(await getReceiptNumber() + 1);

        await ModalUtils.handleSuccess('returnAsAvailableModal');
    } catch (error) {
        ModalUtils.handleError(error, 'return as available operation');
    }
}

// ============================================================================
// ADJUST MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the adjust modal for adjusting inventory quantity (Supabase version, succinct, with transaction logging)
 * @param {string} inventoryId - Inventory item ID
 */
async function showAdjustModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) {
            ModalUtils.handleError('No item selected for adjustment.');
            return;
        }

        // Get the item data from Supabase
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) {
            ModalUtils.handleError('Selected item not found in database.');
            return;
        }

        // Determine if item is serialized
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';

        // Form section
        const formSection = `
            <div class="adjust-form-section">
                <h4>Adjustment Details</h4>
                <div class="modal-form-group">
                    <label for="adjustedQuantity"><strong>New Quantity:</strong></label>
                    <input type="number" id="adjustedQuantity" min="0" value="${inventoryData.quantity}" required>
                    <div class="quantity-info">
                        Current: ${inventoryData.quantity} | <span id="quantityDifference">Change: 0</span>
                    </div>
                    ${isSerializedItem ? '<div class="serialized-notice"><strong>Serialized Item:</strong> Ensure quantity reflects actual number of serialized units</div>' : ''}
                    <div id="adjustQuantityError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                <div class="modal-form-group">
                    <label for="adjustNotes"><strong>Adjustment Notes (Required):</strong></label>
                    <textarea id="adjustNotes" placeholder="Enter detailed notes explaining the reason for this quantity adjustment (minimum 10 characters)" rows="4" required></textarea>
                    <div class="notes-info">
                        <span id="notesCharCount">0</span> characters (minimum 10 required)
                    </div>
                    <div id="adjustNotesError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                <div class="adjust-warning">
                    <strong>Important:</strong> This will change the quantity of the inventory item and log the adjustment.<br>
                    Quantity adjustments should only be made for physical counts, damage, or administrative corrections.
                </div>
            </div>
        `;

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Current Quantity');

        // Two-column layout
        const twoColumnBody = `
            <div class="adjust-two-column">
                <div class="adjust-left-column">${formSection}</div>
                <div class="adjust-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('adjustModal', {
            title: 'Adjust Inventory Quantity',
            className: 'modal-base adjust-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelAdjustBtn', text: 'Cancel', className: 'adjust-btn-secondary' },
                { id: 'executeAdjustBtn', text: 'Adjust Quantity', className: 'adjust-btn-primary', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelAdjustBtn'],
            executeHandler: {
                id: 'executeAdjustBtn',
                handler: () => executeAdjustOperation(inventoryId, inventoryData)
            }
        });

        // Setup validation
        setupAdjustValidation(inventoryData);

        // Setup auto-select for quantity input
        ModalUtils.setupQuantityAutoSelect('adjustedQuantity');

        // Focus on quantity input
        setTimeout(() => {
            const quantityInput = document.getElementById('adjustedQuantity');
            if (quantityInput) {
                quantityInput.focus();
                quantityInput.select();
            }
        }, 100);

    } catch (error) {
        ModalUtils.handleError(error, 'showing adjust modal');
    }
}

/**
 * Setup validation for the adjust modal
 * @param {Object} inventoryData - Inventory item data
 */
function setupAdjustValidation(inventoryData) {
    const quantityInput = document.getElementById('adjustedQuantity');
    const notesTextarea = document.getElementById('adjustNotes');
    const executeBtn = document.getElementById('executeAdjustBtn');
    const quantityError = document.getElementById('adjustQuantityError');
    const notesError = document.getElementById('adjustNotesError');
    const quantityDifference = document.getElementById('quantityDifference');
    const notesCharCount = document.getElementById('notesCharCount');
    
    function updateAdjustValidation() {
        let isValid = true;
        
        // Validate quantity
        const newQuantity = parseInt(quantityInput.value) || 0;
        const difference = newQuantity - inventoryData.quantity;
        
        // Update difference display
        if (quantityDifference) {
            const sign = difference > 0 ? '+' : '';
            quantityDifference.textContent = `Change: ${sign}${difference}`;
            quantityDifference.style.color = difference > 0 ? 'green' : difference < 0 ? 'red' : 'black';
        }
        
        if (newQuantity < 0) {
            quantityError.textContent = 'Quantity cannot be negative';
            quantityError.style.display = 'block';
            isValid = false;
        } else if (difference === 0) {
            quantityError.textContent = 'New quantity must be different from current quantity';
            quantityError.style.display = 'block';
            isValid = false;
        } else {
            quantityError.style.display = 'none';
        }
        
        // Validate notes
        const notes = notesTextarea.value.trim();
        const notesLength = notes.length;
        
        // Update character count
        if (notesCharCount) {
            notesCharCount.textContent = notesLength;
            notesCharCount.style.color = notesLength >= 10 ? 'green' : 'red';
        }
        
        if (notesLength < 10) {
            notesError.textContent = 'Please provide detailed adjustment notes (minimum 10 characters)';
            notesError.style.display = 'block';
            isValid = false;
        } else {
            notesError.style.display = 'none';
        }
        
        // Enable/disable submit button and update its tab index
        executeBtn.disabled = !isValid;
        executeBtn.tabIndex = isValid ? 0 : -1;
    }
    
    // Add event listeners for real-time validation
    quantityInput.addEventListener('input', updateAdjustValidation);
    notesTextarea.addEventListener('input', updateAdjustValidation);
    
    // Initial validation
    updateAdjustValidation();
}

/**
 * Execute the adjust operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 */
async function executeAdjustOperation(inventoryId, inventoryData) {
    try {
        const quantityInput = document.getElementById('adjustedQuantity');
        const notesTextarea = document.getElementById('adjustNotes');
        const newQuantity = parseInt(quantityInput.value);
        const notes = notesTextarea.value.trim();

        // Validate inputs
        if (isNaN(newQuantity) || newQuantity < 0) {
            ModalUtils.handleError('Please enter a valid quantity (cannot be negative)');
            return;
        }
        if (newQuantity === inventoryData.quantity) {
            ModalUtils.handleError('New quantity must be different from current quantity');
            return;
        }
        if (notes.length < 10) {
            ModalUtils.handleError('Please provide detailed adjustment notes (minimum 10 characters)');
            return;
        }

        const currentQuantity = inventoryData.quantity;
        const quantityDifference = newQuantity - currentQuantity;

        // Update the inventory quantity in Supabase
        await supabase.from('inventory').update({ quantity: newQuantity }).eq('id', inventoryId);

        // Log the adjustment transaction
        if (window.transactionLogger) {
            try {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    { quantity: currentQuantity },
                    { quantity: newQuantity },
                    [`Quantity adjustment: ${notes}`]
                );
            } catch (logError) {
                console.warn('Failed to log adjustment transaction:', logError);
            }
        }

        await ModalUtils.handleSuccess('adjustModal');
    } catch (error) {
        ModalUtils.handleError(error, 'adjust operation');
    }
}

// ============================================================================
// ASSIGN DFN MODAL FUNCTIONALITY
// ============================================================================

/**
 * Show the assign DFN modal for assigning DFN to inventory items (Supabase version, succinct)
 * @param {string} inventoryId - Inventory item ID
 */
async function showAssignDfnModal(inventoryId) {
    try {
        closeActionModal();
        if (!inventoryId) {
            ModalUtils.handleError('No item selected for DFN assignment.');
            return;
        }

        // Get inventory data
        const inventoryData = await ModalUtils.getInventoryData(inventoryId);
        if (!inventoryData) {
            ModalUtils.handleError('Selected item not found in database.');
            return;
        }

        // Determine item type
        const isSerializedItem = (inventoryData.inventory_type || '').toLowerCase() === 'serialized';
        const isBulkItem = (inventoryData.inventory_type || '').toLowerCase() === 'bulk';

        // Get current DFN name
        let currentDfnName = inventoryData.dfn_id ? (getCachedRow('dfns', inventoryData.dfn_id)?.name || 'Unknown DFN') : 'None';

        // Get all DFNs for this SLOC, excluding current
        const dfns = getCachedTable('dfns')
            .filter(row =>
                row.sloc_id == window.selectedSlocId &&
                (!inventoryData.dfn_id || row.id != inventoryData.dfn_id)
            )
            .sort((a, b) => a.name.localeCompare(b.name));
        if (!dfns || dfns.length === 0) {
            ModalUtils.handleError('No available DFNs found for assignment.');
            return;
        }

        // Generate DFN dropdown options
        const dfnOptions = ModalUtils.generateDropdownOptions(dfns, 'Select DFN...');

        // Form section
        const formSection = `
            <div class="assign-dfn-form-section">
                <h4>DFN Assignment</h4>
                <div class="modal-form-group">
                    <label for="assignDfn"><strong>Assign to DFN:</strong></label>
                    <select id="assignDfn" required>
                        ${dfnOptions}
                    </select>
                    <div class="dfn-info">
                        <em>Select the DFN to assign this inventory to</em>
                        ${inventoryData.dfn_id ? `<br><strong>Current:</strong> ${currentDfnName}` : ''}
                    </div>
                    <div id="assignDfnError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                </div>
                ${!isSerializedItem && isBulkItem ? `
                    <div class="modal-form-group">
                        <label for="assignDfnQuantity"><strong>Quantity:</strong></label>
                        <input type="number" id="assignDfnQuantity" min="1" max="${inventoryData.quantity}" value="${inventoryData.quantity}" required>
                        <div class="quantity-info">
                            Available: ${inventoryData.quantity} | <span id="remainingAfterAssign">Remaining: 0</span>
                        </div>
                        <div id="assignDfnQuantityError" class="error-message" style="display: none; color: red; font-size: 0.9em; margin-top: 5px;"></div>
                    </div>
                ` : `
                    <div class="modal-form-group">
                        <div class="serialized-notice">
                            <strong>Serialized Item:</strong> All ${inventoryData.quantity} units will be assigned
                        </div>
                    </div>
                `}
                <div class="modal-form-group">
                    <label for="assignDfnNotes">Notes (Optional):</label>
                    <textarea id="assignDfnNotes" placeholder="Enter any notes about this assignment" rows="3"></textarea>
                </div>
                <div class="assign-dfn-warning">
                    <strong>Note:</strong> This will assign the item(s) to the selected DFN.
                    ${!isSerializedItem && isBulkItem ? ' Partial quantities are allowed for bulk items.' : ' The entire item will be assigned.'}
                </div>
            </div>
        `;

        // Info section
        const infoSection = ModalUtils.generateItemInfoSection(inventoryData, isSerializedItem, 'Current Quantity');

        // Two-column layout
        const twoColumnBody = `
            <div class="assign-dfn-two-column">
                <div class="assign-dfn-left-column">${formSection}</div>
                <div class="assign-dfn-right-column">${infoSection}</div>
            </div>
        `;

        // Create modal
        const modal = ModalUtils.createModal('assignDfnModal', {
            title: 'Assign DFN',
            className: 'modal-base assign-dfn-modal',
            body: twoColumnBody,
            buttons: [
                { id: 'cancelAssignDfnBtn', text: 'Cancel', className: 'assign-dfn-btn-secondary' },
                { id: 'executeAssignDfnBtn', text: 'Assign DFN', className: 'assign-dfn-btn-primary', disabled: true }
            ]
        });

        // Setup event listeners
        ModalUtils.setupModalEvents(modal, {
            closeHandlers: ['cancelAssignDfnBtn'],
            executeHandler: {
                id: 'executeAssignDfnBtn',
                handler: () => executeAssignDfnOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem)
            }
        });

        // Setup validation
        setupAssignDfnValidation(inventoryData, isSerializedItem, isBulkItem);

        // Setup auto-select for quantity input (for bulk items)
        if (!isSerializedItem && isBulkItem) {
            ModalUtils.setupQuantityAutoSelect('assignDfnQuantity');
        }

        // Focus on DFN dropdown
        setTimeout(() => {
            const dfnSelect = document.getElementById('assignDfn');
            if (dfnSelect) dfnSelect.focus();
        }, 100);

    } catch (error) {
        ModalUtils.handleError(error, 'showing assign DFN modal');
    }
}

/**
 * Setup validation for the assign DFN modal
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
function setupAssignDfnValidation(inventoryData, isSerializedItem, isBulkItem) {
    const dfnSelect = document.getElementById('assignDfn');
    const executeBtn = document.getElementById('executeAssignDfnBtn');
    const dfnError = document.getElementById('assignDfnError');
    let quantityInput = null;
    let quantityError = null;

    if (!isSerializedItem && isBulkItem) {
        quantityInput = document.getElementById('assignDfnQuantity');
        quantityError = document.getElementById('assignDfnQuantityError');
    }

    function validate() {
        let isValid = true;

        // Validate DFN selection
        if (!dfnSelect.value) {
            dfnError.textContent = 'Please select a DFN to assign';
            dfnError.style.display = 'block';
            isValid = false;
        } else {
            dfnError.style.display = 'none';
        }

        // Validate quantity for bulk items
        if (!isSerializedItem && isBulkItem && quantityInput && quantityError) {
            const assignQuantity = parseInt(quantityInput.value) || 0;
            const remaining = inventoryData.quantity - assignQuantity;
            const remainingSpan = document.getElementById('remainingAfterAssign');
            if (remainingSpan) remainingSpan.textContent = `Remaining: ${remaining}`;
            if (assignQuantity <= 0) {
                quantityError.textContent = 'Quantity must be greater than 0';
                quantityError.style.display = 'block';
                isValid = false;
            } else if (assignQuantity > inventoryData.quantity) {
                quantityError.textContent = 'Cannot assign more than current quantity';
                quantityError.style.display = 'block';
                isValid = false;
            } else {
                quantityError.style.display = 'none';
            }
        }

        executeBtn.disabled = !isValid;
        executeBtn.tabIndex = isValid ? 0 : -1;
    }

    dfnSelect.addEventListener('change', validate);
    if (!isSerializedItem && isBulkItem && quantityInput) {
        quantityInput.addEventListener('input', validate);
    }
    validate();
}

/**
 * Execute the assign DFN operation (Supabase version, includes transaction logging)
 * @param {string} inventoryId - Inventory item ID
 * @param {Object} inventoryData - Inventory item data
 * @param {boolean} isSerializedItem - Whether item is serialized
 * @param {boolean} isBulkItem - Whether item is bulk type
 */
async function executeAssignDfnOperation(inventoryId, inventoryData, isSerializedItem, isBulkItem) {
    try {
        const dfnSelect = document.getElementById('assignDfn');
        const notesTextarea = document.getElementById('assignDfnNotes');
        const newDfnId = dfnSelect.value;
        const notes = notesTextarea ? notesTextarea.value.trim() : '';

        // Validate DFN selection
        if (!newDfnId) {
            ModalUtils.handleError('Please select a DFN to assign');
            return;
        }

        let assignQuantity;
        if (isSerializedItem || !isBulkItem) {
            assignQuantity = inventoryData.quantity;
        } else {
            const quantityInput = document.getElementById('assignDfnQuantity');
            if (!quantityInput) {
                ModalUtils.handleError('Quantity input not found.');
                return;
            }
            assignQuantity = parseInt(quantityInput.value);
            if (isNaN(assignQuantity) || assignQuantity <= 0) {
                ModalUtils.handleError('Please enter a valid quantity to assign.');
                return;
            }
            if (assignQuantity > inventoryData.quantity) {
                ModalUtils.handleError('Cannot assign more units than currently available.');
                return;
            }
        }

        // Get DFN names for logging
        let newDfnName = getCachedRow('dfns', newDfnId)?.name || 'Unknown DFN';
        let currentDfnName = inventoryData.dfn_id ? (getCachedRow('dfns', inventoryData.dfn_id)?.name || 'Unknown DFN') : 'None';

        if (assignQuantity === inventoryData.quantity) {
            // Full assignment - update existing record
            await supabase.from('inventory').update({
                dfn_id: newDfnId
            }).eq('id', inventoryId);

            if (window.transactionLogger) {
                await window.transactionLogger.logInventoryUpdated(
                    inventoryId,
                    { dfn_name: currentDfnName },
                    { dfn_name: newDfnName },
                    [notes ? `DFN assigned: ${notes}` : 'DFN assigned']
                );
            }
        } else {
            // Partial assignment - reduce original quantity and create new record
            const remainingQuantity = inventoryData.quantity - assignQuantity;
            await supabase.from('inventory').update({
                quantity: remainingQuantity
            }).eq('id', inventoryId);

            const { data } = await supabase.from('inventory').insert([{
                ...inventoryData,
                id: undefined,
                dfn_id: newDfnId,
                quantity: assignQuantity
            }]).select('id').single();
            const newRecordId = data?.id;

            if (window.transactionLogger) {
                if (newRecordId) {
                    await window.transactionLogger.logInventoryCreated(newRecordId, {
                        ...inventoryData,
                        dfn_id: newDfnId,
                        quantity: assignQuantity
                    });
                }
                await window.transactionLogger.logQuantityAdjusted(
                    inventoryId,
                    inventoryData.quantity,
                    remainingQuantity,
                    notes ? `Partial DFN assignment: ${notes}` : 'Partial DFN assignment'
                );
            }
        }

        await ModalUtils.handleSuccess('assignDfnModal');
    } catch (error) {
        ModalUtils.handleError(error, 'assign DFN operation');
    }
}





















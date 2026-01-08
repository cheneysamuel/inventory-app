/**
 * Serialized Modal Helpers
 * 
 * Shared utilities for modal dialogs in serialized inventory operations.
 * Extracted from serialized-modals-actions.js to eliminate code duplication.
 */

(function() {
    'use strict';

    // ========================================
    // SOURCE VIEW DETECTION
    // ========================================

    /**
     * Detects the current source view (serialized, bulk, or from state)
     * @param {string|null} providedView - Optional pre-provided view name
     * @param {Object} state - Application state from Store
     * @returns {string} - Detected view name ('serialized', 'bulk', etc.)
     */
    function detectSourceView(providedView, state) {
        if (providedView) return providedView;
        
        // Check what view is currently active
        if (document.querySelector('.hierarchy-container')) return 'serialized';
        if (byId('bulk-items-table-container')) return 'bulk';
        return state.currentView; // fallback to state
    }

    // ========================================
    // SIGNATURE PAD UTILITIES
    // ========================================

    /**
     * Initializes a signature pad with proper canvas sizing
     * @param {HTMLCanvasElement} canvas - The canvas element for signature
     * @param {number} delay - Optional delay in ms before initialization (default 200)
     * @returns {SignaturePad|null} - Initialized SignaturePad instance or null if failed
     */
    function initializeSignaturePad(canvas, delay = 200, callback = null) {
        if (!canvas) {
            console.error('Cannot initialize signature pad: canvas element not found');
            return null;
        }

        let signaturePad = null;

        setTimeout(() => {
            // Function to properly resize canvas for high DPI displays
            function resizeCanvas() {
                const ratio = Math.max(window.devicePixelRatio || 1, 1);
                const rect = canvas.getBoundingClientRect();
                
                canvas.width = rect.width * ratio;
                canvas.height = rect.height * ratio;
                canvas.getContext('2d').scale(ratio, ratio);
            }
            
            resizeCanvas();
            
            signaturePad = new SignaturePad(canvas, {
                backgroundColor: 'rgb(255, 255, 255)',
                penColor: 'rgb(0, 0, 0)'
            });
            
            // Invoke callback with initialized pad if provided
            if (callback && typeof callback === 'function') {
                callback(signaturePad);
            }
        }, delay);

        return signaturePad;
    }

    /**
     * Gets signature data URL from signature pad
     * @param {SignaturePad} signaturePad - SignaturePad instance
     * @returns {string|null} - Base64 data URL or null if empty/invalid
     */
    function getSignatureDataUrl(signaturePad) {
        if (!signaturePad) {
            console.warn('Signature pad not initialized');
            return null;
        }

        if (signaturePad.isEmpty()) {
            return null;
        }

        return signaturePad.toDataURL();
    }

    /**
     * Clears the signature pad
     * @param {SignaturePad} signaturePad - SignaturePad instance
     */
    function clearSignaturePad(signaturePad) {
        if (signaturePad) {
            signaturePad.clear();
        }
    }

    // ========================================
    // SELECTION FILTERING
    // ========================================

    /**
     * Filters crews based on selected market
     * @param {Array} crews - All crews from state
     * @param {Object|null} selectedMarket - Currently selected market
     * @returns {Array} - Filtered crew list
     */
    function filterCrewsByMarket(crews, selectedMarket) {
        if (!crews) return [];
        if (!selectedMarket) return crews;
        
        return crews.filter(c => c.market_id === selectedMarket.id);
    }

    /**
     * Filters areas based on selected SLOC
     * @param {Array} areas - All areas from state
     * @param {Object|null} selectedSloc - Currently selected SLOC
     * @returns {Array} - Filtered area list
     */
    function filterAreasBySloc(areas, selectedSloc) {
        if (!areas) return [];
        if (!selectedSloc) return areas;
        
        return areas.filter(a => a.sloc_id === selectedSloc.id);
    }

    /**
     * Filters both crews and areas based on current selections
     * @param {Object} state - Application state from Store
     * @returns {Object} - { crews: [], areas: [] }
     */
    function filterSelectionsFromState(state) {
        return {
            crews: filterCrewsByMarket(state.crews || [], state.selectedMarket),
            areas: filterAreasBySloc(state.areas || [], state.selectedSloc)
        };
    }

    // ========================================
    // BULK ITEM UTILITIES
    // ========================================

    /**
     * Checks if items represent a single bulk item (not serialized)
     * @param {Array} items - Array of inventory items
     * @param {Object} state - Application state from Store
     * @returns {boolean} - True if single bulk item
     */
    function isSingleBulkItem(items, state) {
        if (!items || items.length !== 1) return false;
        
        const item = items[0];
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        
        return itemType && itemType.inventory_type_id === 2; // 2 = Bulk inventory type
    }

    /**
     * Initializes quantity tracking object for bulk items
     * @param {Array} items - Array of inventory items
     * @returns {Object} - Map of item_id -> quantity
     */
    function initializeIssueQuantities(items) {
        const quantities = {};
        items.forEach(item => {
            quantities[item.id] = item.quantity || 1;
        });
        return quantities;
    }

    /**
     * Calculates total quantity across all items
     * @param {Array} items - Array of inventory items
     * @returns {number} - Total quantity
     */
    function calculateTotalQuantity(items) {
        if (!items) return 0;
        return items.reduce((sum, item) => sum + (item.quantity || 1), 0);
    }

    // ========================================
    // SELECT ELEMENT POPULATION
    // ========================================

    /**
     * Populates a select element with options
     * @param {HTMLSelectElement} selectElement - The select element to populate
     * @param {Array} items - Array of items to add as options
     * @param {string} valueProp - Property to use as option value
     * @param {string} textProp - Property to use as option text
     * @param {string} placeholderText - Text for default placeholder option
     * @param {any} selectedValue - Optional value to pre-select
     */
    function populateSelect(selectElement, items, valueProp, textProp, placeholderText, selectedValue = null) {
        if (!selectElement) return;
        
        selectElement.innerHTML = `<option value="">${placeholderText}</option>`;
        
        items.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueProp];
            option.textContent = item[textProp];
            if (selectedValue !== null && item[valueProp] === selectedValue) {
                option.selected = true;
            }
            selectElement.appendChild(option);
        });
    }

    /**
     * Populates crew select element
     * @param {HTMLSelectElement} selectElement - The select element
     * @param {Array} crews - Filtered crew list
     * @param {number|null} selectedCrewId - Optional pre-selected crew ID
     */
    function populateCrewSelect(selectElement, crews, selectedCrewId = null) {
        populateSelect(selectElement, crews, 'id', 'name', 'Select Crew...', selectedCrewId);
    }

    /**
     * Populates area select element
     * @param {HTMLSelectElement} selectElement - The select element
     * @param {Array} areas - Filtered area list
     * @param {number|null} selectedAreaId - Optional pre-selected area ID
     */
    function populateAreaSelect(selectElement, areas, selectedAreaId = null) {
        populateSelect(selectElement, areas, 'id', 'name', 'Select Area...', selectedAreaId);
    }

    // ========================================
    // ACTION CONFIGURATION
    // ========================================

    /**
     * Gets action configuration including color and validation rules
     * @param {string} action - Action name ('issue', 'receive', 'return', etc.)
     * @returns {Object} - { color, requiresCrew, requiresArea, etc. }
     */
    function getActionConfig(action) {
        const configs = {
            'issue': {
                color: '#e74c3c',
                label: 'Issue',
                requiresCrew: true,
                requiresArea: false,
                requiresSignature: true
            },
            'receive': {
                color: '#27ae60',
                label: 'Receive',
                requiresCrew: false,
                requiresArea: false,
                requiresSignature: true
            },
            'return': {
                color: '#3498db',
                label: 'Return',
                requiresCrew: false,
                requiresArea: false,
                requiresSignature: true
            },
            'field_install': {
                color: '#9b59b6',
                label: 'Field Install',
                requiresCrew: false,
                requiresArea: true,
                requiresSignature: true
            },
            'transfer': {
                color: '#f39c12',
                label: 'Transfer',
                requiresCrew: false,
                requiresArea: true,
                requiresSignature: true
            },
            'dispose': {
                color: '#95a5a6',
                label: 'Dispose',
                requiresCrew: false,
                requiresArea: false,
                requiresSignature: true
            }
        };

        return configs[action] || {
            color: '#34495e',
            label: action,
            requiresCrew: false,
            requiresArea: false,
            requiresSignature: false
        };
    }

    // ========================================
    // VALIDATION UTILITIES
    // ========================================

    /**
     * Validates required selections for an action
     * @param {Object} params - { action, selectedCrew, selectedArea }
     * @returns {Object} - { valid: boolean, message: string }
     */
    function validateActionSelections(params) {
        const { action, selectedCrew, selectedArea } = params;
        const config = getActionConfig(action);

        if (config.requiresCrew && !selectedCrew) {
            return { valid: false, message: 'Please select a crew' };
        }

        if (config.requiresArea && !selectedArea) {
            return { valid: false, message: 'Please select an area' };
        }

        return { valid: true, message: '' };
    }

    /**
     * Validates signature requirement
     * @param {SignaturePad} signaturePad - SignaturePad instance
     * @param {string} action - Action name
     * @returns {Object} - { valid: boolean, message: string }
     */
    function validateSignature(signaturePad, action) {
        const config = getActionConfig(action);

        if (config.requiresSignature && (!signaturePad || signaturePad.isEmpty())) {
            return { valid: false, message: 'Please provide a signature' };
        }

        return { valid: true, message: '' };
    }

    // ========================================
    // DOM UTILITIES
    // ========================================

    /**
     * Extracts first element from a DocumentFragment
     * @param {DocumentFragment} fragment - Template fragment
     * @returns {Element|null} - First element or null if failed
     */
    function extractElementFromFragment(fragment) {
        if (!fragment) return null;
        
        const tempDiv = document.createElement('div');
        tempDiv.appendChild(fragment);
        
        return tempDiv.firstElementChild;
    }

    /**
     * Safely queries a selector within a container
     * @param {Element} container - Container element
     * @param {string} selector - CSS selector
     * @returns {Element|null} - Found element or null
     */
    function safeQuerySelector(container, selector) {
        if (!container || typeof container.querySelector !== 'function') {
            console.error('Invalid container for querySelector:', container);
            return null;
        }
        return container.querySelector(selector);
    }

    // ========================================
    // EXPORTS
    // ========================================

    // Build item details section for Adjust modal
    function buildAdjustItemDetailsSection(item, state) {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const status = state.statuses.find(s => s.id === item.status_id);
        const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
        const area = state.areas?.find(a => a.id === item.area_id);
        
        return div({ style: { marginBottom: '1.5rem', padding: '1rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
            createElement('h4', { style: { margin: '0 0 0.75rem 0' } }, ['Item Details']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                createElement('div', {}, [
                    createElement('strong', {}, ['Item Type: ']),
                    createElement('span', {}, [itemType?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Current Quantity: ']),
                    createElement('span', {}, [String(item.quantity || 1)])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Location: ']),
                    createElement('span', {}, [location?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Status: ']),
                    createElement('span', {}, [status?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Crew: ']),
                    createElement('span', {}, [crew?.name || 'Unassigned'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Area: ']),
                    createElement('span', {}, [area?.name || 'Unassigned'])
                ])
            ])
        ]);
    }

    // Build adjustment input section for Adjust modal
    function buildAdjustmentInputSection(item) {
        let newQuantity = item.quantity || 1;
        let comment = '';
        
        const quantityInput = createElement('input', {
            type: 'text',
            id: 'adjust-quantity-input',
            className: 'form-control',
            value: String(item.quantity || 1),
            style: { fontSize: '18px', padding: '8px', width: '200px' },
            oninput: (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                newQuantity = parseInt(e.target.value) || item.quantity || 1;
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9]/g, '');
                e.target.value = numericOnly;
                newQuantity = parseInt(numericOnly) || item.quantity || 1;
            }
        });
        
        const commentInput = createElement('textarea', {
            id: 'adjust-comment-input',
            className: 'form-control',
            placeholder: 'Enter reason for adjustment (minimum 5 characters required)',
            rows: 2,
            style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' },
            oninput: (e) => {
                comment = e.target.value;
            }
        });
        
        return div({ style: { marginBottom: '0.5rem' } }, [
            div({ style: { marginBottom: '0.75rem' } }, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['New Quantity:']),
                quantityInput
            ]),
            div({}, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Comment (required, min 5 characters):']),
                commentInput
            ])
        ]);
    }

    // Create modal actions for Adjust modal
    function createAdjustModalActions(item) {
        return [
            {
                label: 'Save',
                type: 'primary',
                handler: async () => {
                    const quantityInput = document.getElementById('adjust-quantity-input');
                    const commentInput = document.getElementById('adjust-comment-input');
                    
                    const newQuantity = parseInt(quantityInput?.value) || item.quantity || 1;
                    const comment = commentInput?.value?.trim() || '';
                    
                    // Validate comment
                    if (!comment || comment.length < 5) {
                        Components.showToast('Comment must be at least 5 characters', 'error');
                        commentInput?.focus();
                        return;
                    }
                    
                    // Validate quantity changed
                    if (newQuantity === (item.quantity || 1)) {
                        Components.showToast('Quantity must be different from current quantity', 'error');
                        quantityInput?.focus();
                        return;
                    }
                    
                    Modals.close();
                    await executeAdjustAction(item, newQuantity, comment);
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => Modals.close()
            }
        ];
    }

    // Build item details section for Reject modal
    function buildRejectItemDetailsSection(item, state, isBulkItem) {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const status = state.statuses.find(s => s.id === item.status_id);
        const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
        const area = state.areas?.find(a => a.id === item.area_id);
        
        return div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                createElement('div', {}, [
                    createElement('strong', {}, ['Item Type: ']),
                    createElement('span', {}, [itemType?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Current Quantity: ']),
                    createElement('span', {}, [String(item.quantity || 1)])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Location: ']),
                    createElement('span', {}, [location?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Status: ']),
                    createElement('span', {}, [status?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Crew: ']),
                    createElement('span', {}, [crew?.name || 'Unassigned'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Area: ']),
                    createElement('span', {}, [area?.name || 'Unassigned'])
                ])
            ])
        ]);
    }

    // Build rejection input section for Reject modal
    function buildRejectInputSection(item, isBulkItem) {
        let rejectQuantity = item.quantity || 1;
        let quantitySection = null;
        
        if (isBulkItem) {
            const quantityInput = createElement('input', {
                type: 'text',
                id: 'reject-quantity-input',
                className: 'form-control',
                value: String(item.quantity || 1),
                style: { fontSize: '18px', padding: '8px', width: '200px' },
                oninput: (e) => {
                    e.target.value = e.target.value.replace(/[^0-9]/g, '');
                    rejectQuantity = parseInt(e.target.value) || item.quantity || 1;
                },
                onpaste: (e) => {
                    e.preventDefault();
                    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                    const numericOnly = pastedText.replace(/[^0-9]/g, '');
                    e.target.value = numericOnly;
                    rejectQuantity = parseInt(numericOnly) || item.quantity || 1;
                }
            });
            
            quantitySection = div({ style: { marginBottom: '0.75rem' } }, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Reject Quantity:']),
                quantityInput,
                createElement('span', { style: { marginLeft: '5px' } }, [` of ${item.quantity || 1}`])
            ]);
        }
        
        const commentInput = createElement('textarea', {
            id: 'reject-comment-input',
            className: 'form-control',
            placeholder: 'Enter reason for rejection (minimum 5 characters required)',
            rows: 2,
            style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' }
        });
        
        return div({ style: { marginBottom: '0.5rem' } }, [
            quantitySection,
            div({}, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Rejection Reason (required, min 5 characters):']),
                commentInput
            ])
        ].filter(Boolean));
    }

    // Create modal actions for Reject modal
    function createRejectModalActions(item, isBulkItem) {
        return [
            {
                label: 'Complete Rejection',
                type: 'primary',
                handler: async () => {
                    const commentTextarea = document.getElementById('reject-comment-input');
                    const finalComment = commentTextarea?.value?.trim() || '';
                    
                    if (finalComment.length < 5) {
                        Components.showToast('Rejection reason must be at least 5 characters long', 'error');
                        commentTextarea?.focus();
                        return;
                    }
                    
                    let finalQuantity = item.quantity || 1;
                    if (isBulkItem) {
                        const qtyInput = document.getElementById('reject-quantity-input');
                        finalQuantity = parseInt(qtyInput?.value || '');
                        
                        if (isNaN(finalQuantity) || finalQuantity < 1) {
                            Components.showToast('Please enter a valid quantity (1 or greater)', 'error');
                            qtyInput?.focus();
                            return;
                        }
                        
                        if (finalQuantity > item.quantity) {
                            Components.showToast(`Reject quantity cannot exceed available quantity (${item.quantity})`, 'error');
                            qtyInput?.focus();
                            return;
                        }
                    }
                    
                    Modals.close();
                    await executeRejectAction(item, finalQuantity, finalComment, isBulkItem);
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => Modals.close()
            }
        ];
    }

    // Build item details section for Inspect modal
    function buildInspectItemDetailsSection(item, state, isBulkItem) {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const status = state.statuses.find(s => s.id === item.status_id);
        const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
        const area = state.areas?.find(a => a.id === item.area_id);
        const totalAvailable = item.quantity || 1;
        
        return div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                createElement('div', {}, [
                    createElement('strong', {}, ['Item Type: ']),
                    createElement('span', {}, [itemType?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, [isBulkItem ? 'Total Available: ' : 'Quantity: ']),
                    createElement('span', {}, [String(totalAvailable)])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Location: ']),
                    createElement('span', {}, [location?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Status: ']),
                    createElement('span', {}, [status?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Crew: ']),
                    createElement('span', {}, [crew?.name || 'Unassigned'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Area: ']),
                    createElement('span', {}, [area?.name || 'Unassigned'])
                ])
            ])
        ]);
    }

    // Build inspection input section for Inspect modal (bulk items)
    function buildBulkInspectionInputSection(totalAvailable) {
        const updateTotals = () => {
            const passed = parseInt(document.getElementById('inspect-passed-input')?.value) || 0;
            const rejected = parseInt(document.getElementById('inspect-rejected-input')?.value) || 0;
            const inspected = passed + rejected;
            const uninspected = totalAvailable - inspected;
            const hasError = inspected > totalAvailable;
            
            const inspectedSpan = document.getElementById('inspect-total-inspected');
            const uninspectedSpan = document.getElementById('inspect-total-uninspected');
            const errorMsg = document.getElementById('inspect-error-message');
            const completeBtn = document.querySelector('.btn-primary');
            
            if (inspectedSpan) inspectedSpan.textContent = String(inspected);
            if (uninspectedSpan) uninspectedSpan.textContent = String(uninspected);
            
            if (errorMsg) {
                if (hasError) {
                    errorMsg.textContent = `Error: Total inspected (${inspected}) exceeds total available (${totalAvailable})`;
                    errorMsg.style.display = 'block';
                } else {
                    errorMsg.style.display = 'none';
                }
            }
            
            if (completeBtn) {
                completeBtn.disabled = hasError;
                completeBtn.style.opacity = hasError ? '0.5' : '1';
                completeBtn.style.cursor = hasError ? 'not-allowed' : 'pointer';
            }
        };
        
        const passedInput = createElement('input', {
            type: 'text',
            id: 'inspect-passed-input',
            className: 'form-control',
            value: '0',
            style: { fontSize: '18px', padding: '8px', width: '200px' },
            oninput: (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                updateTotals();
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9]/g, '');
                e.target.value = numericOnly;
                updateTotals();
            }
        });
        
        const rejectedInput = createElement('input', {
            type: 'text',
            id: 'inspect-rejected-input',
            className: 'form-control',
            value: '0',
            style: { fontSize: '18px', padding: '8px', width: '200px' },
            oninput: (e) => {
                e.target.value = e.target.value.replace(/[^0-9]/g, '');
                updateTotals();
            },
            onpaste: (e) => {
                e.preventDefault();
                const pastedText = (e.clipboardData || window.clipboardData).getData('text');
                const numericOnly = pastedText.replace(/[^0-9]/g, '');
                e.target.value = numericOnly;
                updateTotals();
            }
        });
        
        return div({ style: { marginBottom: '0.5rem' } }, [
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '0.75rem' } }, [
                div({}, [
                    createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Passed Units:']),
                    passedInput
                ]),
                div({}, [
                    createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Rejected Units:']),
                    rejectedInput
                ])
            ]),
            div({ style: { padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', border: '1px solid #3b82f6' } }, [
                createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Inspection Summary:']),
                div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', fontSize: '0.875rem' } }, [
                    div({}, [
                        createElement('strong', {}, ['Total Available: ']),
                        createElement('span', {}, [String(totalAvailable)])
                    ]),
                    div({}, [
                        createElement('strong', {}, ['Inspected: ']),
                        createElement('span', { id: 'inspect-total-inspected' }, ['0'])
                    ]),
                    div({}, [
                        createElement('strong', {}, ['Uninspected: ']),
                        createElement('span', { id: 'inspect-total-uninspected' }, [String(totalAvailable)])
                    ])
                ])
            ]),
            createElement('div', {
                id: 'inspect-error-message',
                style: {
                    display: 'none',
                    marginTop: '0.5rem',
                    padding: '0.5rem',
                    backgroundColor: '#fee2e2',
                    color: '#991b1b',
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                    fontWeight: '500'
                }
            }, [])
        ]);
    }

    // Build inspection section for serialized items
    function buildSerializedInspectionSection() {
        return div({ style: { marginBottom: '0.5rem', padding: '0.5rem', backgroundColor: '#eff6ff', borderRadius: '0.375rem', border: '1px solid #3b82f6' } }, [
            createElement('p', { style: { margin: 0, fontSize: '1rem' } }, [
                'This serialized item will be marked as ',
                createElement('strong', {}, ['Available']),
                ' after inspection confirmation.'
            ])
        ]);
    }

    // Create modal actions for Inspect modal
    function createInspectModalActions(item, isBulkItem, totalAvailable) {
        return [
            {
                label: 'Complete Inspection',
                type: 'primary',
                handler: async () => {
                    if (isBulkItem) {
                        const passed = parseInt(document.getElementById('inspect-passed-input')?.value) || 0;
                        const rejected = parseInt(document.getElementById('inspect-rejected-input')?.value) || 0;
                        const inspected = passed + rejected;
                        
                        if (inspected === 0) {
                            Components.showToast('Please enter passed and/or rejected units', 'error');
                            return;
                        }
                        
                        if (inspected > totalAvailable) {
                            Components.showToast(`Total inspected (${inspected}) exceeds total available (${totalAvailable})`, 'error');
                            return;
                        }
                        
                        Modals.close();
                        await executeInspectAction(item, passed, rejected, true);
                    } else {
                        Modals.close();
                        await executeInspectAction(item, 1, 0, false);
                    }
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => Modals.close()
            }
        ];
    }

    // Build item details section for Remove modal
    function buildRemoveItemDetailsSection(item, state) {
        const itemType = state.itemTypes.find(it => it.id === item.item_type_id);
        const location = state.locations.find(l => l.id === item.location_id);
        const status = state.statuses.find(s => s.id === item.status_id);
        const crew = state.crews?.find(c => c.id === item.assigned_crew_id);
        const area = state.areas?.find(a => a.id === item.area_id);
        
        return div({ style: { marginBottom: '0.75rem', padding: '0.5rem', backgroundColor: '#f9fafb', borderRadius: '0.375rem', border: '1px solid #e5e7eb' } }, [
            createElement('h4', { style: { margin: '0 0 0.5rem 0', fontSize: '1rem' } }, ['Item Details']),
            div({ style: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' } }, [
                createElement('div', {}, [
                    createElement('strong', {}, ['Item Type: ']),
                    createElement('span', {}, [itemType?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Quantity: ']),
                    createElement('span', {}, [String(item.quantity || 1)])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Current Location: ']),
                    createElement('span', {}, [location?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Status: ']),
                    createElement('span', {}, [status?.name || 'Unknown'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Crew: ']),
                    createElement('span', {}, [crew?.name || 'Unassigned'])
                ]),
                createElement('div', {}, [
                    createElement('strong', {}, ['Area: ']),
                    createElement('span', {}, [area?.name || 'Unassigned'])
                ])
            ])
        ]);
    }

    // Build removal input section for Remove modal
    function buildRemovalInputSection(outgoingLocations) {
        const locationOptions = [
            createElement('option', { value: '' }, ['-- Select Outgoing Location --'])
        ];
        outgoingLocations.forEach(loc => {
            locationOptions.push(createElement('option', { value: String(loc.id) }, [loc.name]));
        });
        
        const locationDropdown = createElement('select', {
            id: 'remove-location-select',
            className: 'form-control',
            style: { fontSize: '18px', padding: '8px', width: '100%' }
        }, locationOptions);
        
        const commentInput = createElement('textarea', {
            id: 'remove-comment-input',
            className: 'form-control',
            placeholder: 'Enter reason for removal (minimum 10 characters required)',
            rows: 2,
            style: { fontSize: '18px', padding: '8px', width: '100%', resize: 'vertical' }
        });
        
        return div({ style: { marginBottom: '0.5rem' } }, [
            div({ style: { marginBottom: '0.75rem' } }, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Move To (Outgoing Location):']),
                locationDropdown
            ]),
            div({}, [
                createElement('label', { style: { display: 'block', marginBottom: '0.25rem', fontWeight: '500' } }, ['Removal Reason (required, min 10 characters):']),
                commentInput
            ])
        ]);
    }

    // Create modal actions for Remove modal
    function createRemoveModalActions(item) {
        return [
            {
                label: 'Complete Removal',
                type: 'primary',
                handler: async () => {
                    const locationSelect = document.getElementById('remove-location-select');
                    const commentTextarea = document.getElementById('remove-comment-input');
                    
                    const finalLocationId = locationSelect?.value ? parseInt(locationSelect.value) : null;
                    const finalComment = commentTextarea?.value?.trim() || '';
                    
                    if (!finalLocationId) {
                        Components.showToast('Please select an outgoing location', 'error');
                        locationSelect?.focus();
                        return;
                    }
                    
                    if (finalComment.length < 10) {
                        Components.showToast('Removal reason must be at least 10 characters long', 'error');
                        commentTextarea?.focus();
                        return;
                    }
                    
                    Modals.close();
                    await executeRemoveAction(item, finalLocationId, finalComment);
                }
            },
            {
                label: 'Cancel',
                type: 'secondary',
                handler: () => Modals.close()
            }
        ];
    }

    window.SerializedModalHelpers = {
        // Source view
        detectSourceView,
        
        // Signature pad
        initializeSignaturePad,
        getSignatureDataUrl,
        clearSignaturePad,
        
        // Selection filtering
        filterCrewsByMarket,
        filterAreasBySloc,
        filterSelectionsFromState,
        
        // Bulk items
        isSingleBulkItem,
        initializeIssueQuantities,
        calculateTotalQuantity,
        
        // Select population
        populateSelect,
        populateCrewSelect,
        populateAreaSelect,
        
        // Action config
        getActionConfig,
        
        // Validation
        validateActionSelections,
        validateSignature,
        
        // DOM utilities
        extractElementFromFragment,
        safeQuerySelector,
        
        // Adjust modal
        buildAdjustItemDetailsSection,
        buildAdjustmentInputSection,
        createAdjustModalActions,
        
        // Reject modal
        buildRejectItemDetailsSection,
        buildRejectInputSection,
        createRejectModalActions,
        
        // Inspect modal
        buildInspectItemDetailsSection,
        buildBulkInspectionInputSection,
        buildSerializedInspectionSection,
        createInspectModalActions,
        
        // Remove modal
        buildRemoveItemDetailsSection,
        buildRemovalInputSection,
        createRemoveModalActions
    };

})();

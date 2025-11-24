/**
 * Validation Service
 * Input validation and business logic validation
 */

const ValidationService = (() => {
    
    // Validate required fields
    const required = (value, fieldName = 'Field') => {
        if (isNil(value) || (isString(value) && trim(value) === '')) {
            return Result.error(`${fieldName} is required`);
        }
        return Result.ok(value);
    };
    
    // Validate number
    const isValidNumber = (value, fieldName = 'Field') => {
        if (!isNumber(Number(value)) || isNaN(value)) {
            return Result.error(`${fieldName} must be a valid number`);
        }
        return Result.ok(Number(value));
    };
    
    // Validate positive number
    const isPositiveNumber = (value, fieldName = 'Field') => {
        const numResult = isValidNumber(value, fieldName);
        if (!numResult.isOk) return numResult;
        
        if (numResult.value <= 0) {
            return Result.error(`${fieldName} must be greater than 0`);
        }
        return Result.ok(numResult.value);
    };
    
    // Validate integer
    const isInteger = (value, fieldName = 'Field') => {
        const numResult = isValidNumber(value, fieldName);
        if (!numResult.isOk) return numResult;
        
        if (!Number.isInteger(numResult.value)) {
            return Result.error(`${fieldName} must be an integer`);
        }
        return Result.ok(numResult.value);
    };
    
    // Validate range
    const inRange = (value, min, max, fieldName = 'Field') => {
        const numResult = isValidNumber(value, fieldName);
        if (!numResult.isOk) return numResult;
        
        if (numResult.value < min || numResult.value > max) {
            return Result.error(`${fieldName} must be between ${min} and ${max}`);
        }
        return Result.ok(numResult.value);
    };
    
    // Validate string length
    const hasLength = (value, min, max, fieldName = 'Field') => {
        if (!isString(value)) {
            return Result.error(`${fieldName} must be a string`);
        }
        
        const len = value.length;
        if (len < min || len > max) {
            return Result.error(`${fieldName} must be between ${min} and ${max} characters`);
        }
        return Result.ok(value);
    };
    
    // Validate matches pattern
    const matches = (value, pattern, fieldName = 'Field', patternDescription = 'pattern') => {
        if (!test(pattern, value)) {
            return Result.error(`${fieldName} must match ${patternDescription}`);
        }
        return Result.ok(value);
    };
    
    // Combine multiple validators
    const validate = (value, validators) => {
        for (const validator of validators) {
            const result = validator(value);
            if (!result.isOk) return result;
        }
        return Result.ok(value);
    };
    
    // Validate form data
    const validateForm = (formData, rules) => {
        const errors = {};
        let isValid = true;
        
        Object.entries(rules).forEach(([field, validators]) => {
            const value = formData[field];
            const result = validate(value, validators);
            
            if (!result.isOk) {
                errors[field] = result.error.message;
                isValid = false;
            }
        });
        
        return isValid 
            ? Result.ok(formData)
            : Result.error({ isValid: false, errors });
    };
    
    // Business logic validators
    const business = {
        // Validate sufficient inventory quantity
        hasSufficientQuantity: (inventoryItem, requestedQty) => {
            if (inventoryItem.quantity < requestedQty) {
                return Result.error(
                    `Insufficient quantity. Available: ${inventoryItem.quantity}, Requested: ${requestedQty}`
                );
            }
            return Result.ok(inventoryItem);
        },
        
        // Validate status transition
        isValidStatusTransition: (fromStatus, toStatus, allowedTransitions) => {
            const allowed = allowedTransitions[fromStatus] || [];
            if (!allowed.includes(toStatus)) {
                return Result.error(
                    `Invalid status transition from ${fromStatus} to ${toStatus}`
                );
            }
            return Result.ok(toStatus);
        },
        
        // Validate context selection
        hasValidContext: (state) => {
            if (!state.selectedClient) {
                return Result.error('Please select a client');
            }
            if (!state.selectedMarket) {
                return Result.error('Please select a market');
            }
            if (!state.selectedSloc) {
                return Result.error('Please select a SLOC');
            }
            return Result.ok(state);
        },
        
        // Validate unique serial number
        isUniqueSerialNumber: (serialNumber, existingInventory) => {
            const exists = existingInventory.some(item => 
                item.mfgrsn === serialNumber || item.tilsonsn === serialNumber
            );
            
            if (exists) {
                return Result.error(`Serial number ${serialNumber} already exists`);
            }
            return Result.ok(serialNumber);
        },
        
        // Validate item type for inventory type
        isCorrectInventoryType: (itemType, expectedType) => {
            if (itemType.inventory_type_id !== expectedType) {
                return Result.error(
                    `Item type must be ${expectedType === 1 ? 'Serialized' : 'Bulk'}`
                );
            }
            return Result.ok(itemType);
        }
    };
    
    // Common validation rule sets
    const rules = {
        inventoryItem: {
            item_type_id: [
                value => required(value, 'Item Type'),
                value => isPositiveNumber(value, 'Item Type')
            ],
            quantity: [
                value => required(value, 'Quantity'),
                value => isPositiveNumber(value, 'Quantity'),
                value => isInteger(value, 'Quantity')
            ],
            location_id: [
                value => required(value, 'Location'),
                value => isPositiveNumber(value, 'Location')
            ],
            status_id: [
                value => required(value, 'Status'),
                value => isPositiveNumber(value, 'Status')
            ]
        },
        
        itemType: {
            name: [
                value => required(value, 'Name'),
                value => hasLength(value, 1, 255, 'Name')
            ],
            inventory_type_id: [
                value => required(value, 'Inventory Type'),
                value => isPositiveNumber(value, 'Inventory Type')
            ],
            unit_of_measure_id: [
                value => required(value, 'Unit of Measure'),
                value => isPositiveNumber(value, 'Unit of Measure')
            ],
            units_per_package: [
                value => required(value, 'Units Per Package'),
                value => isPositiveNumber(value, 'Units Per Package'),
                value => isInteger(value, 'Units Per Package')
            ],
            provider_id: [
                value => required(value, 'Provider'),
                value => isPositiveNumber(value, 'Provider')
            ],
            market_id: [
                value => required(value, 'Market'),
                value => isPositiveNumber(value, 'Market')
            ]
        },
        
        crew: {
            name: [
                value => required(value, 'Name'),
                value => hasLength(value, 1, 255, 'Name')
            ],
            market_id: [
                value => required(value, 'Market'),
                value => isPositiveNumber(value, 'Market')
            ]
        },
        
        area: {
            name: [
                value => required(value, 'Name'),
                value => hasLength(value, 1, 255, 'Name')
            ],
            sloc_id: [
                value => required(value, 'SLOC'),
                value => isPositiveNumber(value, 'SLOC')
            ]
        }
    };
    
    return {
        required,
        isValidNumber,
        isPositiveNumber,
        isInteger,
        inRange,
        hasLength,
        matches,
        validate,
        validateForm,
        business,
        rules
    };
})();

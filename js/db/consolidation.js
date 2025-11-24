// Auto-consolidation for bulk inventory records
// Automatically merges duplicate bulk inventory records after operations

const Consolidation = (() => {
    /**
     * Consolidate duplicate bulk inventory records
     * Finds records with matching: location_id, assigned_crew_id, area_id, item_type_id, status_id
     * Merges them by summing quantities and keeping one record
     * @param {number} slocId - SLOC to consolidate within
     * @returns {Object} Result with consolidation stats
     */
    const consolidateBulkInventory = async (slocId) => {
        try {
            // Get all bulk inventory for this SLOC (no serial numbers)
            const inventoryResult = await Database.select('inventory', {
                filter: { sloc_id: slocId },
                order: { column: 'id', ascending: true }
            });
            
            if (!inventoryResult.isOk) {
                return inventoryResult;
            }
            
            const allInventory = inventoryResult.value || [];
            
            // Filter to bulk items only (no mfgrsn or tilsonsn)
            const bulkInventory = allInventory.filter(item => 
                !item.mfgrsn && !item.tilsonsn
            );
            
            // Group by equivalency signature
            const groups = {};
            
            for (const item of bulkInventory) {
                // Create equivalency key
                const key = [
                    item.location_id,
                    item.assigned_crew_id || 'null',
                    item.area_id || 'null',
                    item.item_type_id,
                    item.status_id
                ].join('|');
                
                if (!groups[key]) {
                    groups[key] = [];
                }
                groups[key].push(item);
            }
            
            // Find groups with duplicates
            const duplicateGroups = Object.values(groups).filter(group => group.length > 1);
            
            if (duplicateGroups.length === 0) {
                return {
                    isOk: true,
                    value: {
                        consolidated: 0,
                        deleted: 0
                    }
                };
            }
            
            let consolidatedCount = 0;
            let deletedCount = 0;
            
            // Process each duplicate group
            for (const group of duplicateGroups) {
                // Sort by ID to keep the oldest record
                group.sort((a, b) => a.id - b.id);
                
                const keepRecord = group[0];
                const duplicates = group.slice(1);
                
                // Sum all quantities
                const totalQuantity = group.reduce((sum, item) => sum + (item.quantity || 0), 0);
                
                // Update the record we're keeping with total quantity
                const updateResult = await Database.update('inventory', keepRecord.id, {
                    quantity: totalQuantity,
                    updated_at: getLocalTimestamp()
                });
                
                if (!updateResult.isOk) {
                    console.error('Consolidation failed to update record', keepRecord.id, ':', updateResult.error);
                    continue;
                }
                
                // Delete the duplicate records
                for (const duplicate of duplicates) {
                    const deleteResult = await Database.deleteRecord('inventory', duplicate.id);
                    if (deleteResult.isOk) {
                        deletedCount++;
                    } else {
                        console.error('Consolidation failed to delete record', duplicate.id, ':', deleteResult.error);
                    }
                }
                
                consolidatedCount++;
            }
            
            return {
                isOk: true,
                value: {
                    consolidated: consolidatedCount,
                    deleted: deletedCount
                }
            };
            
        } catch (error) {
            console.error('❌ [Consolidation] Error:', error);
            return {
                isOk: false,
                error: error.message || 'Consolidation failed'
            };
        }
    };
    
    return {
        consolidateBulkInventory
    };
})();

// Make available globally
if (typeof window !== 'undefined') {
    window.Consolidation = Consolidation;
}

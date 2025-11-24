-- Populate item_type_markets link table with existing item_types
-- This script associates all current item_types with their markets based on the market_id field

-- Insert all item_types with their associated markets
-- Setting is_primary = true since these are the originating markets
INSERT INTO item_type_markets (item_type_id, market_id, is_primary, created_at)
SELECT 
    id AS item_type_id,
    market_id,
    true AS is_primary,
    NOW() AS created_at
FROM item_types
WHERE market_id IS NOT NULL
ON CONFLICT (item_type_id, market_id) DO NOTHING;

-- Verify the inserts
SELECT 
    itm.id,
    itm.item_type_id,
    it.name AS item_type_name,
    itm.market_id,
    m.name AS market_name,
    itm.is_primary,
    itm.created_at
FROM item_type_markets itm
JOIN item_types it ON itm.item_type_id = it.id
JOIN markets m ON itm.market_id = m.id
ORDER BY itm.item_type_id, itm.market_id;

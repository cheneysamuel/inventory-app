-- Fix sequences for all tables that have auto-incrementing IDs
-- Run this in Supabase SQL Editor to reset sequences to the correct values

-- Fix clients sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'clients_id_seq') THEN
        PERFORM setval('clients_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM clients), false);
    END IF;
END $$;

-- Fix markets sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'markets_id_seq') THEN
        PERFORM setval('markets_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM markets), false);
    END IF;
END $$;

-- Fix slocs sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'slocs_id_seq') THEN
        PERFORM setval('slocs_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM slocs), false);
    END IF;
END $$;

-- Fix crews sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'crews_id_seq') THEN
        PERFORM setval('crews_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM crews), false);
    END IF;
END $$;

-- Fix areas sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'areas_id_seq') THEN
        PERFORM setval('areas_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM areas), false);
    END IF;
END $$;

-- Fix item_types sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'item_types_id_seq') THEN
        PERFORM setval('item_types_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM item_types), false);
    END IF;
END $$;

-- Fix inventory sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'inventory_id_seq') THEN
        PERFORM setval('inventory_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM inventory), false);
    END IF;
END $$;

-- Fix transactions sequence (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'transactions_id_seq') THEN
        PERFORM setval('transactions_id_seq', (SELECT COALESCE(MAX(id), 0) + 1 FROM transactions), false);
    END IF;
END $$;

-- Verify the sequences are set correctly (only show sequences that exist)
SELECT sequencename as sequence_name, last_value 
FROM pg_sequences 
WHERE schemaname = 'public' 
AND sequencename LIKE '%_id_seq'
ORDER BY sequencename;



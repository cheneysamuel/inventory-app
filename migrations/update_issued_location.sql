-- Update all issued inventory records to have location 'With Crew'

-- First, get the IDs we need
DO $$
DECLARE
    v_with_crew_location_id INTEGER;
    v_issued_status_id INTEGER;
    v_updated_count INTEGER;
BEGIN
    -- Get 'With Crew' location ID
    SELECT id INTO v_with_crew_location_id 
    FROM locations 
    WHERE name = 'With Crew';
    
    IF v_with_crew_location_id IS NULL THEN
        RAISE EXCEPTION 'Location "With Crew" not found';
    END IF;
    
    -- Get 'Issued' status ID
    SELECT id INTO v_issued_status_id 
    FROM statuses 
    WHERE name = 'Issued';
    
    IF v_issued_status_id IS NULL THEN
        RAISE EXCEPTION 'Status "Issued" not found';
    END IF;
    
    -- Update all issued inventory to 'With Crew' location
    UPDATE inventory
    SET location_id = v_with_crew_location_id,
        updated_at = CURRENT_TIMESTAMP
    WHERE status_id = v_issued_status_id
      AND location_id != v_with_crew_location_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RAISE NOTICE 'Updated % issued inventory records to "With Crew" location', v_updated_count;
END $$;

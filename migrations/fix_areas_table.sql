-- Create areas table if it doesn't exist
-- Run this in your Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.areas (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,
  sloc_id INTEGER NOT NULL,
  created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT areas_sloc_id_fkey FOREIGN KEY (sloc_id) REFERENCES public.slocs(id)
);

-- Add area_id column to inventory table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'inventory' 
        AND column_name = 'area_id'
    ) THEN
        ALTER TABLE public.inventory 
        ADD COLUMN area_id INTEGER,
        ADD CONSTRAINT inventory_area_id_fkey 
        FOREIGN KEY (area_id) REFERENCES public.areas(id);
    END IF;
END $$;

-- Disable Row Level Security for development (optional)
ALTER TABLE public.areas DISABLE ROW LEVEL SECURITY;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_areas_sloc_id ON public.areas(sloc_id);
CREATE INDEX IF NOT EXISTS idx_inventory_area_id ON public.inventory(area_id);

-- Insert sample area data (optional)
INSERT INTO public.areas (name, sloc_id) 
VALUES 
    ('Test Area 1', 1),
    ('Test Area 2', 1)
ON CONFLICT DO NOTHING;

-- Verify table exists
SELECT 'areas table created successfully' AS message 
WHERE EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'areas'
);

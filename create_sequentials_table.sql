-- Create sequentials table
-- This table stores sequential number records for serialized inventory
-- Many-to-one relationship: one inventory item can have many sequential records
-- Used to capture a timeline of sequentials recorded over time

-- Create sequence for sequentials table
CREATE SEQUENCE IF NOT EXISTS public.sequentials_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

-- Create sequentials table
CREATE TABLE IF NOT EXISTS public.sequentials (
    id integer NOT NULL DEFAULT nextval('sequentials_id_seq'::regclass),
    inventory_id integer NOT NULL,
    sequential_number integer NOT NULL,
    recorded_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    notes text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT sequentials_pkey PRIMARY KEY (id),
    CONSTRAINT sequentials_inventory_id_fkey FOREIGN KEY (inventory_id) REFERENCES public.inventory(id) ON DELETE CASCADE,
    CONSTRAINT sequentials_number_positive CHECK (sequential_number > 0)
);

-- Create indexes for faster lookups and queries
CREATE INDEX IF NOT EXISTS idx_sequentials_inventory_id ON public.sequentials(inventory_id);
CREATE INDEX IF NOT EXISTS idx_sequentials_recorded_at ON public.sequentials(recorded_at);
CREATE INDEX IF NOT EXISTS idx_sequentials_inventory_recorded ON public.sequentials(inventory_id, recorded_at DESC);

-- Add comments to document the table and columns
COMMENT ON TABLE public.sequentials IS 'Timeline of sequential numbers recorded for serialized inventory items';
COMMENT ON COLUMN public.sequentials.inventory_id IS 'Foreign key reference to inventory table (many sequentials per inventory item)';
COMMENT ON COLUMN public.sequentials.sequential_number IS 'Sequential number value recorded at this point in time';
COMMENT ON COLUMN public.sequentials.recorded_at IS 'Timestamp when this sequential number was recorded';
COMMENT ON COLUMN public.sequentials.notes IS 'Additional notes about this sequential reading (e.g., location, installer, job number)';
COMMENT ON COLUMN public.sequentials.created_at IS 'Record creation timestamp';

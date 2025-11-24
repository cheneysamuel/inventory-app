-- Add allow_pdf field to inv_action_types table
-- This field determines whether signature pad and PDF generation are available for an action

-- Add the column if it doesn't exist
ALTER TABLE inv_action_types 
ADD COLUMN IF NOT EXISTS allow_pdf BOOLEAN DEFAULT FALSE;

-- Set allow_pdf to TRUE for Issue and Return Material actions
UPDATE inv_action_types 
SET allow_pdf = TRUE 
WHERE name IN ('Issue', 'Return Material');

-- Set allow_pdf to FALSE for all other actions (default)
UPDATE inv_action_types 
SET allow_pdf = FALSE 
WHERE name NOT IN ('Issue', 'Return Material');

-- Update action button colors for inv_action_types table
-- Background and text colors in hex format

UPDATE inv_action_types 
SET button_bg_color = '#ef4444', button_text_color = '#ffffff' 
WHERE name = 'Remove';

UPDATE inv_action_types 
SET button_bg_color = '#10b981', button_text_color = '#000000' 
WHERE name = 'Inspect';

UPDATE inv_action_types 
SET button_bg_color = '#3b82f6', button_text_color = '#ffffff' 
WHERE name = 'Issue';

UPDATE inv_action_types 
SET button_bg_color = '#92400e', button_text_color = '#ffffff' 
WHERE name = 'Field Install';

UPDATE inv_action_types 
SET button_bg_color = '#ef4444', button_text_color = '#ffffff' 
WHERE name = 'Reject';

UPDATE inv_action_types 
SET button_bg_color = '#10b981', button_text_color = '#000000' 
WHERE name = 'Return Material';

-- Delete all transaction records where user_name = 'system'
DELETE FROM transactions 
WHERE user_name = 'system';

-- Optional: Check how many records were deleted
-- Run this BEFORE the delete to see how many will be removed:
-- SELECT COUNT(*) FROM transactions WHERE user_name = 'system';

-- Optional: Verify remaining records
-- SELECT COUNT(*) as remaining_transactions FROM transactions;

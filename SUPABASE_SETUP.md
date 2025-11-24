# Supabase Setup Guide

This guide will walk you through setting up your Supabase PostgreSQL database for the Inventory Management System.

## Prerequisites

- A Supabase account (sign up at https://supabase.com)
- Your Supabase project created

## Step 1: Get Your Supabase Credentials

1. Go to https://supabase.com and sign in
2. Select your project (or create a new one)
3. Go to **Settings** → **API**
4. Copy the following values:
   - **Project URL** (e.g., `https://xyzcompany.supabase.co`)
   - **anon/public key** (the long JWT token)

## Step 2: Configure the Application

1. Open `js/config/supabase.config.js`
2. Replace the placeholder values with your actual credentials:

```javascript
const SupabaseConfig = {
    url: 'https://your-project.supabase.co',  // Replace with your Project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // Replace with your anon key
};
```

## Step 3: Run the Database Schema

1. In your Supabase project, go to **SQL Editor**
2. Open the `base.sql` file from this project
3. Copy the entire contents
4. Paste into the SQL Editor
5. Click **Run** to execute the schema

This will create all necessary tables:
- clients
- markets
- slocs
- crews
- areas
- item_types
- inventory
- transactions
- location_types
- locations
- inventory_types
- units_of_measure
- inventory_providers
- categories
- statuses
- inv_action_types
- action_statuses
- qty_allocations
- transaction_types
- config

## Step 4: (Optional) Load Test Data

1. Open the `base_test_data.md` file
2. Copy the SQL INSERT statements
3. Paste into the SQL Editor
4. Click **Run** to load sample data

This will give you:
- 1 test client
- 1 test market
- 1 test SLOC
- 3 test crews
- 2 test areas
- 5 test item types
- Sample lookup data (locations, statuses, categories, etc.)

## Step 5: Configure Row Level Security (RLS)

Supabase uses Row Level Security for data access control. For development/testing, you can disable RLS on tables, but for production, you should set up proper policies.

### Option A: Disable RLS (Development Only)

Run this in SQL Editor to disable RLS on all tables:

```sql
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE markets DISABLE ROW LEVEL SECURITY;
ALTER TABLE slocs DISABLE ROW LEVEL SECURITY;
ALTER TABLE crews DISABLE ROW LEVEL SECURITY;
ALTER TABLE areas DISABLE ROW LEVEL SECURITY;
ALTER TABLE item_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE location_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE locations DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE units_of_measure DISABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_providers DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE inv_action_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE action_statuses DISABLE ROW LEVEL SECURITY;
ALTER TABLE qty_allocations DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE config DISABLE ROW LEVEL SECURITY;
```

### Option B: Enable RLS with Public Access (Testing)

Run this to allow anonymous access (for testing only):

```sql
-- Enable RLS
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE markets ENABLE ROW LEVEL SECURITY;
-- ... repeat for all tables

-- Create policies allowing all operations
CREATE POLICY "Allow all operations" ON clients FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all operations" ON markets FOR ALL USING (true) WITH CHECK (true);
-- ... repeat for all tables
```

### Option C: Production RLS Policies (Recommended)

For production, implement proper RLS policies based on user authentication. Example:

```sql
-- Example: Only authenticated users can read/write
CREATE POLICY "Authenticated users can access" 
    ON clients 
    FOR ALL 
    USING (auth.role() = 'authenticated');
```

## Step 6: Test the Connection

1. Open `index.html` in a web browser
2. Open the browser console (F12)
3. You should see: `✅ Application initialized successfully!`
4. If you see an error, check:
   - Your Supabase credentials are correct
   - RLS is properly configured
   - Your browser has internet access

## Step 7: Verify Data

1. Try navigating through the application
2. Create a new client, market, or SLOC
3. Go to Supabase → **Table Editor** to verify data was saved

## Troubleshooting

### Error: "Supabase configuration not found"
- Make sure you updated `js/config/supabase.config.js` with your credentials

### Error: "new row violates row-level security policy"
- RLS is enabled but no policies exist
- Either disable RLS or create appropriate policies (see Step 5)

### Error: "relation does not exist"
- The database schema hasn't been created
- Run the `base.sql` script in SQL Editor

### Data not loading
- Check browser console for errors
- Verify RLS policies allow read access
- Check Network tab to see if API calls are succeeding

## Next Steps

Once your database is set up and the application connects successfully:

1. Review the functional programming patterns in `js/utils/functional.js`
2. Explore the async query builders in `js/db/queries.js`
3. Customize the UI in `styles.css` and `index.html`
4. Add your own business logic in the service modules

## Security Notes

⚠️ **Important Security Considerations:**

1. **Never commit your Supabase credentials to version control**
   - Add `supabase.config.js` to `.gitignore`
   - Use environment variables for production

2. **Enable RLS for production**
   - The anon key is public and visible in browser code
   - RLS policies protect your data

3. **Implement proper authentication**
   - Use Supabase Auth for user management
   - Restrict access based on authenticated users

4. **Use service role key only on backend**
   - Never expose service role key in frontend code
   - Only use anon/public key in browser

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

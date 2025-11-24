# Row Level Security (RLS) Implementation Guide

## Overview

Row Level Security (RLS) is a PostgreSQL/Supabase feature that controls which rows users can access in database tables. This guide walks you through implementing RLS for your inventory application.

## Current Situation

- ✅ You have a working application with authentication
- ⚠️ No RLS enabled = anyone with database credentials can access all data
- 🎯 Goal: Enable RLS with full access for all authenticated users

## Why Enable RLS?

1. **Security**: Prevents unauthorized direct database access
2. **Best Practice**: Supabase strongly recommends RLS for all tables
3. **Future-Proof**: Easy to add restrictions later if needed
4. **API Protection**: Supabase API automatically enforces RLS policies

## Your Use Case: Simple Full Access

Since all your users should access all data, you'll use the simplest RLS setup:
- ✅ Enable RLS on all tables
- ✅ Create one policy per table: "Allow authenticated users full access"
- ✅ Anonymous users get NO access (login required)

---

## Step-by-Step Implementation

### Step 1: Back Up Your Database

**In Supabase Dashboard:**
1. Go to Database → Backups
2. Click "Backup now" to create a restore point
3. Wait for backup to complete

### Step 2: Run the RLS Setup Script

**Option A: Using Supabase SQL Editor (Recommended)**

1. Open Supabase Dashboard
2. Navigate to: **SQL Editor**
3. Click **"New query"**
4. Copy the entire contents of `migrations/enable_row_level_security.sql`
5. Paste into the SQL Editor
6. Click **"Run"** (or press Ctrl+Enter)
7. Wait for execution to complete

**Option B: Using Supabase CLI**

```bash
supabase db push --file migrations/enable_row_level_security.sql
```

### Step 3: Verify RLS is Working

**Run verification queries in SQL Editor:**

```sql
-- Check which tables have RLS enabled
SELECT 
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected result: All tables should show `rls_enabled = true`

```sql
-- Check which policies exist
SELECT 
    tablename,
    policyname
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected result: Each table should have one policy named "Allow authenticated full access"

### Step 4: Test Your Application

1. **Log out** of your application
2. **Log back in** with a valid user account
3. **Test core functionality:**
   - ✅ View inventory
   - ✅ Create/receive items
   - ✅ Issue items
   - ✅ View transactions
   - ✅ Manage item types

**If something doesn't work:**
- Check browser console for errors
- Look for "RLS" or "policy" error messages
- Verify you're logged in (authentication is working)

---

## Understanding the Policy

### What the Policy Does

```sql
CREATE POLICY "Allow authenticated full access" ON public.inventory
    FOR ALL                    -- Applies to SELECT, INSERT, UPDATE, DELETE
    TO authenticated          -- Only for logged-in users
    USING (true)              -- Allow reading any row
    WITH CHECK (true);        -- Allow writing any row
```

**Translation:**
- `FOR ALL` = Covers all operations (read, create, update, delete)
- `TO authenticated` = Only users who have logged in via Supabase Auth
- `USING (true)` = No restrictions on which rows can be read
- `WITH CHECK (true)` = No restrictions on which rows can be written

### Anonymous Users

Anonymous (not logged in) users get **NO ACCESS** because:
- The policy specifies `TO authenticated`
- No policy = no access (RLS default)
- This forces users to log in to use your app

---

## Future Enhancements (Optional)

### If You Later Need Role-Based Access

**Example: Restrict action types table to admins only**

```sql
-- Remove the full access policy
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inv_action_types;

-- Create admin-only policy
CREATE POLICY "Admin only access" ON public.inv_action_types
    FOR ALL 
    TO authenticated
    USING (
        auth.jwt() ->> 'role' = 'admin'
    )
    WITH CHECK (
        auth.jwt() ->> 'role' = 'admin'
    );

-- Create read-only policy for regular users
CREATE POLICY "Users can view" ON public.inv_action_types
    FOR SELECT 
    TO authenticated
    USING (true);
```

### If You Later Need User-Specific Data

**Example: Users only see their own transactions**

```sql
CREATE POLICY "Users see own transactions" ON public.transactions
    FOR SELECT 
    TO authenticated
    USING (
        user_id = auth.uid()
    );
```

---

## Protecting System Tables

Since you mentioned some tables should be "untouchable" by non-IT users, here are options:

### Option 1: UI-Level Protection (Current Approach)
- ✅ Already implemented
- Your app doesn't show UI for editing system tables
- Non-programmers can't accidentally modify them
- Database-level access still allowed (for admins/IT)

### Option 2: Database-Level Protection (Future)
Create a separate policy for system tables that checks user role:

```sql
-- Example: Only admins can modify inventory_types
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inventory_types;

-- Admins have full access
CREATE POLICY "Admin full access" ON public.inventory_types
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Regular users read-only
CREATE POLICY "Users read only" ON public.inventory_types
    FOR SELECT 
    TO authenticated
    USING (true);
```

**To implement this, you need to:**
1. Add a `role` field to user metadata in Supabase Auth
2. Assign roles (admin, user, etc.) to users
3. Update policies to check the role

---

## Troubleshooting

### Problem: "Row-level security is enabled but no policy allows..."

**Cause:** RLS is enabled but no matching policy exists for the operation

**Solution:**
1. Verify you're logged in (check auth token)
2. Check policy exists: `SELECT * FROM pg_policies WHERE tablename = 'your_table';`
3. Re-run the RLS setup script

### Problem: Application works but Supabase API gives 403 errors

**Cause:** RLS is blocking API access

**Solution:**
1. Check if you're passing authentication in API calls
2. Verify `supabase.auth.getSession()` returns a valid session
3. Make sure API calls use the authenticated client

### Problem: Need to temporarily disable RLS for debugging

```sql
-- Disable RLS on a specific table (NOT recommended for production)
ALTER TABLE public.inventory DISABLE ROW LEVEL SECURITY;

-- Re-enable when done debugging
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
```

---

## Checklist

Before deploying to production:

- [ ] Back up database
- [ ] Run RLS setup script
- [ ] Verify all tables have RLS enabled
- [ ] Verify all tables have policies
- [ ] Test login functionality
- [ ] Test all major workflows (receive, issue, etc.)
- [ ] Test with multiple user accounts
- [ ] Verify anonymous access is blocked
- [ ] Update documentation with any user role requirements

---

## Summary

**What you're implementing:**
- ✅ RLS enabled on all 17 tables
- ✅ One simple policy per table: full access for authenticated users
- ✅ Anonymous users blocked (must log in)
- ✅ No data isolation between users (all see all data)

**Why this works for you:**
- Internal application with trusted users
- All users need access to all inventory data
- Simple to maintain
- Easy to enhance later if needed

**Next steps if you need more security:**
- Add user roles (admin, user, viewer, etc.)
- Restrict certain tables to admin-only
- Add per-crew or per-market data filtering

---

## Questions & Answers

**Q: Will this slow down my application?**  
A: No. RLS policies are compiled into PostgreSQL execution plans and are very fast.

**Q: Can I still use the database directly (pgAdmin, SQL Editor)?**  
A: Yes, but you'll need to authenticate as a specific user or use the service role key.

**Q: What if I need to make changes later?**  
A: Just run new `DROP POLICY` and `CREATE POLICY` statements for the tables you want to modify.

**Q: Do I need to modify my application code?**  
A: No. Your Supabase client already passes authentication automatically.

**Q: What happens to existing data?**  
A: Nothing. RLS only affects who can access the data, not the data itself.

---

**Ready to proceed?** Run the script in `migrations/enable_row_level_security.sql` and you'll be protected! 🔒

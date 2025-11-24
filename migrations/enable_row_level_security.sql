-- ============================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- ============================================
-- This script enables RLS on all tables and creates policies
-- 
-- SECURITY MODEL:
-- - Admin users: FULL ACCESS to all tables
-- - Regular users: FULL ACCESS to operational tables, READ-ONLY to reference tables
-- 
-- FULL CRUD Tables (10 tables):
--   areas, clients, config, crews, inventory
--   item_type_markets, item_types, markets, slocs, transactions
--
-- READ-ONLY Tables (remaining tables):
--   categories, inv_action_types, inventory_providers, inventory_types
--   location_types, locations, statuses, units_of_measure
-- 
-- Run this script in Supabase SQL Editor
-- ============================================

-- ============================================
-- STEP 1: Enable RLS on ALL tables
-- ============================================

-- Full CRUD Tables (users can modify)
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_type_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slocs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Read-Only Tables (users can only view)
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inv_action_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.location_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

-- ============================================
-- STEP 2: FULL ACCESS Policies for Operational Tables
-- ============================================
-- These tables allow full CRUD operations for all authenticated users
-- Admins automatically get access through these policies

-- Areas
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.areas;
CREATE POLICY "Allow authenticated full access" ON public.areas
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Clients
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.clients;
CREATE POLICY "Allow authenticated full access" ON public.clients
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Config
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.config;
CREATE POLICY "Allow authenticated full access" ON public.config
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Crews
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.crews;
CREATE POLICY "Allow authenticated full access" ON public.crews
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Inventory
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.inventory;
CREATE POLICY "Allow authenticated full access" ON public.inventory
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Item Type Markets
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.item_type_markets;
CREATE POLICY "Allow authenticated full access" ON public.item_type_markets
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Item Types
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.item_types;
CREATE POLICY "Allow authenticated full access" ON public.item_types
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Markets
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.markets;
CREATE POLICY "Allow authenticated full access" ON public.markets
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- SLOCs
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.slocs;
CREATE POLICY "Allow authenticated full access" ON public.slocs
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Transactions
DROP POLICY IF EXISTS "Allow authenticated full access" ON public.transactions;
CREATE POLICY "Allow authenticated full access" ON public.transactions
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- ============================================
-- STEP 3: READ-ONLY Policies for Reference Tables
-- ============================================
-- Regular users can only SELECT from these tables
-- Admins get full access through separate admin policies

-- Categories
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.categories;
DROP POLICY IF EXISTS "Admin full access" ON public.categories;

CREATE POLICY "Admin full access" ON public.categories
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.categories
    FOR SELECT 
    TO authenticated
    USING (true);

-- Action Types
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.inv_action_types;
DROP POLICY IF EXISTS "Admin full access" ON public.inv_action_types;

CREATE POLICY "Admin full access" ON public.inv_action_types
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.inv_action_types
    FOR SELECT 
    TO authenticated
    USING (true);

-- Inventory Providers
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.inventory_providers;
DROP POLICY IF EXISTS "Admin full access" ON public.inventory_providers;

CREATE POLICY "Admin full access" ON public.inventory_providers
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.inventory_providers
    FOR SELECT 
    TO authenticated
    USING (true);

-- Inventory Types (Serialized vs Bulk)
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.inventory_types;
DROP POLICY IF EXISTS "Admin full access" ON public.inventory_types;

CREATE POLICY "Admin full access" ON public.inventory_types
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.inventory_types
    FOR SELECT 
    TO authenticated
    USING (true);

-- Location Types
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.location_types;
DROP POLICY IF EXISTS "Admin full access" ON public.location_types;

CREATE POLICY "Admin full access" ON public.location_types
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.location_types
    FOR SELECT 
    TO authenticated
    USING (true);

-- Locations
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.locations;
DROP POLICY IF EXISTS "Admin full access" ON public.locations;

CREATE POLICY "Admin full access" ON public.locations
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.locations
    FOR SELECT 
    TO authenticated
    USING (true);

-- Statuses
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.statuses;
DROP POLICY IF EXISTS "Admin full access" ON public.statuses;

CREATE POLICY "Admin full access" ON public.statuses
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.statuses
    FOR SELECT 
    TO authenticated
    USING (true);

-- Units of Measure
DROP POLICY IF EXISTS "Allow authenticated read only" ON public.units_of_measure;
DROP POLICY IF EXISTS "Admin full access" ON public.units_of_measure;

CREATE POLICY "Admin full access" ON public.units_of_measure
    FOR ALL 
    TO authenticated
    USING (auth.jwt() ->> 'user_role' = 'admin')
    WITH CHECK (auth.jwt() ->> 'user_role' = 'admin');

CREATE POLICY "Allow authenticated read only" ON public.units_of_measure
    FOR SELECT 
    TO authenticated
    USING (true);

-- ============================================
-- STEP 4: Verification Queries
-- ============================================

-- Check which tables have RLS enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN (
    'areas', 'categories', 'clients', 'config', 'crews', 
    'inv_action_types', 'inventory', 'inventory_providers', 
    'inventory_types', 'item_type_markets', 'item_types', 
    'location_types', 'locations', 'markets', 'slocs', 
    'statuses', 'transactions', 'units_of_measure'
  )
ORDER BY tablename;

-- Check policies
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================
-- Run these to verify RLS is enabled and policies exist

-- Check RLS status on all tables
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Check policies on all tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ============================================
-- NOTES
-- ============================================
-- 
-- Security Model:
-- ================
-- FULL CRUD TABLES (10 tables) - All authenticated users can SELECT, INSERT, UPDATE, DELETE:
--   - areas: Work areas/zones
--   - clients: Client organizations
--   - config: Application configuration
--   - crews: Work crews/teams
--   - inventory: Inventory records (serialized and bulk)
--   - item_type_markets: Item type to market associations
--   - item_types: User-defined item types
--   - markets: Market/location definitions
--   - slocs: Storage locations
--   - transactions: Inventory transaction history
--
-- READ-ONLY TABLES (8 tables) - Regular users can only SELECT, admins can do all operations:
--   - categories: Item categories (system configuration)
--   - inv_action_types: Action types like Receive, Issue, Adjust (system configuration)
--   - inventory_providers: Provider types (system configuration)
--   - inventory_types: Serialized vs Bulk (system configuration)
--   - location_types: Location type definitions (system configuration)
--   - locations: Physical locations (system configuration)
--   - statuses: Status codes (system configuration)
--   - units_of_measure: UoM definitions (system configuration)
--
-- Benefits:
-- =========
-- - Regular users can perform all daily operations (receive, issue, create items, manage inventory)
-- - System configuration tables are protected from accidental modification
-- - Admin users can modify any table including system configuration
-- - Configuration changes by non-admins are blocked
--
-- Admin Setup:
-- ============
-- To create an admin account:
--
-- 1. Create user in Supabase Auth (Dashboard > Authentication > Users > Invite user)
--
-- 2. After user is created, add 'user_role' to their metadata:
--    
--    In Supabase SQL Editor, run:
--    
--    UPDATE auth.users 
--    SET raw_user_meta_data = raw_user_meta_data || '{"user_role": "admin"}'::jsonb
--    WHERE email = 'admin@example.com';
--
-- 3. User must log out and log back in for role to take effect
--
-- 4. Verify admin access by testing:
--    - Can view all tables (like regular users)
--    - Can modify operational tables (like regular users)
--    - Can modify read-only tables (unlike regular users)
--
-- Checking User Roles:
-- ====================
-- To see current user's role in SQL:
--   SELECT auth.jwt() ->> 'user_role';
--
-- To see all users and their roles:
--   SELECT 
--       id,
--       email,
--       raw_user_meta_data ->> 'user_role' as user_role,
--       created_at
--   FROM auth.users
--   ORDER BY created_at DESC;
--
-- Policy Behavior:
-- ================
-- - Admin policies check: auth.jwt() ->> 'user_role' = 'admin'
-- - If user has user_role='admin' in metadata, they get full access to read-only tables
-- - If user doesn't have admin role, they only get SELECT on read-only tables
-- - All users get full access to operational tables regardless of role
--
-- ============================================

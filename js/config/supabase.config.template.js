/**
 * Supabase Configuration Template
 * 
 * INSTRUCTIONS:
 * 1. Copy this file to: js/config/supabase.config.js
 * 2. Replace the placeholder values with your actual Supabase credentials
 * 3. DO NOT commit supabase.config.js to version control!
 * 
 * To get your credentials:
 * 1. Go to https://supabase.com
 * 2. Select your project
 * 3. Go to Settings → API
 * 4. Copy the "Project URL" and "anon public" key
 */

const SupabaseConfig = {
    // Your Supabase project URL
    // Example: 'https://xyzcompany.supabase.co'
    url: 'YOUR_SUPABASE_URL_HERE',
    
    // Your Supabase anon/public key
    // Example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6...'
    anonKey: 'YOUR_SUPABASE_ANON_KEY_HERE'
};

// Validate configuration before export
if (SupabaseConfig.url === 'YOUR_SUPABASE_URL_HERE' || 
    SupabaseConfig.anonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
    console.error('⚠️ Supabase credentials not configured!');
    console.error('Please update js/config/supabase.config.js with your actual credentials.');
    console.error('See SUPABASE_SETUP.md for instructions.');
}

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Service Role Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyRLSFix() {
    console.log('Applying RLS fix for analysis_results table...');

    // SQL to enable RLS and add policies
    const sql = `
    -- Enable RLS on analysis_results table
    ALTER TABLE IF EXISTS public.analysis_results ENABLE ROW LEVEL SECURITY;
    
    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view their own analysis results" ON public.analysis_results;
    DROP POLICY IF EXISTS "Users can insert their own analysis results" ON public.analysis_results;
    DROP POLICY IF EXISTS "Users can update their own analysis results" ON public.analysis_results;
    DROP POLICY IF EXISTS "Users can delete their own analysis results" ON public.analysis_results;

    -- Create policies
    CREATE POLICY "Users can view their own analysis results"
    ON public.analysis_results FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = analysis_results.class_id
        AND classes.user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can insert their own analysis results"
    ON public.analysis_results FOR INSERT
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = class_id
        AND classes.user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can update their own analysis results"
    ON public.analysis_results FOR UPDATE
    USING (
      EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = analysis_results.class_id
        AND classes.user_id = auth.uid()
      )
    );

    CREATE POLICY "Users can delete their own analysis results"
    ON public.analysis_results FOR DELETE
    USING (
      EXISTS (
        SELECT 1 FROM public.classes
        WHERE classes.id = analysis_results.class_id
        AND classes.user_id = auth.uid()
      )
    );

    -- Grant necessary permissions
    GRANT ALL ON public.analysis_results TO authenticated;
    GRANT ALL ON public.analysis_results TO service_role;
  `;

    // Execute SQL using RPC if available, or try to run it directly via query if possible (not possible with standard client usually)
    // Since supabase-js client cannot run arbitrary SQL directly without an RPC function,
    // we will try to define an RPC function to execute SQL if one exists, or use the query method if supported by any extension.
    // However, standard setup doesn't allow raw SQL.
    // BUT: The user has a `supabase-schema.sql` file suggesting they manage schema via SQL.
    // The service role key allows bypassing RLS, but doesn't allow DDL.

    // Wait, I see `supabase-schema.sql` has many `CREATE POLICY` statements.
    // If I cannot run DDL here, I might have to ask the user to run it in the dashboard.

    // Let's check if there is an existing `exec_sql` function or similar in the schema.
    const { data: rpcData, error: rpcError } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (rpcError) {
        console.log('RPC exec_sql failed, trying inputting directly via a special migration mechanism? No.');
        console.log('Error:', rpcError);
        console.log('Attempting alternative: Using pg client if available? No pg client installed in dependencies.');
        console.log('Wait, dependencies has "pg": "^8.18.0"!');

        // Use pg client to connect directly
        // Need connection string. Usually it is not in .env.local for Supabase, only URL/Key.
        // But maybe DATABASE_URL is there? 
        // Let's check .env.local again or .env

        if (process.env.DATABASE_URL) {
            const { Client } = require('pg');
            const client = new Client({
                connectionString: process.env.DATABASE_URL,
            });
            await client.connect();
            await client.query(sql);
            await client.end();
            console.log('Successfully applied RLS policies via pg client.');
            return;
        }

        console.error('Cannot execute DDL constraints via Supabase JS client without specific RPC.');
        console.error('Please run the following SQL in your Supabase Dashboard > SQL Editor:');
        console.log(sql);
    } else {
        console.log('Successfully applied RLS policies via RPC.');
    }

}

// First, check if DATABASE_URL exists in env
if (!process.env.DATABASE_URL) {
    // try to construct it if we can (unlikely without password)
    // we will rely on the user running it if we can't.
    console.log('Warning: DATABASE_URL not found. We will attempt RPC, otherwise manual execution required.');
}

applyRLSFix()
    .then(() => console.log('Done'))
    .catch(err => console.error(err));

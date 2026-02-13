const { Client } = require('pg');

const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function fixRLS() {
    await client.connect();

    console.log('Enabling RLS on analysis_queue...');
    try {
        await client.query('ALTER TABLE public.analysis_queue ENABLE ROW LEVEL SECURITY;');
        console.log('Success: RLS enabled for analysis_queue.');
    } catch (e) {
        console.error('Error enabling RLS:', e.message);
    }

    await client.end();
}

fixRLS().catch(console.error);

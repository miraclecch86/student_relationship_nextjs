const { Client } = require('pg');

const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function checkRLS() {
    await client.connect();

    // Check Tables
    const resTables = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);

    console.log('--- TABLES ---');
    resTables.rows.forEach(row => {
        console.log(`${row.tablename}: ${row.rowsecurity ? 'RLS ENABLED' : 'RLS DISABLED'}`);
    });

    // Check Views
    const resViews = await client.query(`
    SELECT viewname 
    FROM pg_views 
    WHERE schemaname = 'public' 
    ORDER BY viewname;
  `);

    console.log('\n--- VIEWS ---');
    if (resViews.rows.length === 0) {
        console.log('No views found.');
    } else {
        resViews.rows.forEach(row => {
            console.log(`${row.viewname} (VIEW)`);
        });
    }

    await client.end();
}

checkRLS().catch(console.error);

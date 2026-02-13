const { Client } = require('pg');

const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function checkRLS() {
    await client.connect();

    const res = await client.query(`
    SELECT tablename, rowsecurity 
    FROM pg_tables 
    WHERE schemaname = 'public' 
    ORDER BY tablename;
  `);

    console.log('Tables and RLS Status:');
    const unsecuredTables = [];
    res.rows.forEach(row => {
        console.log(`${row.tablename}: ${row.rowsecurity ? 'ENABLED' : 'DISABLED'}`);
        if (!row.rowsecurity) {
            unsecuredTables.push(row.tablename);
        }
    });

    if (unsecuredTables.length > 0) {
        console.log('\n!!! WARNING: The following tables have RLS DISABLED:');
        console.log(unsecuredTables.join(', '));
    } else {
        console.log('\nAll public tables have RLS enabled.');
    }

    await client.end();
}

checkRLS().catch(console.error);

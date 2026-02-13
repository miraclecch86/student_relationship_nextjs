const { Client } = require('pg');

const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function verify() {
    await client.connect();

    const resClasses = await client.query('SELECT count(*) FROM public.classes');
    console.log(`Classes count: ${resClasses.rows[0].count}`);

    const resStudents = await client.query('SELECT count(*) FROM public.students');
    console.log(`Students count: ${resStudents.rows[0].count}`);

    await client.end();
}

verify().catch(console.error);

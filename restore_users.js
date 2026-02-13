const fs = require('fs');
const { Client } = require('pg');
const copyStreams = require('pg-copy-streams');

const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function restoreUsers() {
    await client.connect();
    const stream = client.query(copyStreams.from('COPY auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, invited_at, confirmation_token, confirmation_sent_at, recovery_token, recovery_sent_at, email_change_token_new, email_change, email_change_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, is_super_admin, created_at, updated_at, phone, phone_confirmed_at, phone_change, phone_change_token, phone_change_sent_at, email_change_token_current, email_change_confirm_status, banned_until, reauthentication_token, reauthentication_sent_at, is_sso_user, deleted_at, is_anonymous) FROM stdin;'));

    const fileStream = fs.createReadStream('auth_users.sql');
    // Skip the first line which is the COPY command itself, as we provided it above
    // Actually, pg-copy-streams expects the data, not the COPY command in the stream?
    // No, copyStreams.from(SQL) returns a writable stream. We pipe data into it.
    // The data in auth_users.sql includes the COPY line at the top and \. at the bottom.
    // We need to strip the first line (COPY ...) and the last line (\.)

    const readline = require('readline');
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let firstLine = true;
    for await (const line of rl) {
        if (firstLine) {
            firstLine = false;
            continue; // Skip the COPY command line in the file
        }
        if (line === '\\.') {
            continue; // Skip the end marker
        }
        stream.write(line + '\n');
    }
    stream.end();

    await new Promise((resolve, reject) => {
        stream.on('finish', resolve);
        stream.on('error', reject);
    });

    console.log('auth.users restored successfully.');
    await client.end();
}

restoreUsers().catch(err => {
    console.error('Error restoring users:', err);
    client.end();
});

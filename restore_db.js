const fs = require('fs');
const readline = require('readline');
const { Client } = require('pg');
const copyStreams = require('pg-copy-streams');

// User provided connection string
const connectionString = 'postgresql://postgres.kgjghdzshbkfnldzgkxm:Saksu1316*1@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new Client({ connectionString });

async function restore() {
    console.log('Connecting to database...');
    await client.connect();
    console.log('Connected.');

    // Truncate public tables to prevent duplicates
    console.log('Truncating public tables...');
    try {
        await client.query(`
        TRUNCATE TABLE 
            public.classes, 
            public.students, 
            public.relations, 
            public.questions, 
            public.answers, 
            public.surveys, 
            public.school_records, 
            public.class_journals, 
            public.journal_announcements, 
            public.journal_student_status, 
            public.journal_class_memos, 
            public.user_roles,
            public.assessment_items,
            public.assessment_records,
            public.class_daily_records,
            public.class_quick_memos,
            public.class_schedules,
            public.class_todos,
            public.demo_class_stats,
            public.demo_classes,
            public.homework_items,
            public.homework_months,
            public.homework_records,
            public.subjects
        CASCADE;
      `);
        console.log('Public tables truncated.');
    } catch (e) {
        console.warn('Truncate warning (might be empty or missing tables):', e.message);
    }

    // Clear auth.identities to prep for restore (if possible)
    try {
        await client.query('DELETE FROM auth.identities;');
        console.log('auth.identities cleared.');
    } catch (e) {
        console.warn('Could not clear auth.identities:', e.message);
    }

    const backupFile = 'db_cluster-05-08-2025@13-17-26.backup';
    console.log(`Reading backup file: ${backupFile}`);

    const fileStream = fs.createReadStream(backupFile);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let sqlBuffer = '';
    let isCopying = false;
    let copyStream = null;
    let lineCount = 0;

    for await (const line of rl) {
        lineCount++;
        if (lineCount % 1000 === 0) process.stdout.write('.');

        if (isCopying) {
            if (line === '\\.') {
                // End of COPY block
                copyStream.end();
                await new Promise((resolve) => {
                    copyStream.on('finish', resolve);
                    copyStream.on('error', (err) => {
                        console.error('\nCOPY Stream Error (Continuable):', err.message);
                        resolve(); // Resolve anyway to continue script
                    });
                });
                isCopying = false;
                copyStream = null;
                console.log('\nCopy finished.');
            } else {
                copyStream.write(line + '\n');
            }
        } else {
            // SQL Mode
            if (!sqlBuffer) {
                if (line.startsWith('--') || !line.trim()) continue;
            }

            // Check for COPY command start
            if (line.startsWith('COPY ') && line.endsWith('FROM stdin;')) {
                if (sqlBuffer.trim()) {
                    await executeSql(sqlBuffer);
                    sqlBuffer = '';
                }

                // Skip unneeded or problematic auth tables to avoid duplicates
                if (line.includes('auth.users') ||
                    line.includes('auth.audit_log_entries') ||
                    line.includes('auth.flow_state') ||
                    line.includes('auth.sessions') ||
                    line.includes('auth.mfa_')) {
                    console.log(`\nSkipping COPY for: ${line}`);
                    isCopying = true;
                    // Mock copy stream to drain lines until \.
                    copyStream = {
                        write: () => { },
                        end: () => { },
                        on: (evt, cb) => { if (evt === 'finish') cb(); }
                    };
                    continue;
                }

                console.log(`\nStarting COPY: ${line}`);
                try {
                    copyStream = client.query(copyStreams.from(line));
                    isCopying = true;
                } catch (err) {
                    console.error('\nCOPY Init Error:', err.message);
                    isCopying = false;
                }
            } else {
                sqlBuffer += line + '\n';
                if (line.trim().endsWith(';')) {
                    await executeSql(sqlBuffer);
                    sqlBuffer = '';
                }
            }
        }
    }

    if (sqlBuffer.trim()) await executeSql(sqlBuffer);

    console.log('\nRestoration complete.');
    await client.end();
}

async function executeSql(sql) {
    try {
        if (sql.includes('CREATE ROLE')) {
            // Skip role creation
        } else {
            await client.query(sql);
        }
    } catch (e) {
        // console.warn(`\nSQL Warning: ${e.message.split('\n')[0]}`);
    }
}

restore().catch(err => {
    console.error('\nFatal Error:', err);
    client.end();
});

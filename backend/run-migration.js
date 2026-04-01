const { queryRows } = require('./db/database');
const fs = require('fs');
const path = require('path');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf8');

  try {
    await queryRows(sql, []);
    console.log('Schema created successfully!');

    const tables = await queryRows(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
      []
    );
    console.log('\nTables:', tables.map(r => r.tablename).join(', '));

    const rls = await queryRows(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename",
      []
    );
    console.log('\nRLS enabled:', rls.map(r => r.tablename).join(', '));

    const policies = await queryRows(
      "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename",
      []
    );
    console.log('\nPolicies (' + policies.length + '):');
    policies.forEach(p => console.log('  ' + p.tablename + ' -> ' + p.policyname));

  } catch(e) {
    console.error('Error:', e.message);
  }
}

run();

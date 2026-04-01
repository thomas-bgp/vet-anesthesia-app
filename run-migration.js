const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host: 'db.cjbrlsymcvosexarxlga.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'Vt8$kR2mXp#9wLqZ!bN4',
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'supabase-schema.sql'), 'utf8');

  try {
    await pool.query(sql);
    console.log('Schema created successfully!');

    const { rows: tables } = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('\nTables:', tables.map(r => r.tablename).join(', '));

    const { rows: rls } = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true ORDER BY tablename"
    );
    console.log('\nRLS enabled:', rls.map(r => r.tablename).join(', '));

    const { rows: policies } = await pool.query(
      "SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename"
    );
    console.log('\nPolicies (' + policies.length + '):');
    policies.forEach(p => console.log('  ' + p.tablename + ' -> ' + p.policyname));

  } catch(e) {
    console.error('Error:', e.message);
  }

  pool.end();
}

run();

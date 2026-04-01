const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://sgxobcmzoptayhgctsqg.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNneG9iY216b3B0YXloZ2N0c3FnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTA1NDk2MywiZXhwIjoyMDkwNjMwOTYzfQ.1rFtT1n38NaRses-iIYa9PnQU2ZNzgXLW8L-0wDzriw';

let supabase;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
  return supabase;
}

async function queryRows(sql, params = []) {
  const sb = getSupabase();
  const { data, error } = await sb.rpc('query_rows', {
    sql_text: sql,
    params: params.map(p => p === null || p === undefined ? null : String(p)),
  });
  if (error) throw new Error(error.message);
  return data || [];
}

async function ensurePermanentAdmin() {
  const sb = getSupabase();
  const email = 'camilacadibe@gmail.com';

  const { data: existing } = await sb
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (!existing) {
    const hashedPassword = bcrypt.hashSync('Mimi12345!', 12);
    const { error } = await sb.from('users').insert({
      name: 'Camila Cadibe',
      email,
      password: hashedPassword,
      role: 'admin',
      is_active: true,
    });
    if (error) {
      console.error('Error creating permanent admin:', error.message);
    } else {
      console.log('Permanent admin created: ' + email);
    }
  } else {
    await sb
      .from('users')
      .update({ role: 'admin', is_active: true })
      .eq('email', email);
  }

  // Schema migrations: add branding/onboarding columns
  const migrations = [
    "ALTER TABLE users ADD COLUMN theme_color TEXT DEFAULT '#0d9488'",
    "ALTER TABLE users ADD COLUMN logo_image TEXT",
    "ALTER TABLE users ADD COLUMN business_address TEXT",
    "ALTER TABLE users ADD COLUMN business_phone TEXT",
    "ALTER TABLE users ADD COLUMN business_email TEXT",
    "ALTER TABLE users ADD COLUMN onboarding_done BOOLEAN DEFAULT false",
  ];
  for (const sql of migrations) {
    try { await queryRows(sql); } catch {}
  }
}

module.exports = { getSupabase, queryRows, ensurePermanentAdmin };

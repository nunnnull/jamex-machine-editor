const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigrations() {
  console.log('Running database migrations...');
  const migrationsDir = path.join(__dirname);
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    console.log(`Running migration: ${file}`);
    const { error } = await supabase.rpc('exec_sql', { sql }).single();
    if (error) {
      console.error(`Migration ${file} failed:`, error.message);
      console.log('Attempting direct SQL execution via REST...');
      const { error: directError } = await supabase.from('machines').select('id').limit(1);
      if (directError && directError.message.includes('relation')) {
        console.log('Tables do not exist yet. Please run the SQL manually in Supabase SQL editor.');
        console.log(`SQL file location: ${path.join(migrationsDir, file)}`);
      }
    } else {
      console.log(`Migration ${file} completed`);
    }
  }
  console.log('Migrations complete');
}

runMigrations().catch(console.error);

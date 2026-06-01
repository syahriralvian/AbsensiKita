import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
  const { data, error } = await supabase.rpc('execute_sql', { 
    query: `
      CREATE TABLE IF NOT EXISTS public.attendance_records (
        id SERIAL PRIMARY KEY,
        pin TEXT,
        date_time TEXT,
        sn TEXT,
        status TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        synced BOOLEAN DEFAULT FALSE
      );
    `
  });
  console.log(data, error);
}
run();

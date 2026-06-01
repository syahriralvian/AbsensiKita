import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function alter() {
  const { data, error } = await supabase.rpc('execute_sql', { 
    query: `ALTER TABLE adms_connections ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;` 
  });
  console.log("adms_connections error:", error, data);

  const { data: d2, error: e2 } = await supabase.rpc('execute_sql', { 
    query: `ALTER TABLE machine_commands ALTER COLUMN company_id TYPE TEXT USING company_id::TEXT;` 
  });
  console.log("machine_commands error:", e2, d2);
}
alter();

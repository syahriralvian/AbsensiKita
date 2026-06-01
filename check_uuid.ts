import { createClient } from "@supabase/supabase-js";
import 'dotenv/config';

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
// This needs the right key - just using what's in local .env?
// wait, we can just select from the tables to see the error.
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function check() {
  const c = "CO-01A005F6";
  const tables = ['adms_connections', 'machine_commands', 'departemen', 'shifts', 'karyawan', 'absensi', 'hari_libur', 'siklus_shift', 'jam_break'];
  for (const t of tables) {
    const { data, error } = await supabase.from(t).select('id').eq('company_id', c).limit(1);
    if (error) console.log(t, "error:", error);
    else console.log(t, "ok");
  }
}
check();

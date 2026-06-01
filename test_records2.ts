import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://api.absensikita.id", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE");

async function run() {
  const { data, error } = await supabase
    .from('absensi')
    .select('id, nama, waktu_masuk, tipe')
    .eq('company_id', 'CO-01A005F6')
    .gte('waktu_masuk', '2026-05-05T00:00:00+07:00')
    .order('waktu_masuk', { ascending: false });
  console.log("data with ISO STring:", data, "error:", error);
}
run();

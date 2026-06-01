import { createClient } from '@supabase/supabase-js';
const supabase = createClient("https://api.absensikita.id", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE");
async function run() {
    let { data } = await supabase.from('absensi').select('id, waktu_masuk').like('waktu_masuk', '%Z');
    console.log("Remaining Zs?", data?.length);
    let { data: d2 } = await supabase.from('absensi').select('id, waktu_masuk').like('waktu_masuk', '%+00:00');
    console.log("Remaining +00:00s?", d2?.length);
}
run();

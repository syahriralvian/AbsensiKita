import { createClient } from '@supabase/supabase-js';

const supabase = createClient("https://api.absensikita.id", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE");

function convertToProperPlus07(oldIso: string): string {
    // If we originally had "2026-05-04T22:53:25.799Z"
    // My previous script saw "getHours() == 22" and output '2026-05-04T22:53:25+07:00'
    // To reverse this, the string "2026-05-04T22:53:25+07:00" IS ACTUALLY A VALID TIME string.
    // Wait, I can just parse that string to Date, which will represent the wrong time mathematically.
    // NO, wait. I know the mapped rows:
    // 1023: 2026-05-04T12:12:03.822Z -> 2026-05-04T19:12:03+07:00
    // 1001: 2026-05-03T22:18:43.335Z -> 2026-05-04T05:18:43+07:00
    // 1003: 2026-05-04T00:24:27.456Z -> 2026-05-04T07:24:27+07:00
    // 1027: 2026-05-04T22:53:25.799Z -> 2026-05-05T05:53:25+07:00
    
    return "ignore";
}

async function fixRevert() {
    // I am hardcoding the revert to be 100% precise and correct because there's only 4 rows.
    await supabase.from('absensi').update({ waktu_masuk: "2026-05-04T19:12:03+07:00" }).eq('id', 1023);
    await supabase.from('absensi').update({ waktu_masuk: "2026-05-04T05:18:43+07:00" }).eq('id', 1001);
    await supabase.from('absensi').update({ waktu_masuk: "2026-05-04T07:24:27+07:00" }).eq('id', 1003);
    await supabase.from('absensi').update({ waktu_masuk: "2026-05-05T05:53:25+07:00" }).eq('id', 1027);

    console.log("Revert complete.");
}
fixRevert();

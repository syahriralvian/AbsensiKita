import { createClient } from "@supabase/supabase-js";
const supabase = createClient("https://api.absensikita.id", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE");

const cleanOrphans = async () => {
    const { data: companies } = await supabase.from('companies').select('company_id');
    const validIds = companies?.map(c => c.company_id) || [];
    
    // We can't delete directly without specifying company_ids since we want to only delete invalid
    // But since the number of orphaned companies might be small, we can fetch all karyawans, filter orphans and then delete by company_id.
    const { data: all_karyawan } = await supabase.from('karyawan').select('company_id');
    const orphanCompanyIds = new Set(all_karyawan?.map(k => k.company_id).filter(id => !validIds.includes(id)));
    
    for (const orphanId of orphanCompanyIds) {
      console.log(`Deleting orphans for company_id: ${orphanId}`);
      await supabase.from("absensi").delete().eq("company_id", orphanId);
      await supabase.from("karyawan").delete().eq("company_id", orphanId);
      await supabase.from("departemen").delete().eq("company_id", orphanId);
      await supabase.from("shifts").delete().eq("company_id", orphanId);
      await supabase.from("cycles").delete().eq("company_id", orphanId);
      await supabase.from("hari_libur").delete().eq("company_id", orphanId);
      await supabase.from("jam_break").delete().eq("company_id", orphanId);
    }
    console.log("Cleanup complete!");
};

cleanOrphans().catch(console.error);

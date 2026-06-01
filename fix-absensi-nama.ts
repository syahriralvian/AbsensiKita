import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_KEY as string);

async function run() {
  const { data: emps, error } = await supabase.from('karyawan').select('nip, nama, company_id');
  if (!emps) return;
  for (const emp of emps) {
    if (emp.nama.startsWith('Staff ')) {
      // Find actual records? No just update all, or just skip if it's already 'Staff 2'
      // Wait we want to update the records in absensi
    }
    await supabase.from('absensi')
        .update({ nama: emp.nama })
        .eq('company_id', emp.company_id)
        .eq('nip', emp.nip);
    console.log(`Updated absensi for ${emp.nama}`);
  }
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY as string);

async function run() {
  const { data, error } = await supabase.from('absensi').select('*');
  console.log("Absensi count:", data?.length);
  if (data) {
     const vian = data.filter(d => d.nama.toLowerCase().includes('vian'));
     console.log("Vian:", vian);
  }
}
run();

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL as string, process.env.VITE_SUPABASE_ANON_KEY as string);

async function run() {
           const now = new Date();
           const todayWIB = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
           const todayStr = todayWIB.getFullYear() + '-' + String(todayWIB.getMonth() + 1).padStart(2, '0') + '-' + String(todayWIB.getDate()).padStart(2, '0');
           
           console.log("todayStr:", todayStr);
           const start = `${todayStr}T00:00:00+07:00`;
           const end = `${todayStr}T23:59:59+07:00`;

           const { data: absensi } = await supabase.from('absensi').select('nip, nama, tipe, waktu_masuk').eq('company_id', 'CO-01A005F6').gte('waktu_masuk', start).lte('waktu_masuk', end);
           console.log("Found:", absensi?.length);
           if (absensi) {
              const vian = absensi.filter(d => d.nama.toLowerCase().includes('vian'));
              console.log("Vian today:", vian);
           }
}
run();

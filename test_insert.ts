import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('adms_connections').insert([
    {
      sn_mesin: 'TEST_AGENT',
      ip_mesin: '127.0.0.1',
      status: 'ONLine',
      merk_tipe: 'AGENT_TEST',
      realtime: new Date().toISOString()
    }
  ]);
  console.log("INSERT Error:", error);
  console.log("INSERT Data:", data);
}

run();

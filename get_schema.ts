import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);

async function checkRealtime() {
  const { data, error } = await supabase.rpc('get_adms_info'); // Wait I can just check data type from information_schema
  
}
checkRealtime();

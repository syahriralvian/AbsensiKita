import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);

async function checkRealtime() {
  const { data, error } = await supabase.from('adms_connections')
    .select('*')
    .eq('sn_mesin', 'ACQA193760001')
    .limit(1);
  if (data) console.log(Object.keys(data[0]));
}
checkRealtime();

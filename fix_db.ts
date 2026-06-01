import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;

import { createClient } from '@supabase/supabase-js';
const supabase = createClient(url, key);

async function fixRealtime() {
  const { data, error } = await supabase.from('adms_connections')
    .select('id, realtime')
    .not('realtime', 'is', null);

  if (error) {
    console.error(error);
    return;
  }

  console.log(`Found ${data.length} rows with realtime...`);
  
  let count = 0;
  for (const row of data) {
    if (/\+00:00$/.test(row.realtime) && !/\.\d+/.test(row.realtime)) {
        const ts = new Date(row.realtime).getTime();
        const correctTs = ts - 7 * 60 * 60 * 1000;
        await supabase.from('adms_connections').update({
          realtime: new Date(correctTs).toISOString()
        }).eq('id', row.id);
        count++;
    }
  }
  console.log(`Updated ${count} rows`);
}
fixRealtime();

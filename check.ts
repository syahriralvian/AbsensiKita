import { supabase } from './src/lib/supabase.ts';

async function run() {
  const { data, error } = await supabase
    .from('absensi')
    .select('*')
    .eq('nama', 'Luxy Alvi')
    .order('id', { ascending: false });
  console.log(JSON.stringify(data, null, 2));
}

run();

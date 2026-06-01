import { supabase } from './src/lib/supabase.ts';

async function run() {
  const { data, error } = await supabase.rpc('get_column_info', { table_name: 'absensi' });
  console.log("RPC Error?", error);

  // Fallback: Check if we can deduce type by doing some operations
}

run();

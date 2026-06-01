import { supabase } from './src/lib/supabase.ts';
async function test() {
  const { data: shifts } = await supabase.from('shifts').select('*').eq('company_id', 'DEMO-123');
  console.log(shifts);
}
test();

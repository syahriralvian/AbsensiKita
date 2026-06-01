import { supabase } from './src/lib/supabase.ts';
async function test() {
  await supabase.from('shifts').update({ work_time: 480 }).in('id', [31, 32, 33]);
  const { data: shifts } = await supabase.from('shifts').select('*').eq('company_id', 'DEMO-123');
  console.log(shifts);
}
test();

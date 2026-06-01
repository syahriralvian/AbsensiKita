import { supabase } from './src/lib/supabase.ts';
async function test() {
  const { data: depts } = await supabase.from('departemen').select('*').eq('company_id', 'DEMO-123');
  const { data: shifts } = await supabase.from('shifts').select('*').eq('company_id', 'DEMO-123');
  const { data: cycles } = await supabase.from('siklus_shift').select('*').eq('company_id', 'DEMO-123');
  
  console.log("Depts:", depts?.map(d => ({id: d.id, name: d.nama_departemen, rule: d.calculation_rule, fixed: d.fixed_shift_id, siklus: d.siklus_id, auto: d.auto_shift_ids})));
  console.log("Shifts:", shifts?.map(s => s.id));
  console.log("Cycles:", cycles?.map(c => c.id));
}
test();

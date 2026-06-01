import { supabase } from './src/lib/supabase.ts';
import { generateDemoDataIfNeeded } from './src/lib/demo.ts';

async function run() {
  console.log("Deleting demo absensi data...");
  const { error } = await supabase.from('absensi').delete().eq('company_id', 'DEMO-123');
  if (error) console.error(error);
  
  console.log("Generating fresh demo data...");
  await generateDemoDataIfNeeded();
  console.log("Done.");
  process.exit(0);
}

run();

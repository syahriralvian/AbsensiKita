import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseKey);

async function clearCommands() {
  const { data, error } = await supabase.from('machine_commands').delete().eq('status', 'PENDING');
  console.log("Deleted pending commands", error, data);
}
clearCommands();

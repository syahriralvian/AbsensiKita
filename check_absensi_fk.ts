import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = SUPABASE_KEY;

const supabase = createClient(SUPABASE_URL as string, SUPABASE_SERVICE_KEY as string);

async function run() {
  const { data, error } = await supabase.from('absensi').select('*').limit(1);
  console.log("Error?", error);
}
run();

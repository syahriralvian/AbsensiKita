import { createClient } from "@supabase/supabase-js";
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.biz.id";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function alter() {
  const { error } = await supabase.rpc('execute_sql', { query: `
    ALTER TABLE departemen ADD COLUMN IF NOT EXISTS lat NUMERIC;
    ALTER TABLE departemen ADD COLUMN IF NOT EXISTS lng NUMERIC;
    ALTER TABLE departemen ADD COLUMN IF NOT EXISTS radius NUMERIC;
  ` });
  console.log("Error:", error);
}
alter();

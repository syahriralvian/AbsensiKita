import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.id";
const key = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const supabase = createClient(url, key);

async function run() {
  console.log("Adding WA notification columns...");
  const { error } = await supabase.rpc('execute_sql', { query: `
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS wa_notif_enabled boolean DEFAULT false;
    ALTER TABLE companies ADD COLUMN IF NOT EXISTS wa_n8n_webhook_url text;
  ` });
  console.log("Error:", error);
}
run();

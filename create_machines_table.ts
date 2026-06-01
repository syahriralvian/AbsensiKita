import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || "https://api.absensikita.id";
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS machine_connections (
      sn TEXT PRIMARY KEY,
      company_id UUID,
      ip_address TEXT,
      last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      status TEXT DEFAULT 'ONLINE',
      merk_tipe TEXT DEFAULT 'BIOFINGER / ZKTECO'
    );
  `;
  const { error } = await supabase.rpc('execute_sql', { query });
  console.log("Creation Error:", error);
}
createTable();

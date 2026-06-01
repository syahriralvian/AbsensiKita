/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = typeof process !== 'undefined' && process?.env?.VITE_SUPABASE_URL 
  ? process.env.VITE_SUPABASE_URL 
  : (import.meta.env.VITE_SUPABASE_URL || "https://api.absensikita.id");

const supabaseAnonKey = typeof process !== 'undefined' && process?.env?.VITE_SUPABASE_ANON_KEY
  ? process.env.VITE_SUPABASE_ANON_KEY
  : (import.meta.env.VITE_SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyAgCiAgICAicm9sZSI6ICJhbm9uIiwKICAgICJpc3MiOiAic3VwYWJhc2UtZGVtbyIsCiAgICAiaWF0IjogMTY0MTc2OTIwMCwKICAgICJleHAiOiAxNzk5NTM1NjAwCn0.dc_X5iR_VP_qT0zsiyj_I_OZ2T9FtRU2BBNWN8Bu4GE");

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
  },
});


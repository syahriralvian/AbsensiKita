import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || "", process.env.VITE_SUPABASE_ANON_KEY || "");
supabase.from('machine_commands').select('*').limit(1).then(res => console.log(res.data ? Object.keys(res.data[0] || {}) : res.error));

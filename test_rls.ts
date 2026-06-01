import {createClient} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
// Use anon key
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabaseAnon = createClient(supabaseUrl, anonKey);

async function test() {
    const res = await supabaseAnon.from('adms_connections').select('*').limit(5);
    console.log("Anon select:", res.data?.length, res.error);
}
test();

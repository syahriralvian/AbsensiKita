import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
     const cmdRes = await fetch(`${url}/rest/v1/machine_commands?id=eq.1861`, {
       headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
     });
     console.log(await cmdRes.json());
}
run();

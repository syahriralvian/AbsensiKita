import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co";
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
    const res = await fetch(`${url}/rest/v1/adms_karyawan?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    console.log("Columns:", data.length > 0 ? Object.keys(data[0]) : "Empty");
    
    // Check if we have template indicators
    const res2 = await fetch(`${url}/rest/v1/adms_karyawan_templates?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const text2 = await res2.text();
    console.log("Templates table:", res2.status, text2.substring(0, 100));
}
run();

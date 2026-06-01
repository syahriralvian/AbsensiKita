import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const realCid = "CO-01A005F6";
const sn = "ACQA193760001";

async function run() {
     // with encode
     const sn_prefix1 = encodeURIComponent(`${sn}|%`);
     const cmdRes1 = await fetch(`${url}/rest/v1/machine_commands?company_id=eq.${realCid}&status=eq.PENDING&command=like.${sn_prefix1}&order=created_at.asc&limit=1`, {
       headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
     });
     console.log("With encode:", await cmdRes1.json());
     
     // without encode
     const sn_prefix2 = `${sn}|%`;
     const cmdRes2 = await fetch(`${url}/rest/v1/machine_commands?company_id=eq.${realCid}&status=eq.PENDING&command=like.${sn_prefix2}&order=created_at.asc&limit=1`, {
       headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
     });
     console.log("Without encode:", await cmdRes2.json());
}
run();

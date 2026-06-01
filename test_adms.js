import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const sn = "ACQA193760001";
const cid = "99009de1-2a6d-4952-ba61-8ffbeeb6cdb8"; // Need a real cid

async function run() {
  const admsRes = await fetch(`${url}/rest/v1/adms_connections?sn_mesin=eq.${sn}&limit=1`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const adms = await admsRes.json();
  console.log("ADMS:", adms);
  
  if (adms && adms.length > 0) {
     const realCid = adms[0].company_id;
     
     const sn_prefix = encodeURIComponent(`${sn}|%`);
     // console.log("sn_prefix encoded:", sn_prefix);
     
     // What `server.ts` does:
     const cmdRes = await fetch(`${url}/rest/v1/machine_commands?company_id=eq.${realCid}&status=eq.PENDING&command=like.${sn_prefix}&order=created_at.asc&limit=1`, {
       headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
     });
     const commands = await cmdRes.json();
     console.log("COMANDS for sn:", commands);
  }
}
run();

import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
    const sn = "ACQA193760001";
    const admsRes = await fetch(`${url}/rest/v1/adms_connections?sn_mesin=eq.${sn}&limit=1`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const adms = await admsRes.json();
    console.log("adms for ACQA193760001:", adms);
}
run();

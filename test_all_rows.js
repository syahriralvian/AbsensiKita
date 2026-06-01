import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL; 
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
    const res = await fetch(`${url}/rest/v1/adms_connections?sn_mesin=eq.ACQA193760001`, {
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    const data = await res.json();
    console.log("All rows for ACQA193760001:", data);
}
run();

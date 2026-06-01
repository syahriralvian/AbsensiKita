import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function run() {
    const res = await fetch(`${url}/rest/v1/karyawan?company_id=eq.none`, {
        method: "POST",
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({nip: "TEST", nama: "TEST", role: "USER", company_id: "none", face_embedding: {fp: [1,2]}})
    });
    console.log("Status:", res.status, await res.text());
}
run();

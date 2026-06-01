import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_ANON_KEY;
async function run() {
    const res = await fetch(`${url}/rest/v1/karyawan?limit=1`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    console.log("face_embedding type/value:", typeof data[0].face_embedding, data[0].face_embedding);
}
run();

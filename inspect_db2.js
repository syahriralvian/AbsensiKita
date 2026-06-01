import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co";
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
    const res = await fetch(`${url}/rest/v1/?apikey=${key}`);
    const data = await res.json();
    const table = data.definitions.adms_karyawan;
    console.log("adms_karyawan properties:", table ? Object.keys(table.properties) : table);
}
run();

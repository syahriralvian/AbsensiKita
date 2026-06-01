import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
    // Delete commands that are PENDING and belong to a machine that is NOT registered to the company
    const res = await fetch(`${url}/rest/v1/machine_commands?status=eq.PENDING&command=like.ACQA193760001|%`, {
        method: 'DELETE',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`
        }
    });

    console.log("Delete status:", res.status, await res.text());
}
run();

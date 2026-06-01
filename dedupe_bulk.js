import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://kcvdmdnnydpsgohwqyqy.supabase.co"; 
const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

async function run() {
    const sn = "ACQA193760001";
    const rowsRes = await fetch(`${url}/rest/v1/adms_connections?sn_mesin=eq.${sn}&order=created_at.desc`, {
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const rows = await rowsRes.json();

    if (rows.length > 1) {
        let bestRow = rows.find(r => r.status === 'REGISTERED');
        if (!bestRow) {
            rows.sort((a,b) => new Date(b.realtime || b.created_at).getTime() - new Date(a.realtime || a.created_at).getTime());
            bestRow = rows[0];
        }

        console.log(`Keep id: ${bestRow.id}`);

        const res = await fetch(`${url}/rest/v1/adms_connections?sn_mesin=eq.${sn}&id=neq.${bestRow.id}`, {
            method: 'DELETE',
            headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
        });
        console.log("Delete status:", res.status, await res.text());
    }
}
run();

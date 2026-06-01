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
    
    if (!admsRes.ok) {
        console.error("Fetch adms error", await admsRes.text());
        return;
    }

    const adms = await admsRes.json();
    console.log("adms:", adms);

    if (adms && adms.length > 0) {
        const patchRes = await fetch(`${url}/rest/v1/adms_connections?id=eq.${adms[0].id}`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                last_sync: new Date().toISOString()
            })
        });

        if (!patchRes.ok) {
            console.error("Patch error:", patchRes.status, await patchRes.text());
        } else {
            console.log("Patch success");
        }
    }
}
run();

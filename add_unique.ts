import {createClient} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';

async function addUnique() {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
        },
        body: JSON.stringify({
            query: "ALTER TABLE adms_connections ADD CONSTRAINT unique_sn_mesin UNIQUE(sn_mesin);"
        })
    });
    console.log(await res.text());
}
addUnique();

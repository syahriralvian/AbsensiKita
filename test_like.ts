import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function test() {
    // Testing specific API call exactly as PHP does
    const res = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/machine_commands?status=eq.PENDING&command=not.like.*%7C*`, {
        headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
        }
    });
    console.log("Global commands:", await res.json());

    const res2 = await fetch(`${process.env.VITE_SUPABASE_URL}/rest/v1/machine_commands?status=eq.PENDING&command=like.*%7C*`, {
        headers: {
            'apikey': process.env.VITE_SUPABASE_ANON_KEY!,
            'Authorization': `Bearer ${process.env.VITE_SUPABASE_ANON_KEY!}`
        }
    });
    console.log("Specific commands:", await res2.json());
}
test();

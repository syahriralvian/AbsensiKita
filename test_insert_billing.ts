import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(url, key);

async function checkInsert() {
  const { data, error } = await supabase.from('billing_history').insert({
    company_id: "c4b4a3a6-bba0-4250-93a0-f8fa26922d0c", // some fake id
    total_amount: 50000,
    employee_count: 5,
    billing_period: new Date().toISOString()
  }).select();

  console.log("Insert result:", data, error);
}

checkInsert();

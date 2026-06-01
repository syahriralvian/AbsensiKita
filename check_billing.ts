import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function check() {
  const response = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const json = await response.json();
  const def = json.definitions.billing_history;
  console.log(def.properties);
}
check();

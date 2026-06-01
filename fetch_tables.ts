import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || "https://api.absensikita.id";
const key = process.env.VITE_SUPABASE_ANON_KEY;

async function fetchTables() {
  const response = await fetch(`${url}/rest/v1/?apikey=${key}`);
  const data = await response.json();
  const tables = Object.keys(data.paths).map(p => p.slice(1));
  console.log(tables);
}

fetchTables();

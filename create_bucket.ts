import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("Checking buckets...");
  const { data: buckets } = await supabase.storage.listBuckets();
  console.log(buckets);
  
  if (!buckets?.find(b => b.name === 'downloads')) {
    console.log("Creating downloads bucket...");
    const { data, error } = await supabase.storage.createBucket('downloads', { public: true });
    console.log(data, error);
  }
}
run();

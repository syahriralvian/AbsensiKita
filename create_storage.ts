import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);

async function run() {
  console.log("Setting up storage bucket...");
  const query = `
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('downloads', 'downloads', true) 
    ON CONFLICT (id) DO NOTHING;
    
    -- Allow public read access to downloads
    DROP POLICY IF EXISTS "Public Acces to downloads" ON storage.objects;
    CREATE POLICY "Public Acces to downloads" ON storage.objects FOR SELECT USING (bucket_id = 'downloads');
    
    -- Allow uploads to downloads
    DROP POLICY IF EXISTS "Public Upload to downloads" ON storage.objects;
    CREATE POLICY "Public Upload to downloads" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'downloads');
    
    DROP POLICY IF EXISTS "Public Update to downloads" ON storage.objects;
    CREATE POLICY "Public Update to downloads" ON storage.objects FOR UPDATE USING (bucket_id = 'downloads');
    
    DROP POLICY IF EXISTS "Public Delete to downloads" ON storage.objects;
    CREATE POLICY "Public Delete to downloads" ON storage.objects FOR DELETE USING (bucket_id = 'downloads');
  `;
  
  const { data, error } = await supabase.rpc('execute_sql', { query });
  console.log("Result:", data, error);
}
run();

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDepartemen() {
  const { data, error } = await supabase.from('departemen').select('*').limit(1);
  if (error) {
    console.error('Error fetching departemen:', error);
  } else if (data && data.length > 0) {
    console.log('Keys in departemen:', Object.keys(data[0]));
    console.log('Sample row:', data[0]);
  } else {
    console.log('No data found in departemen');
  }
}
checkDepartemen();

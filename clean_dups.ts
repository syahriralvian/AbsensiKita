import {createClient} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || 'https://api.absensikita.biz.id', process.env.VITE_SUPABASE_ANON_KEY || '');

async function clean() {
    const { data } = await supabase.from('adms_connections').select('*').eq('sn_mesin', 'ACQA193760001').order('realtime', { ascending: false });
    if(data && data.length > 1) {
        console.log(`Found ${data.length} records. Keeping 1, deleting ${data.length - 1}`);
        const idsToDelete = data.slice(1).map(x => x.id);
        
        // chunk deletion
        for(let i=0; i<idsToDelete.length; i+=100) {
            const chunk = idsToDelete.slice(i, i+100);
            await supabase.from('adms_connections').delete().in('id', chunk);
            console.log(`Deleted chunk ${i} to ${i+chunk.length}`);
        }
    }
}
clean();

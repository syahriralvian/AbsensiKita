import {createClient} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();
const supabase = createClient(process.env.VITE_SUPABASE_URL || 'https://api.absensikita.biz.id', process.env.VITE_SUPABASE_ANON_KEY || '');

async function clean() {
    const { data } = await supabase.from('adms_connections').select('*').order('realtime', { ascending: false });
    if(data) {
        const sns = data.map(x => x.sn_mesin);
        const uniqueSns = new Set(sns);
        console.log(`Total: ${sns.length}, Unique SNs: ${uniqueSns.size}`);

        const snCount: Record<string, any[]> = {};
        data.forEach(x => {
            if(!snCount[x.sn_mesin]) snCount[x.sn_mesin] = [];
            snCount[x.sn_mesin].push(x);
        });

        for(const sn in snCount) {
            if(snCount[sn].length > 1) {
               console.log(`SN ${sn} has ${snCount[sn].length} duplicates`);
               const idsToDelete = snCount[sn].slice(1).map(x => x.sn_mesin ? x.id : null).filter(Boolean); // Keep the first
               for(let i=0; i<idsToDelete.length; i+=100) {
                    const chunk = idsToDelete.slice(i, i+100);
                    await supabase.from('adms_connections').delete().in('id', chunk);
               }
            }
        }
        console.log("Cleanup done.");
    }
}
clean();

import {createClient} from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL || '', process.env.VITE_SUPABASE_ANON_KEY || '');

async function cleanCmds() {
    console.log("Starting machine_commands cleanup...");
    
    // 1. Delete all CANCELLED commands
    const { error: err1 } = await supabase.from('machine_commands').delete().eq('status', 'CANCELLED');
    if (err1) console.error("Error deleting CANCELLED:", err1);
    else console.log("Deleted all CANCELLED commands");

    // 2. Clear duplicates from PENDING / SUCCESS
    const { data } = await supabase.from('machine_commands').select('*');
    if (data) {
       console.log(`Found ${data.length} total commands remaining.`);
       // Keep unique commands by tracking signature: company + command + status
       const sigMap = new Map();
       const toDelete = [];
       for (const cmd of data) {
           const sig = `${cmd.company_id}_${cmd.command}_${cmd.status}`;
           if (sigMap.has(sig)) {
               toDelete.push(cmd.id);
           } else {
               sigMap.set(sig, true);
           }
       }
       if (toDelete.length > 0) {
           console.log(`Found ${toDelete.length} duplicate commands. Deleting...`);
           for(let i=0; i<toDelete.length; i+=100) {
               const chunk = toDelete.slice(i, i+100);
               await supabase.from('machine_commands').delete().in('id', chunk);
           }
           console.log("Duplicates deleted.");
       }
    }
}
cleanCmds();

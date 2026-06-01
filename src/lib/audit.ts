import { supabase } from './supabase';
import { AuditLog, User } from '../types';

export async function createAuditLog(
  user: User,
  action: AuditLog['action_type'],
  table: string,
  targetId: string,
  oldData: any,
  newData: any
) {
  try {
    let ip = 'Unknown';
    try {
      // Use a free service to get public IP
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ip = data.ip;
    } catch (e) {
      console.warn('Could not fetch IP for audit log', e);
    }

    const { error } = await supabase.from('audit_logs').insert({
      company_id: user.company_id === 'SYSTEM' ? null : user.company_id,
      nip_executor: user.nip,
      nama_executor: user.nama,
      action_type: action,
      target_table: table,
      target_id: targetId,
      old_data: oldData,
      new_data: newData,
      ip_address: ip,
      // created_at will be handled by Supabase default now()
    });

    if (error) {
      console.error('Database error creating audit log:', error);
    }
  } catch (error) {
    console.error('System error creating audit log:', error);
  }
}

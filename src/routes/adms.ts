
import { Request, Response, Router } from 'express';
import { supabase } from '../lib/supabase';

export const admsRouter = Router();

// Helper to get client IP
const getClientIP = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const ips = (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',');
    return ips[0].trim();
  }
  return req.socket.remoteAddress || '';
};

admsRouter.get('/iclock/cdata', async (req: Request, res: Response) => {
  try {
    const sn = req.query.SN as string;
    if (!sn) { res.send('ERROR'); return; }
    const ip = getClientIP(req);
    const now = new Date().toISOString();

    const { data: connection } = await supabase.from('adms_connections').select('*').eq('sn_mesin', sn).limit(1).single();

    let offset = 420;
    if (connection && connection.timezone) {
      if (connection.timezone === 'Asia/Makassar') offset = 480;
      if (connection.timezone === 'Asia/Jayapura') offset = 540;
    }

    if (connection) {
      await supabase.from('adms_connections').update({ ip_mesin: ip, realtime: now, status: 'ONLINE' }).eq('sn_mesin', sn);
    } else {
      await supabase.from('adms_connections').insert({ sn_mesin: sn, ip_mesin: ip, status: 'ONLINE', merk_tipe: 'Mesin Absensi (ADMS)', realtime: now });
    }

    res.send("GETOPTION FROM:" + sn + "\nStamp=9999\nOpStamp=9999\nErrorDelay=60\nDelay=10\nTransTimes=00:00;14:00\nTransInterval=1\nTransFlag=1111000000\nTimeZone=" + offset + "\nRealtime=1\nEncrypt=0\n");
  } catch (error) {
    console.error('ADMS /iclock/cdata GET error:', error);
    res.status(500).send('ERROR');
  }
});

admsRouter.post('/iclock/cdata', async (req: Request, res: Response) => {
  try {
    const sn = req.query.SN as string;
    const table = req.query.table as string;
    const body = req.body as string;

    if (sn) {
      const ip = getClientIP(req);
      const now = new Date().toISOString();

      const { data: connection } = await supabase.from('adms_connections').select('*').eq('sn_mesin', sn).limit(1).single();

      if (connection) {
        await supabase.from('adms_connections').update({ ip_mesin: ip, realtime: now, status: 'ONLINE' }).eq('sn_mesin', sn);
      } else {
        await supabase.from('adms_connections').insert({ sn_mesin: sn, ip_mesin: ip, status: 'ONLINE', merk_tipe: 'Mesin Absensi (ADMS)', realtime: now });
      }

      if (body && typeof body === 'string') {
        const companyId = connection?.company_id;

        if (table === 'USER' || table === 'USERINFO') {
          console.log(`Received ${table} for`, sn);
          const lines = body.toString().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          
          if (companyId) {
            for (const line of lines) {
              // Parse key-value pairs (e.g. PIN=1\tName=Andika\tPri=0)
              const pairs = line.split('\t');
              const userData: any = {};
              for (const pair of pairs) {
                const eqIdx = pair.indexOf('=');
                if (eqIdx > -1) {
                  const key = pair.substring(0, eqIdx).trim();
                  const value = pair.substring(eqIdx + 1).trim();
                  userData[key] = value;
                }
              }

              const pin = userData['PIN'] || userData['pin'];
              const name = userData['Name'] || userData['name'] || `Karyawan ${pin}`;

              if (pin) {
                // Upsert to karyawan table
                const { data: existingUser } = await supabase.from('karyawan').select('nip').eq('company_id', companyId).eq('nip', pin).single();
                
                if (!existingUser) {
                  console.log(`Creating new employee ${pin} from device ${sn}`);
                  await supabase.from('karyawan').insert({
                    company_id: companyId,
                    nip: pin,
                    nama: name,
                    role: 'Pegawai',
                    last_updated: Date.now()
                  });
                } else if (name && !name.startsWith('Karyawan ')) {
                   await supabase.from('karyawan').update({ nama: name, last_updated: Date.now() }).eq('company_id', companyId).eq('nip', pin);
                }
              }
            }
          }
        } else if (table === 'ATTLOG') {
          console.log('Received ATTLOG for', sn);
          const lines = body.toString().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
          
          let userMap: Record<string, string> = {};
          if (companyId) {
            const { data: users } = await supabase.from('karyawan').select('nip, nama').eq('company_id', companyId);
            if (users) {
              userMap = users.reduce((acc: any, u: any) => { acc[u.nip] = u.nama; return acc; }, {});
            }
          }

          const records = [];
          for (const line of lines) {
            const cols = line.split(/\s+/); // ADMS can use tabs or multiple spaces
            if (cols.length >= 3) {
              const pin = cols[0];
              const dateStr = cols[1]; 
              const timeStr = cols[2];
              
              let datetime = '';
              let statusFlag = '0';

              if (dateStr && dateStr.includes('-') && timeStr && timeStr.includes(':')) {
                datetime = dateStr + 'T' + timeStr + '+07:00'; // Default WIB
                statusFlag = cols[3] || '0';
              } else if (dateStr && dateStr.includes('-')) {
                 datetime = dateStr + 'T00:00:00+07:00';
              }

              if (datetime) { // removed userMap[pin] requirement so we don't drop attendance limits
                // Auto create user if not exists
                if (!userMap[pin] && companyId) {
                   const defaultName = 'Karyawan ' + pin;
                   userMap[pin] = defaultName;
                   await supabase.from('karyawan').insert({
                     company_id: companyId,
                     nip: pin,
                     nama: defaultName,
                     role: 'Pegawai',
                     last_updated: Date.now()
                   });
                }

                let tipe = 'MASUK';
                if (statusFlag === '1') tipe = 'PULANG';
                else if (statusFlag === '2') tipe = 'KELUAR';
                else if (statusFlag === '3') tipe = 'KEMBALI';
                else if (statusFlag === '4') tipe = 'LEMBUR_MASUK';
                else if (statusFlag === '5') tipe = 'LEMBUR_KELUAR';

                records.push({
                  company_id: companyId,
                  nip: pin,
                  nama: userMap[pin] || ('Karyawan ' + pin),
                  waktu_masuk: datetime,
                  tipe: tipe,
                  keterangan: 'Log Mesin ' + sn
                });
              }
            }
          }
          if (records.length > 0) { await supabase.from('absensi').insert(records); }
        }
      }
    }
    res.send('OK');
  } catch (error) {
    console.error('ADMS /iclock/cdata POST error:', error);
    res.status(500).send('ERROR');
  }
});

admsRouter.get('/iclock/getrequest', async (req: Request, res: Response) => {
  try {
    const sn = req.query.SN as string;
    if (!sn) { res.send('OK'); return; }
    const ip = getClientIP(req);
    const now = new Date().toISOString();
    const { data: connection } = await supabase.from('adms_connections').select('*').eq('sn_mesin', sn).limit(1).single();

    if (connection) {
      await supabase.from('adms_connections').update({ ip_mesin: ip, realtime: now, status: 'ONLINE' }).eq('sn_mesin', sn);
      if (connection.company_id) {
        const { data: commands } = await supabase.from('machine_commands')
          .select('*')
          .eq('company_id', connection.company_id)
          .eq('status', 'PENDING')
          .or(`command.like.${sn}|%,command.not.like.%|%`)
          .order('id', { ascending: true })
          .limit(10);
        if (commands && commands.length > 0) {
          for (const cmd of commands) {
            const parts = cmd.command.split('|');
            if (parts.length === 2) {
              if (parts[0] === sn) { res.send("C:" + cmd.id + ":" + parts[1]); return; }
            } else {
              res.send("C:" + cmd.id + ":" + cmd.command); return;
            }
          }
        }
      }
    } else {
      await supabase.from('adms_connections').insert({ sn_mesin: sn, ip_mesin: ip, status: 'ONLINE', merk_tipe: 'Mesin Absensi (ADMS)', realtime: now });
    }
    res.send('OK');
  } catch (error) {
    console.error('ADMS /iclock/getrequest error:', error);
    res.status(500).send('ERROR');
  }
});

admsRouter.post('/iclock/devicecmd', async (req: Request, res: Response) => {
  try {
    const body = req.body as string;
    if (body && typeof body === 'string') {
      const lines = body.toString().split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
      for (const line of lines) {
        const params = new URLSearchParams(line);
        const cmdId = params.get('ID');
        const ret = params.get('Return') || '-1';
        if (cmdId) {
          await supabase.from('machine_commands').update({ status: (ret === '0') ? 'SUCCESS' : 'FAILED' }).eq('id', cmdId);
        }
      }
    }
    res.send('OK');
  } catch (error) {
    console.error('ADMS /iclock/devicecmd error:', error);
    res.status(500).send('ERROR');
  }
});

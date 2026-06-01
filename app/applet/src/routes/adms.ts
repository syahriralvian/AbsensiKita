import { Request, Response, Router } from "express";
import { supabase } from "../lib/supabase"; 

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
  const sn = req.query.SN as string;
  if (!sn) {
    res.send("ERROR");
    return;
  }

  const ip = getClientIP(req);
  const now = new Date().toISOString();

  const { data: connection } = await supabase
    .from('adms_connections')
    .select('*')
    .eq('sn_mesin', sn)
    .limit(1)
    .single();

  let offset = 420; // WIB (UTC+7 = 420 mins)
  if (connection && connection.timezone) {
    if (connection.timezone === 'Asia/Makassar') offset = 480;
    if (connection.timezone === 'Asia/Jayapura') offset = 540;
  }

  if (connection) {
    await supabase.from('adms_connections').update({
      ip_mesin: ip,
      realtime: now
    }).eq('sn_mesin', sn);
  } else {
    await supabase.from('adms_connections').insert({
      sn_mesin: sn,
      ip_mesin: ip,
      status: 'ONLINE',
      merk_tipe: 'Mesin Absensi (ADMS)',
      realtime: now
    });
  }

  res.send(
    `GETOPTION FROM:${sn}\n` +
    `Stamp=9999\n` +
    `OpStamp=9999\n` +
    `ErrorDelay=60\n` +
    `Delay=10\n` +
    `TransTimes=00:00;14:00\n` +
    `TransInterval=1\n` +
    `TransFlag=1111000000\n` +
    `TimeZone=${offset}\n` +
    `Realtime=1\n` +
    `Encrypt=0\n`
  );
});

admsRouter.post('/iclock/cdata', async (req: Request, res: Response) => {
  const sn = req.query.SN as string;
  const table = req.query.table as string;
  const body = req.body as string;

  if (sn) {
    const ip = getClientIP(req);
    const now = new Date().toISOString();

    const { data: connection } = await supabase
      .from('adms_connections')
      .select('*')
      .eq('sn_mesin', sn)
      .limit(1)
      .single();

    if (connection) {
      await supabase.from('adms_connections').update({
        ip_mesin: ip,
        realtime: now
      }).eq('sn_mesin', sn);
    } else {
      await supabase.from('adms_connections').insert({
        sn_mesin: sn,
        ip_mesin: ip,
        status: 'ONLINE',
        merk_tipe: 'Mesin Absensi (ADMS)',
        realtime: now
      });
    }

    if (body && table === 'ATTLOG') {
      const lines = body.toString().split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const companyId = connection?.company_id;
      
      let userMap: Record<string, string> = {};
      if (companyId) {
        const { data: users } = await supabase
          .from('karyawan')
          .select('nip, nama')
          .eq('company_id', companyId);
        
        if (users) {
          userMap = users.reduce((acc, u) => {
            acc[u.nip] = u.nama;
            return acc;
          }, {} as Record<string, string>);
        }
      }

      const records = [];
      for (const line of lines) {
        const cols = line.split(/\s+/);
        if (cols.length >= 2) {
          const pin = cols[0];
          let datetime = cols[1];
          if (cols[2] && !isNaN(parseInt(cols[2].split(':')[0], 10))) {
            datetime += `T${cols[2]}`;
          } else {
            datetime += `T00:00:00`;
          }
          
          let statusFlag = cols[3] || "0";
          
          if (userMap[pin]) {
            let tipe = "MASUK";
            if (statusFlag === "1") tipe = "PULANG";
            else if (statusFlag === "2") tipe = "KELUAR";
            else if (statusFlag === "3") tipe = "KEMBALI";
            else if (statusFlag === "4") tipe = "LEMBUR_MASUK";
            else if (statusFlag === "5") tipe = "LEMBUR_KELUAR";

            records.push({
              company_id: companyId,
              nip: pin,
              nama: userMap[pin],
              waktu_masuk: datetime + "+07:00",
              tipe: tipe,
              keterangan: "Log Mesin " + sn
            });
          }
        }
      }

      if (records.length > 0) {
        await supabase.from('absensi').insert(records);
      }
    }
  }

  res.send("OK");
});

admsRouter.get('/iclock/getrequest', async (req: Request, res: Response) => {
  const sn = req.query.SN as string;
  if (!sn) {
    res.send("OK");
    return;
  }

  const ip = getClientIP(req);
  const now = new Date().toISOString();

  const { data: connection } = await supabase
    .from('adms_connections')
    .select('*')
    .eq('sn_mesin', sn)
    .limit(1)
    .single();

  if (connection) {
    await supabase.from('adms_connections').update({ ip_mesin: ip, realtime: now }).eq('sn_mesin', sn);
    
    if (connection.company_id) {
      const { data: commands } = await supabase
        .from('machine_commands')
        .select('*')
        .eq('company_id', connection.company_id)
        .eq('status', 'PENDING')
        .order('id', { ascending: true })
        .limit(10);
      
      if (commands && commands.length > 0) {
        for (const cmd of commands) {
          const parts = cmd.command.split('|');
          if (parts.length === 2) {
            const targetSn = parts[0];
            const actualCmd = parts[1];
            if (targetSn === sn) {
              res.send(`C:${cmd.id}:${actualCmd}`);
              return;
            }
          } else {
            res.send(`C:${cmd.id}:${cmd.command}`);
            return;
          }
        }
      }
    }
  } else {
    await supabase.from('adms_connections').insert({
      sn_mesin: sn,
      ip_mesin: ip,
      status: 'ONLINE',
      merk_tipe: 'Mesin Absensi (ADMS)',
      realtime: now
    });
  }

  res.send("OK");
});

admsRouter.post('/iclock/devicecmd', async (req: Request, res: Response) => {
  const body = req.body as string;
  if (body) {
    const lines = body.toString().split('\n').map(l => l.trim()).filter(l => l.length > 0);
    for (const line of lines) {
      const params = new URLSearchParams(line);
      const cmdId = params.get('ID');
      const ret = params.get('Return') || '-1';
      
      if (cmdId) {
        const status = (ret === '0') ? 'SUCCESS' : 'FAILED';
        await supabase
          .from('machine_commands')
          .update({ status: status, updated_at: new Date().toISOString() })
          .eq('id', cmdId);
      }
    }
  }
  res.send("OK");
});

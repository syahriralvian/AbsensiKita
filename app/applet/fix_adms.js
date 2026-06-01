const fs = require('fs');
let code = fs.readFileSync('src/routes/adms.ts', 'utf8');

const start = code.indexOf("if (body && table === 'ATTLOG') {");
const end = code.indexOf("  res.send('OK');");

const newAtLog = `if (body && table === 'ATTLOG') {
      console.log('Received ATTLOG for', sn, body);
      const lines = body.toString().split(/\\r?\\n/).map(l => l.trim()).filter(l => l.length > 0);
      const companyId = connection?.company_id;
      
      let userMap: Record<string, string> = {};
      if (companyId) {
        const { data: users } = await supabase.from('karyawan').select('nip, nama').eq('company_id', companyId);
        if (users) {
          userMap = users.reduce((acc, u) => { acc[u.nip] = u.nama; return acc; }, {} as Record<string, string>);
        }
      }

      const records = [];
      for (const line of lines) {
        const cols = line.split(/[\\s\\t]+/); // ADMS can use tabs or multiple spaces
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

          if (userMap[pin] && datetime) {
            let tipe = 'MASUK';
            if (statusFlag === '1') tipe = 'PULANG';
            else if (statusFlag === '2') tipe = 'KELUAR';
            else if (statusFlag === '3') tipe = 'KEMBALI';
            else if (statusFlag === '4') tipe = 'LEMBUR_MASUK';
            else if (statusFlag === '5') tipe = 'LEMBUR_KELUAR';

            records.push({
              company_id: companyId,
              nip: pin,
              nama: userMap[pin],
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
`;

code = code.substring(0, start) + newAtLog + code.substring(end);
fs.writeFileSync('src/routes/adms.ts', code);
console.log('Fixed post');

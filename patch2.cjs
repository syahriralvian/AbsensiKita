const fs = require('fs');
let code = fs.readFileSync('telegram.ts', 'utf8');

const oldStr = `      try {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const start = \`\${y}-\${m}-01T00:00:00.000Z\`;
        const end = new Date(y, d.getMonth() + 1, 0, 23, 59, 59).toISOString();
        
        let query = supabase
          .from('absensi')
          .select('nip, nama, tipe, waktu_masuk, lat, lng, image, status_acc')
          .eq('company_id', user.company_id)
          .gte('waktu_masuk', start)
          .lte('waktu_masuk', end)
          .order('waktu_masuk', { ascending: true });
          
        if (user.role === 'USER') {
           query = query.eq('nip', user.nip);
        }
        
        const { data: absensi, error } = await query;
        if (error) throw error;
        
        const records = absensi || [];
        if (records.length === 0) {
           return ctx.reply(\`Belum ada data absensi untuk bulan ini.\`);
        }
        
        const wb = XLSX.utils.book_new();
        let ws;
        
        if (reportKartuMatch) {
          const groupedKartu: any = {};
          records.forEach(r => {
             const dt = new Date(r.waktu_masuk);
             const dStr = dt.toLocaleDateString('id-ID'); // "10/5/2026"
             
             const dtSplit = dStr.split('/');
             const key = \`\${r.nip}_\${dtSplit[2]}-\${dtSplit[1]}-\${dtSplit[0]}\`; // nip_YYYY-MM-DD
             
             // Format Date to matching style DD/MM/YYYY
             const tglFormatted = \`\${dtSplit[0]}/\${dtSplit[1]}/\${dtSplit[2]}\`;
             
             if (!groupedKartu[key]) {
                groupedKartu[key] = {
                   "NIP": r.nip,
                   "Nama Kary": r.nama,
                   "Tanggal": tglFormatted,
                   "Jam Masuk": "-",
                   "Jam Keluar": "-",
                   "Jam Kembali": "-",
                   "Jam Pulang": "-",
                   "Lokasi (Lat, Lng)": "-"
                };
             }
             
             const tStr = dt.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }).replace(/\\./g, ':');
             
             if (r.tipe === 'MASUK') {
                groupedKartu[key]["Jam Masuk"] = tStr;
             }
             else if (r.tipe === 'KELUAR') {
                groupedKartu[key]["Jam Keluar"] = tStr;
             }
             else if (r.tipe === 'KEMBALI') {
                groupedKartu[key]["Jam Kembali"] = tStr;
             }
             else if (r.tipe === 'PULANG') {
                groupedKartu[key]["Jam Pulang"] = tStr;
             }
             
             if (r.lat && r.lng) {
                groupedKartu[key]["Lokasi (Lat, Lng)"] = \`\${r.lat}, \${r.lng}\`;
             }
          });
          
          ws = XLSX.utils.json_to_sheet(Object.values(groupedKartu));

        } else if (reportTotalMatch) {
          const agg: Record<string, any> = {};
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = { 
                  "PIN(NIP)": r.nip, 
                  "Nama": r.nama, 
                  "Aktual": 0, 
                  "Kerja": 0,
                  "Libur": 0, 
                  "Hadir": 0, 
                  "Absen": 0,
                  "C.Ijin": 0, 
                  "Telat": "-", 
                  "Early": "-",
                  "Break": "-",
                  "OverT": "-",
                  "JamHd": "-",
                  "JamOT": "-"
                };
             }
             // For telegram light version, simplistically count "Masuk" as Hadir
             if (r.tipe === "MASUK") {
                agg[r.nip]["Hadir"]++;
                agg[r.nip]["Kerja"]++;
             }
             if (r.status_acc === '1' && (r.tipe === 'CUTI' || r.tipe === 'SAKIT' || r.tipe === 'IJIN')) {
                agg[r.nip]["C.Ijin"]++;
             }
          });
          
          Object.values(agg).forEach(k => {
             k["Aktual"] = k["Hadir"] + k["C.Ijin"];
          });

          ws = XLSX.utils.json_to_sheet(Object.values(agg));
          
        } else if (reportRekapMatch) {
          const agg: Record<string, any> = {};
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = {
                   "PIN(NIP)": r.nip,
                   "Nama": r.nama
                };
             }
             const dStr = new Date(r.waktu_masuk).getDate(); // day 1-31
             const dt = new Date(r.waktu_masuk);
             const tStr = dt.toLocaleTimeString('id-ID', { hour12: false, hour: '2-digit', minute: '2-digit' }).replace(/\\./g, ':');
             
             if (!agg[r.nip][dStr]) agg[r.nip][dStr] = { m: "-", p: "-" };
             
             if (r.tipe === 'MASUK') {
                agg[r.nip][dStr].m = tStr;
             }
             else if (r.tipe === 'PULANG') {
                agg[r.nip][dStr].p = tStr;
             }
          });
          
          const daysInMonth = new Date(y, d.getMonth() + 1, 0).getDate();`;

const newStr = `      try {
        const tzDate = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
        const y = tzDate.getFullYear();
        const m = String(tzDate.getMonth() + 1).padStart(2, '0');
        const start = \`\${y}-\${m}-01T00:00:00+07:00\`;
        const endDay = new Date(y, tzDate.getMonth() + 1, 0).getDate();
        const end = \`\${y}-\${m}-\${String(endDay).padStart(2, '0')}T23:59:59+07:00\`;
        
        let query = supabase
          .from('absensi')
          .select('nip, nama, tipe, waktu_masuk, lat, lng, image, status_acc')
          .eq('company_id', user.company_id)
          .gte('waktu_masuk', start)
          .lte('waktu_masuk', end)
          .order('waktu_masuk', { ascending: true });
          
        if (user.role === 'USER') {
           query = query.eq('nip', user.nip);
        }
        
        const { data: absensi, error } = await query;
        if (error) throw error;
        
        const records = absensi || [];
        if (records.length === 0) {
           return ctx.reply(\`Belum ada data absensi untuk bulan ini.\`);
        }
        
        const wb = XLSX.utils.book_new();
        let ws;
        
        const dFormat = new Intl.DateTimeFormat('id-ID', {
            timeZone: 'Asia/Jakarta',
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
            hour12: false
        });
        
        if (reportKartuMatch) {
          const groupedKartu: any = {};
          records.forEach(r => {
             const dt = new Date(r.waktu_masuk);
             const parts = dFormat.format(dt).split(', ');
             const datePart = parts[0]; // DD/MM/YYYY
             const tStr = parts[1].replace(/\\./g, ':'); // HH:mm:ss
             
             const dtSplit = datePart.split('/');
             const key = \`\${r.nip}_\${dtSplit[2]}-\${dtSplit[1]}-\${dtSplit[0]}\`; // nip_YYYY-MM-DD
             
             if (!groupedKartu[key]) {
                groupedKartu[key] = {
                   "NIP": r.nip,
                   "Nama Kary": r.nama,
                   "Tanggal": datePart,
                   "Jam Masuk": "-",
                   "Jam Keluar": "-",
                   "Jam Kembali": "-",
                   "Jam Pulang": "-",
                   "Lokasi (Lat, Lng)": "-"
                };
             }
             
             if (r.tipe === 'MASUK') {
                groupedKartu[key]["Jam Masuk"] = tStr;
             }
             else if (r.tipe === 'KELUAR') {
                groupedKartu[key]["Jam Keluar"] = tStr;
             }
             else if (r.tipe === 'KEMBALI') {
                groupedKartu[key]["Jam Kembali"] = tStr;
             }
             else if (r.tipe === 'PULANG') {
                groupedKartu[key]["Jam Pulang"] = tStr;
             }
             
             if (r.lat && r.lng) {
                groupedKartu[key]["Lokasi (Lat, Lng)"] = \`\${r.lat}, \${r.lng}\`;
             }
          });
          
          ws = XLSX.utils.json_to_sheet(Object.values(groupedKartu));

        } else if (reportTotalMatch) {
          const agg: Record<string, any> = {};
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = { 
                  "PIN(NIP)": r.nip, 
                  "Nama": r.nama, 
                  "Aktual": 0, 
                  "Kerja": 0,
                  "Libur": 0, 
                  "Hadir": 0, 
                  "Absen": 0,
                  "C.Ijin": 0, 
                  "Telat": "-", 
                  "Early": "-",
                  "Break": "-",
                  "OverT": "-",
                  "JamHd": "-",
                  "JamOT": "-"
                };
             }
             // For telegram light version, simplistically count "Masuk" as Hadir
             if (r.tipe === "MASUK") {
                agg[r.nip]["Hadir"]++;
                agg[r.nip]["Kerja"]++;
             }
             if (r.status_acc === '1' && (r.tipe === 'CUTI' || r.tipe === 'SAKIT' || r.tipe === 'IJIN')) {
                agg[r.nip]["C.Ijin"]++;
             }
          });
          
          Object.values(agg).forEach(k => {
             k["Aktual"] = k["Hadir"] + k["C.Ijin"];
          });

          ws = XLSX.utils.json_to_sheet(Object.values(agg));
          
        } else if (reportRekapMatch) {
          const agg: Record<string, any> = {};
          records.forEach(r => {
             if (!agg[r.nip]) {
                agg[r.nip] = {
                   "PIN(NIP)": r.nip,
                   "Nama": r.nama
                };
             }
             
             const dt = new Date(r.waktu_masuk);
             const parts = dFormat.format(dt).split(', ');
             const datePart = parts[0]; // DD/MM/YYYY
             const tStrFull = parts[1].replace(/\\./g, ':'); // HH:mm:ss
             const tStrMatch = tStrFull.split(':');
             const tStr = \`\${tStrMatch[0]}:\${tStrMatch[1]}\`; // HH:mm
             
             const dStr = parseInt(datePart.split('/')[0], 10); // day 1-31
             
             if (!agg[r.nip][dStr]) agg[r.nip][dStr] = { m: "-", p: "-" };
             
             if (r.tipe === 'MASUK') {
                agg[r.nip][dStr].m = tStr;
             }
             else if (r.tipe === 'PULANG') {
                agg[r.nip][dStr].p = tStr;
             }
          });
          
          const daysInMonth = endDay;`;

if(code.indexOf(oldStr) === -1) {
  console.log("NOT FOUND OLD STR!");
} else {
  code = code.replace(oldStr, newStr);
  fs.writeFileSync('telegram.ts', code);
  console.log("PATCH SUCCESS");
}

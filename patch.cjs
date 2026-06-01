const fs = require('fs');
let content = fs.readFileSync('telegram.ts', 'utf8');

const replacement = `        }
        else if (callName === "getEmployeeAttendance") {
            const keyword = functionCallInfo.args.keyword;
            if (!keyword) {
               result = "Mohon sebutkan nama atau NIP karyawan.";
            } else {
               const thirtyDaysAgo = new Date();
               thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
               const startStr = thirtyDaysAgo.toISOString();
               
               const ext = supabase.from('absensi')
                  .select('nip, nama, tipe, waktu_masuk, status_acc, keterangan')
                  .eq('company_id', user.company_id)
                  .gte('waktu_masuk', startStr)
                  .or("nama.ilike.%"+keyword+"%,nip.ilike.%"+keyword+"%")
                  .order('waktu_masuk', { ascending: false })
                  .limit(50);
               const extRes = await ext;
               
               if (!extRes.data || extRes.data.length === 0) {
                 result = "Tidak ditemukan riwayat absensi untuk \`"+keyword+"\` dalam 30 hari terakhir.";
               } else {
                 const formatted = extRes.data.map((a) => ({
                   nip: a.nip,
                   nama: a.nama,
                   tipe: a.tipe,
                   waktu_wib: new Date(a.waktu_masuk).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB',
                   status: a.status_acc === 1 ? 'ACC' : (a.status_acc === 0 ? 'PENDING' : 'TOLAK/LAINNYA'),
                   keterangan: a.keterangan || '-'
                 }));
                 result = JSON.stringify(formatted);
               }
            }
        }
        else if (callName === "recordAbsensi") {`;

content = content.replace('        }\n        else if (callName === "recordAbsensi") {', replacement);
fs.writeFileSync('telegram.ts', content);

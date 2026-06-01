const fs = require('fs');
let code = fs.readFileSync('telegram.ts', 'utf8');

const target = "status: a.status_acc === 1 ? 'ACC' : (a.status_acc === 0 ? 'PENDING' : 'TOLAK/LAINNYA'),";
const replace = "status: ['IJIN','SAKIT','CUTI','LUPA_ABSEN'].includes(a.tipe) ? (a.status_acc === 1 ? 'DISETUJUI' : a.status_acc === 2 ? 'DITOLAK' : 'PENDING') : 'VALID',";

if (code.includes(target)) {
   code = code.replace(target, replace);
   fs.writeFileSync('telegram.ts', code);
   console.log("PATCHED!");
} else {
   console.log("NOT FOUND!");
}

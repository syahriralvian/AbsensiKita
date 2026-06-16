import { getMariaDBPool } from './src/routes/mariadb.ts';
async function test() {
  const db = getMariaDBPool();
  try {
     const [rows] = await db.query('SELECT COUNT(*) as c FROM karyawan WHERE company_id="DEMO-123"');
     console.log('Karyawan COUNT:', rows[0].c);
     const [rows2] = await db.query('SELECT COUNT(*) as c FROM absensi WHERE company_id="DEMO-123"');
     console.log('Absensi COUNT:', rows2[0].c);
  } catch(e) {
     console.error("DB error", e);
  } finally {
     process.exit(0);
  }
}
test();

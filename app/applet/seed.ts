import { generateDemoDataIfNeeded } from './src/lib/demo.js';
import { getMariaDBPool } from './src/routes/mariadb.js';

async function run() {
  console.log("Seeding companies...");
  const pool = getMariaDBPool();
  try {
     // Check if demo company exists
     const [rows] = await pool.query("SELECT * FROM companies WHERE company_id = 'DEMO-123'");
     if (rows.length === 0) {
        await pool.query("INSERT INTO companies (company_id, nama_perusahaan, api_key) VALUES ('DEMO-123', 'Demo Company', 'DEMO_API_KEY_123')");
        console.log("Inserted Demo Company.");
     } else {
        console.log("Demo company already exists.");
     }

     console.log("Running demo generator...");
     await generateDemoDataIfNeeded();
     console.log("Demo generator complete!");
  } catch(e) {
     console.error(e);
  }
}

run().finally(() => process.exit(0));

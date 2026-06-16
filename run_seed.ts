import { generateDemoDataIfNeeded } from './src/lib/demo';
import { getMariaDBPool } from './src/routes/mariadb';

async function run() {
  console.log("Creating demo company...");
  try {
    const db = getMariaDBPool();
    await db.query(`INSERT IGNORE INTO companies (company_id, nama_perusahaan, api_key) VALUES (?, ?, ?)`, ['DEMO-123', 'Demo Company', 'DEMO_API_KEY_123']);
    console.log("Demo company inserted!");

    console.log("Generating demo data...");
    await generateDemoDataIfNeeded();
    console.log("Demo data generation complete!");
  } catch (err) {
    console.error("Error during seed:", err);
  } finally {
    process.exit(0);
  }
}

run();

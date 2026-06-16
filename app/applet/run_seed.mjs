import fetch from 'node-fetch';

async function run() {
    console.log("Creating demo company...");
    await fetch('http://127.0.0.1:3000/api/db-query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            table: 'companies',
            method: 'insert',
            payload: {
                company_id: 'DEMO-123',
                nama_perusahaan: 'Demo Company',
                api_key: 'DEMO_API_KEY_123'
            },
            filters: []
        })
    }).then(res => res.text()).then(console.log).catch(console.error);

    console.log("Triggering test connection to create demo data implicitly (if not, we'll try to insert user directly)...");
}

run();

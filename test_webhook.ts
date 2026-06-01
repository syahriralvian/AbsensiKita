async function run() {
  try {
      const response = await fetch('https://n8n.absensikita.id/webhook/wa-otp-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: "082234856259", nip: "test", company_id: "test" })
      });
      console.log(response.status, await response.text());
  } catch (e) {
      console.log(e);
  }
}
run();

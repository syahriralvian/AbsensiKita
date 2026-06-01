const WAHA_URL = "https://waha-j3kivpfbozbu.bagus.sumopod.my.id";
const WAHA_API_KEY = "7gc1xoO9YTzddFLB29emlk9zRx4STxEp";

async function testWaha() {
  try {
    const sessionResponse = await fetch(`${WAHA_URL}/api/sessions/`);
    const sessions = await sessionResponse.json();
    console.log("Sessions:", sessions);

    // Let's print the first session which is probably connected
    if (sessions && sessions.length > 0) {
      const s = sessions.find((x: any) => x.status === 'WORKING');
      if (s) {
          console.log("Found working session:", s.name);
          const response = await fetch(`${WAHA_URL}/api/sendText`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": WAHA_API_KEY, "accept": "application/json" },
            body: JSON.stringify({ session: s.name, chatId: "6285157004261@c.us", text: "Test WAHA dari terminal AI Studio" })
          });
          const result = await response.text();
          console.log("Send text result:", response.status, result);
      } else {
          console.log("No working sessions.");
      }
    }
  } catch (err) {
    console.error(err);
  }
}

testWaha();

const WAHA_URL = "https://waha-j3kivpfbozbu.bagus.sumopod.my.id";
const WAHA_API_KEY = "7gc1xoO9YTzddFLB29emlk9zRx4STxEp";

async function testWaha() {
  try {
    const sessionResponse = await fetch(`${WAHA_URL}/api/sessions/`, {
      method: "GET",
      headers: { "X-Api-Key": WAHA_API_KEY, "accept": "application/json" }
    });
    const sessions = await sessionResponse.json();
    
    if (Array.isArray(sessions) && sessions.length > 0) {
      const s = sessions.find((x: any) => x.status === 'WORKING');
      if (s) {
          console.log("Found working session:", s.name);
          const response = await fetch(`${WAHA_URL}/api/sendText`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-Api-Key": WAHA_API_KEY, "accept": "application/json" },
            body: JSON.stringify({ session: s.name, chatId: "6285157004261@c.us", text: "Halo ini ujicoba kirim dari bot." })
          });
          const result = await response.text();
          console.log("Send text result:", response.status, result);
      } else {
          console.log("No working sessions.");
          console.log(sessions);
      }
    } else {
      console.log("No sessions", sessions);
    }
  } catch (err) {
    console.error(err);
  }
}

testWaha();

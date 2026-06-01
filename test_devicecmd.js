import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const PORT = 3000;
async function run() {
  const res = await fetch(`http://localhost:${PORT}/iclock/devicecmd?SN=ACQA193760001&cid=test`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: `ID=1861&Return=0&CMD=DATA UPDATE userinfo PIN=3001`
  });
  console.log(res.status, await res.text());
}
run();

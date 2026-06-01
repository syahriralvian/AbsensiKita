import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();
const PORT = 3000;
async function run() {
  const res = await fetch(`http://localhost:${PORT}/iclock/getrequest?SN=ACQA193760001`);
  console.log(res.status, await res.text());
}
run();

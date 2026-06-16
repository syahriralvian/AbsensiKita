const { exec } = require('child_process');
const server = exec('npx cross-env PORT=18080 node dist/server.cjs');
setTimeout(() => {
  exec('curl http://127.0.0.1:18080/api/midtrans/config', (err, stdout) => {
    console.log("CURL:", stdout);
    server.kill();
  });
}, 3000);

const fs = require('fs');
try {
  require('./dist/server.cjs');
} catch (err) {
  fs.writeFileSync(__dirname + '/server_crash.log', String(err && err.stack ? err.stack : err));
  console.error("Passenger startup error:", err);
  process.exit(1);
}

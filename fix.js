const fs = require('fs');
let code = fs.readFileSync('src/routes/adms.ts', 'utf8');

// Use powerful regex to match any messed up res.send inside get('/iclock/cdata')
code = code.replace(/res\.send\(\s*\'GETOPTION FROM\:\'\s*\+\s*sn\s*\+\s*\'\n[\s\S]*?\n\'\)\;/g, 'res.send("GETOPTION FROM:" + sn + "\\nStamp=9999\\nOpStamp=9999\\nErrorDelay=60\\nDelay=10\\nTransTimes=00:00;14:00\\nTransInterval=1\\nTransFlag=1111000000\\nTimeZone=" + offset + "\\nRealtime=1\\nEncrypt=0\\n");');

fs.writeFileSync('src/routes/adms.ts', code);
console.log('Fixed syntax error via regex');

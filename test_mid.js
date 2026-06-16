const http = require('http');

setTimeout(() => {
  http.get('http://127.0.0.1:8089/api/midtrans/config', (res) => {
    let raw = '';
    res.on('data', chunk => raw += chunk);
    res.on('end', () => console.log('STATUS:', res.statusCode, 'BODY:', raw));
  }).on('error', e => console.error(e));
}, 1000);

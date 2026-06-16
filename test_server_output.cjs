const { spawn } = require('child_process');
const child = spawn('npx', ['node', './dist/server.cjs'], { env: { ...process.env, NODE_ENV: 'production', PORT: '8080' } });

child.stdout.on('data', (data) => console.log(`STDOUT: ${data}`));
child.stderr.on('data', (data) => console.error(`STDERR: ${data}`));
child.on('close', (code) => console.log(`child process exited with code ${code}`));

setTimeout(() => {
  console.log('Timeout reached. Killing child.');
  child.kill();
}, 4000);

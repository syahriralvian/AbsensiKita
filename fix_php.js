import fs from 'fs';
const files = ['public/iclock/cdata.php', 'public/iclock/devicecmd.php', 'public/iclock/getrequest.php'];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/date\("c"\)/g, 'gmdate("c")');
  fs.writeFileSync(file, content);
}
console.log('Replaced date("c") with gmdate("c")');

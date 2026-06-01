const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Look for new Date(x.waktu_masuk) or new Date(waktu_masuk)
      // We will match a pattern: new Date( ...waktu_masuk )
      // Only replace if it doesn't already have .replace
      const regex = /new Date\(([^)]*?waktu_masuk)\)/g;
      
      const newContent = content.replace(regex, (match, p1) => {
        if (p1.includes('.replace')) return match;
        return `new Date(${p1}.replace(' ', 'T'))`;
      });
      
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Fixed:', fullPath);
      }
    }
  }
}

processDir('./src');

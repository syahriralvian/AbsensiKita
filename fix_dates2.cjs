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
      
      const regex = /new Date\(([^)]*?)(waktu_pulang|waktu_kembali|waktu_keluar|waktu_lembur_masuk|waktu_lembur_keluar|log\.time|l\.time)\)/g;
      
      const newContent = content.replace(regex, (match, prefix, field) => {
        if (prefix.includes('.replace') || field.includes('.replace')) return match;
        return `new Date(${prefix}${field}.replace(' ', 'T'))`;
      });
      
      if (newContent !== content) {
        fs.writeFileSync(fullPath, newContent);
        console.log('Fixed additional:', fullPath);
      }
    }
  }
}

processDir('./src');

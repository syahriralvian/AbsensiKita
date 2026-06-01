const fs = require('fs');
const path = require('path');

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  // Replace text-slate-400 with text-slate-500 dark:text-slate-400 if it doesn't already have dark: or text-slate-500/600 next to it
  content = content.replace(/(?<!dark:)text-slate-400(?!\sdark:)/g, 'text-slate-500 dark:text-slate-400');
  
  // Replace text-slate-300 with text-slate-500 dark:text-slate-300 if it doesn't have dark: or text-slate-500/600 next to it
  content = content.replace(/(?<!dark:)text-slate-300(?!\sdark:)/g, 'text-slate-500 dark:text-slate-300');

  // Replace text-slate-200 with text-slate-600 dark:text-slate-200 if not prefixed with dark:
  content = content.replace(/(?<!dark:)text-slate-200(?!\sdark:)/g, 'text-slate-600 dark:text-slate-200');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      walkDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts') || fullPath.endsWith('.jsx') || fullPath.endsWith('.js')) {
      replaceInFile(fullPath);
    }
  }
}

walkDir(path.join(__dirname, 'src'));

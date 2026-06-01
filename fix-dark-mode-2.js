import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.tsx') || file.endsWith('.ts')) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // hover backgrounds
    content = content.replace(/\bhover:bg-slate-50\b(?! dark:hover:bg-)/g, 'hover:bg-slate-50 dark:hover:bg-slate-800');
    content = content.replace(/\bhover:bg-slate-100\b(?! dark:hover:bg-)/g, 'hover:bg-slate-100 dark:hover:bg-slate-800');
    
    // Check for focus, ring, etc if necessary
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated: ' + file);
    }
});

console.log('Done.');

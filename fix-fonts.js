import fs from 'fs';
import path from 'path';

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        const fullPath = path.join(dir, file);
        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(fullPath));
        } else {
            if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
                results.push(fullPath);
            }
        }
    });
    return results;
}

const files = walk('./src');

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    content = content.replace(/\btext-3xl\b(?! md:text-)/g, 'text-2xl md:text-3xl');
    content = content.replace(/\btext-4xl\b(?! md:text-)/g, 'text-3xl md:text-4xl');
    content = content.replace(/\btext-5xl\b(?! md:text-)/g, 'text-4xl md:text-5xl');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated font sizes in: ' + file);
    }
});

console.log('Done.');

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

    // Add whitespace-nowrap and min-w-max to classNames of tables if missing
    content = content.replace(/<table\s+className="([^"]*)"/g, (match, p1) => {
        let newClasses = p1;
        if (!newClasses.includes('whitespace-nowrap')) {
            newClasses += ' whitespace-nowrap';
        }
        if (!newClasses.includes('min-w-max')) {
            newClasses += ' min-w-max';
        }
        return `<table className="${newClasses}"`;
    });

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated tables in: ' + file);
    }
});

console.log('Done.');

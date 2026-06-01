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

    // Containers padding responsive
    content = content.replace(/\bp-8\b(?! md:p-| sm:p-| lg:p-)/g, 'p-5 md:p-8');
    content = content.replace(/\bp-6\b(?! md:p-| sm:p-| lg:p-)/g, 'p-4 sm:p-6');
    content = content.replace(/\bgap-8\b(?! md:gap-| sm:gap-| lg:gap-)/g, 'gap-4 sm:gap-6 md:gap-8');
    content = content.replace(/\bgap-6\b(?! md:gap-| sm:gap-| lg:gap-)/g, 'gap-4 sm:gap-6');
    
    // Grid cols fixes where there are grid-cols-2 without responsive prefixes
    content = content.replace(/\bgrid-cols-2\b(?! md:grid-| sm:grid-| lg:grid-)/g, 'grid-cols-1 sm:grid-cols-2');

    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated responsive classes in: ' + file);
    }
});

console.log('Responsive updates done.');

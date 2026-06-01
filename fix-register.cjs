const fs = require('fs');

let content = fs.readFileSync('src/pages/RegisterPage.tsx', 'utf8');

const target1 = 'className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"';
const replace1 = 'className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl text-sm font-bold focus:bg-white dark:focus:bg-slate-900 focus:border-blue-500/50 focus:ring-4 focus:ring-blue-500/10 text-slate-800 dark:text-slate-100 transition-all outline-none"';

content = content.split(target1).join(replace1);

fs.writeFileSync('src/pages/RegisterPage.tsx', content);

console.log('Fixed RegisterPage.tsx');

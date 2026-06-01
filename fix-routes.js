const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

// Regex to find {hasPermission('XXX') && ( <Route ... /> )}
// Since it's multiline, we can do a simpler replacement or write a parser
const regex = /\{\s*hasPermission\('([^']+)'\)\s*&&\s*\(\s*<Route\s*path="([^"]+)"\s*element=\{\s*([\s\S]*?(?:<\/PageWrapper>))\s*\}\s*\/>\s*\)\}/g;

code = code.replace(regex, (match, perm, path, element) => {
  return `<Route
                path="${path}"
                element={
                  hasPermission('${perm}') ? (
${element}
                  ) : <Navigate to="/dashboard/monitor" replace />
                }
              />`;
});

fs.writeFileSync('src/pages/Dashboard.tsx', code);
console.log("Done");

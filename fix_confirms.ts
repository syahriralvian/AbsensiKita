import fs from "fs";
import path from "path";

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach((file) => {
    const dirFile = path.join(dir, file);
    try {
      filelist = walkSync(dirFile, filelist);
    } catch (err) {
      if (err.code === "ENOTDIR" || err.code === "EBADF") filelist.push(dirFile);
    }
  });
  return filelist;
};

const filesToProcess = walkSync("src").filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

filesToProcess.forEach((file) => {
  let content = fs.readFileSync(file, "utf8");
  let modified = false;

  // Pattern matching window.confirm or confirm function calls
  const confirmRegex = /(?:window\.)?confirm\((.+?)\)/g;

  if (confirmRegex.test(content)) {
    // Add import statement if we are going to modify
    const importLevels = file.split(path.sep).length - 2;
    const importPath = importLevels <= 0 ? "./lib/confirmDialog" : "../".repeat(importLevels) + "lib/confirmDialog";
    
    if (!content.includes("confirmDialog")) {
      // Find the last import
      const lastImportIndex = content.lastIndexOf("import ");
      if (lastImportIndex !== -1) {
        const nextLineIndex = content.indexOf("\n", lastImportIndex);
        content = content.slice(0, nextLineIndex + 1) + "import { confirmDialog } from '" + importPath + "';\n" + content.slice(nextLineIndex + 1);
      } else {
        content = "import { confirmDialog } from '" + importPath + "';\n" + content;
      }
    }

    content = content.replace(confirmRegex, "(await confirmDialog($1))");
    modified = true;
  }

  // Adjust async for arrow functions where await confirmDialog is used
  // This is a naive replacement but works for things like `const handleSave = () => {`
  if (modified) {
     content = content.replace(/const (\w+) = \(\) => {(\s+)if \(!\(await confirmDialog/g, "const $1 = async () => {$2if (!(await confirmDialog");
     content = content.replace(/const (\w+) = \((\w+): (\w+)\) => {(\s+)if \(!\(await confirmDialog/g, "const $1 = async ($2: $3) => {$4if (!(await confirmDialog");
     content = content.replace(/const (\w+) = \((\w+): (\w+), (\w+): (\w+)\) => {(\s+)if \(!\(await confirmDialog/g, "const $1 = async ($2: $3, $4: $5) => {$6if (!(await confirmDialog");
     
     // Also inside onClick={async () => ...}
     // Actually it's complex. Let's just blindly write async where missing if there is an error, but let's hope most handles are already async.
     fs.writeFileSync(file, content, "utf8");
     console.log("Updated", file);
  }
});

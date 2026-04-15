const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

walk('./src', filePath => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  content = content.replace(/\bEmpleados\b/g, 'Employees');
  content = content.replace(/\bEmpleado\b/g, 'Employee');
  content = content.replace(/\bempleados\b/g, 'employees');
  content = content.replace(/\bempleado\b/g, 'employee');

  if (original !== content) {
    fs.writeFileSync(filePath, content);
    console.log("Restored in:", filePath);
  }
});

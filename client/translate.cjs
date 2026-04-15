const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(dirPath);
  });
}

const safeReplacements = [
  { s: /\bRanking de Employees\b/g, r: 'Ranking de Empleados' },
  { s: /\bRanking employees\b/g, r: 'Ranking de empleados' },
  { s: /\bEmployee\b/g, r: 'Empleado' },
  { s: /\bEmployees\b/g, r: 'Empleados' },
  { s: /\bemployee\b/gi, r: 'empleado' },
  { s: /\bemployees\b/gi, r: 'empleados' },
];

walk('./src', filePath => {
  if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;

  // Let's manually replace specific known strings first to be super safe
  const absoluteSafeUIStrings = [
    ['"Employee"', '"Empleado"'],
    ['"Employees"', '"Empleados"'],
    ["'Employee'", "'Empleado'"],
    ["'Employees'", "'Empleados'"],
    ['>Employee<', '>Empleado<'],
    ['>Employees<', '>Empleados<'],
    ['> Employee <', '> Empleado <'],
    ['> Employees <', '> Empleados <'],
    ['>Employee ', '>Empleado '],
    ['>Employees ', '>Empleados '],
    [' Employee<', ' Empleado<'],
    [' Employees<', ' Empleados<'],
    [' Employee ', ' Empleado '],
    [' Employees ', ' Empleados '],
    [' employee<', ' empleado<'],
    [' employees<', ' empleados<'],
    ['>employee ', '>empleado '],
    ['>employees ', '>empleados '],
    [' employee ', ' empleado '],
    [' employees ', ' empleados '],
    ['"Employee ', '"Empleado '],
    ['"Employees ', '"Empleados '],
    ['"employee ', '"empleado '],
    ['"employees ', '"empleados '],
    [' Employee"', ' Empleado"'],
    [' Employees"', ' Empleados"'],
    [' employee"', ' empleado"'],
    [' employees"', ' empleados"'],
    ["'Employee ", "'Empleado "],
    ["'Employees ", "'Empleados "],
    ["'employee ", "'empleado "],
    ["'employees ", "'empleados "],
    [" Employee'", " Empleado'"],
    [" Employees'", " Empleados'"],
    [" employee'", " empleado'"],
    [" employees'", " empleados'"],
    ['Employee ', 'Empleado '],
    ['Employees ', 'Empleados '],
    ['employee ', 'empleado '],
    ['employees ', 'empleados '],
    [' Employee', ' Empleado'],
    [' Employees', ' Empleados'],
    [' employee', ' empleado'],
    [' employees', ' empleados'],
    ['. Employees ', '. Empleados '],
    ['. Employee ', '. Empleado '],
    ['. employees ', '. empleados '],
    ['. employee ', '. empleado '],
    [': Employee', ': Empleado'],
    [': Employees', ': Empleados'],
    [': employee', ': empleado'],
    [': employees', ': empleados'],
    ['(Employee', '(Empleado'],
    ['(Employees', '(Empleados'],
    ['(employee', '(empleado'],
    ['(employees', '(empleados'],
  ];

  // However, I need to make sure I do NOT replace in these:
  // '/api/v2/employees' -> skip
  // 'import { Employee }' -> skip
  // 'role === "employee"' -> skip
  // 'EmployeeList' -> skip
  
  // A safe regex approach to ONLY replace outside of import/export/var/const/let/function/class statements? Too complex.
  
  // Let's replace ONLY within:
  // 1. JSX text nodes: > text <
  // 2. Specific attributes: placeholder="..." | title="..." | label="..." | description="..." | text="..."
  // 3. Toast/alert strings: toast.success("...") | toast.error('...') | setError("...") | setSuccess("...")
  
  // Regex for JSX text: />([^<]+)</g
  content = content.replace(/>([^<]+)</g, (match, p1) => {
    if (p1.includes('{') || p1.includes('}')) {
       // has js expressions, let's just do boundary replace carefully
       let inner = p1;
       inner = inner.replace(/\bEmployees\b/g, 'Empleados');
       inner = inner.replace(/\bEmployee\b/g, 'Empleado');
       // For lowercase, only if preceded by space or specific chars to avoid matching 'employeeId' inside {employeeId}
       // wait, if it's within {}, we should NOT replace.
       // We can just split by '{' and '}' and only replace in the even indices.
       let parts = inner.split(/([{}]|\/\*|\*\/)/);
       let depth = 0;
       for(let i=0; i<parts.length; i++) {
           if (parts[i] === '{') depth++;
           else if (parts[i] === '}') depth--;
           else if (depth === 0) {
               parts[i] = parts[i].replace(/\bEmployees\b/g, 'Empleados');
               parts[i] = parts[i].replace(/\bEmployee\b/g, 'Empleado');
               parts[i] = parts[i].replace(/\bemployees\b/g, 'empleados');
               parts[i] = parts[i].replace(/\bemployee\b/g, 'empleado');
           }
       }
       return '>' + parts.join('') + '<';
    }
    
    // safe plain text
    let inner = p1;
    inner = inner.replace(/\bEmployees\b/g, 'Empleados');
    inner = inner.replace(/\bEmployee\b/g, 'Empleado');
    inner = inner.replace(/\bemployees\b/g, 'empleados');
    inner = inner.replace(/\bemployee\b/g, 'empleado');
    return '>' + inner + '<';
  });

  // Regex for literal strings in toast/setSuccess/setError
  // Example: toast.success(" employee ")
  content = content.replace(/(toast\.(success|error|info|warning)\(|setError\(|setSuccess\()((|"|')[^"']*?)(employees|employee|Employees|Employee)([^"']*?(|"|'))/gi, (match, p1, p2, p3, p4, p5, p6, p7, p8) => {
      // it matches one occurrence. Let's do it safely by just replacing the whole string argument boundaries
      return match; // skipped for complex replace below
  });
  
  // Actually, we can just replace inside "..." or '...' IF it contains spaces (which implies it's a sentence).
  // "This is an employee" -> contains spaces, safe to translate.
  // "employee" -> NO, might be a role or property!
  content = content.replace(/(["'])([^"']*? [^"']*?)\1/g, (match, quote, innerText) => {
     // only if it looks like a readable sentence or title
     // avoid if it looks like a path "/api/..."
     if (innerText.includes('/') && innerText.includes('api')) return match;
     if (innerText.includes('role ===')) return match;
     
     let newText = innerText.replace(/\bEmployees\b/g, 'Empleados');
     newText = newText.replace(/\bEmployee\b/g, 'Empleado');
     newText = newText.replace(/\bemployees\b/g, 'empleados');
     newText = newText.replace(/\bemployee\b/g, 'empleado');
     return quote + newText + quote;
  });

  if (original !== content) {
    fs.writeFileSync(filePath, content);
    console.log("Translated in:", filePath);
  }
});

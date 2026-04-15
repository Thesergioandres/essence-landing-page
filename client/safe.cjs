const fs = require("fs");
const path = require("path");
function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (fs.statSync(dirPath).isDirectory()) walk(dirPath, callback);
    else callback(dirPath);
  });
}
function translateUI(text) {
  let newText = text.replace(/\bEmployees\b/g, "Empleados");
  newText = newText.replace(/\bEmployee\b/g, "Empleado");
  newText = newText.replace(/\bemployees\b/g, "empleados");
  newText = newText.replace(/\bemployee\b/g, "empleado");
  return newText;
}

let modifiedFiles = 0;
walk("./src", filePath => {
  if (!filePath.endsWith(".tsx") && !filePath.endsWith(".ts")) return;
  const content = fs.readFileSync(filePath, "utf8");
  let newContent = content;

  // Replace plain text mapped securely
  const map = {
    '"Employee"': '"Empleado"',
    '"Employees"': '"Empleados"',
    "'Employee'": "'Empleado'",
    "'Employees'": "'Empleados'",
    ">Employee<": ">Empleado<",
    ">Employees<": ">Empleados<",
    "> Employee <": "> Empleado <",
    "> Employees <": "> Empleados <",
  };

  for (const [k, v] of Object.entries(map)) {
    newContent = newContent.split(k).join(v);
  }

  // Safe JSX Text Nodes: Match > Text < where Text only contains letters/spaces/punctuation (no {}, no <> and no JS code chunks)
  newContent = newContent.replace(
    />([a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s?!.,:;-]+)</g,
    (match, p1) => {
      if (/\bemployee[s]?\b/i.test(p1)) return ">" + translateUI(p1) + "<";
      return match;
    }
  );

  // Safe UI Attributes
  newContent = newContent.replace(
    /(title|placeholder|description|label)=([\"\'])([^\"\'<>{}]*?)\2/gi,
    (match, p1, p2, p3) => {
      if (/\bemployee[s]?\b/i.test(p3) && !/\/api\//i.test(p3))
        return p1 + "=" + p2 + translateUI(p3) + p2;
      return match;
    }
  );

  // Safe Toasts and alerts
  newContent = newContent.replace(
    /(toast\.(success|error|info)|setError|setSuccess)\(([\"\'])([^\"\'{}]+)\3\)/gi,
    (match, p1, p2, p3, p4) => {
      if (/\bemployee[s]?\b/i.test(p4))
        return p1 + "(" + p3 + translateUI(p4) + p3 + ")";
      return match;
    }
  );

  // Literal strings with minimum 1 space containing employee
  newContent = newContent.replace(
    /([\"\'\`])([^\"\'\`{}/:;]+?[a-zA-Záéíóú]+\s+[^\"\'\`{}/:;]+?)\1/g,
    (match, p1, p2) => {
      if (/\bemployee[s]?\b/i.test(p2)) return p1 + translateUI(p2) + p1;
      return match;
    }
  );

  if (content !== newContent) {
    fs.writeFileSync(filePath, newContent);
    modifiedFiles++;
    console.log("Fixed:", filePath);
  }
});
console.log("Modified " + modifiedFiles + " files");

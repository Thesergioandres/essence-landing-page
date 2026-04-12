const fs = require("fs");
const path = require("path");
const dir = "server/src/infrastructure/http/routes";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".js")).sort();
const rows = [];
for (const f of files) {
  const txt = fs.readFileSync(path.join(dir, f), "utf8");
  const re = /router\.(get|post|put|patch|delete)\s*\(\s*(["'`])([^"'`]+)\2/gi;
  let m;
  while ((m = re.exec(txt))) {
    rows.push({ file: f, method: m[1].toUpperCase(), path: m[3] });
  }
}
rows.sort((a, b) => {
  if (a.file !== b.file) return a.file.localeCompare(b.file);
  if (a.path !== b.path) return a.path.localeCompare(b.path);
  return a.method.localeCompare(b.method);
});
for (const r of rows) {
  console.warn("[Essence Debug]", `${r.file}\t${r.method}\t${r.path}`);
}


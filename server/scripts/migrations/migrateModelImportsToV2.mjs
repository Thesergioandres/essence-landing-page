import fs from "node:fs";
import path from "node:path";

const serverRoot = process.cwd();
const modelTargets = {
  Product: path.join(
    serverRoot,
    "src",
    "infrastructure",
    "database",
    "models",
    "Product.js",
  ),
  Sale: path.join(
    serverRoot,
    "src",
    "infrastructure",
    "database",
    "models",
    "Sale.js",
  ),
  User: path.join(
    serverRoot,
    "src",
    "infrastructure",
    "database",
    "models",
    "User.js",
  ),
};

const shouldSkipDir = (dirName) =>
  dirName === "node_modules" ||
  dirName === ".git" ||
  dirName === "_legacy_archive";

const collectJsFiles = (dirPath, output = []) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isDirectory()) {
      if (shouldSkipDir(entry.name)) continue;
      collectJsFiles(path.join(dirPath, entry.name), output);
      continue;
    }

    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    output.push(path.join(dirPath, entry.name));
  }

  return output;
};

const files = collectJsFiles(serverRoot);
let changedFiles = 0;
let changedImports = 0;

for (const filePath of files) {
  const original = fs.readFileSync(filePath, "utf8");
  let next = original;

  next = next.replace(
    /(["'`])([^"'`]*models\/(Product|Sale|User)\.js)\1/g,
    (full, quote, importPath, modelName) => {
      if (importPath.includes("src/infrastructure/database/models")) {
        return full;
      }

      const targetAbs = modelTargets[modelName];
      const relative = path
        .relative(path.dirname(filePath), targetAbs)
        .replace(/\\/g, "/");
      const normalized = relative.startsWith(".") ? relative : `./${relative}`;

      if (normalized === importPath) return full;
      changedImports += 1;
      return `${quote}${normalized}${quote}`;
    },
  );

  if (next !== original) {
    fs.writeFileSync(filePath, next, "utf8");
    changedFiles += 1;
  }
}

console.log(`Updated files: ${changedFiles}`);
console.log(`Updated imports: ${changedImports}`);

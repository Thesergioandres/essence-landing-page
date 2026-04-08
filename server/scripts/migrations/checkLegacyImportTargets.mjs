import fs from "node:fs";
import path from "node:path";

const serverRoot = process.cwd();
const legacyTargets = new Set(
  ["Product", "Sale", "User"].map((name) =>
    path.normalize(path.join(serverRoot, "models", `${name}.js`)),
  ),
);

const files = [];
const walk = (dirPath) => {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (
      entry.name === "node_modules" ||
      entry.name === ".git" ||
      entry.name === "_legacy_archive"
    ) {
      continue;
    }

    const absolute = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      walk(absolute);
      continue;
    }

    if (entry.isFile() && absolute.endsWith(".js")) {
      files.push(absolute);
    }
  }
};

walk(serverRoot);

const matcher = /["'`]([^"'`]*models\/(Product|Sale|User)\.js)["'`]/g;
const hits = [];

for (const filePath of files) {
  const content = fs.readFileSync(filePath, "utf8");
  let match;

  while ((match = matcher.exec(content))) {
    const importPath = match[1];
    if (!importPath.startsWith(".")) continue;

    const resolved = path.normalize(
      path.resolve(path.dirname(filePath), importPath),
    );

    if (legacyTargets.has(resolved)) {
      hits.push({
        file: path.relative(serverRoot, filePath).replace(/\\/g, "/"),
        importPath,
      });
    }
  }
}

console.log(JSON.stringify(hits, null, 2));
console.log(`count=${hits.length}`);

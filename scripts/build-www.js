// Kopiert die statischen App-Dateien nach www/, damit Capacitor sie in die
// native iOS-/Android-Hülle packen kann. Der Web-Auftritt (GitHub Pages)
// bleibt unverändert direkt aus dem Repo-Root bedient - www/ ist reines
// Build-Ergebnis und wird nicht eingecheckt (siehe .gitignore).

const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const WWW = path.join(ROOT, "www");

const FILES = ["index.html", "app.js", "style.css", "sw.js", "manifest.json", "cards.json"];
const DIRS = ["icons"];

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

fs.rmSync(WWW, { recursive: true, force: true });
fs.mkdirSync(WWW, { recursive: true });

for (const file of FILES) {
  fs.copyFileSync(path.join(ROOT, file), path.join(WWW, file));
}
for (const dir of DIRS) {
  copyDir(path.join(ROOT, dir), path.join(WWW, dir));
}

console.log(`www/ gebaut (${FILES.length} Dateien, ${DIRS.length} Ordner).`);

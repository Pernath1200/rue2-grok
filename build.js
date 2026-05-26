/**
 * Minimal build script: copies source files to dist/ with minified HTML.
 * Run: node build.js
 */

const fs = require('fs');
const path = require('path');

const SRC = __dirname;
const DIST = path.join(SRC, 'dist');

const COPY_PATTERNS = [
  'index.html',
  'sw.js',
  'server.js',
  'icon.svg',
  'pwa-manifest.json',
  'topics.json',
  'questions.json',
];

const JSON_GLOB = fs.readdirSync(SRC).filter(f =>
  f.endsWith('.json') &&
  !['package.json', 'package-lock.json', 'audit_report.json'].includes(f) &&
  !COPY_PATTERNS.includes(f)
);

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });

var jsFiles = fs.readdirSync(path.join(SRC, 'js')).filter(f => f.endsWith('.js'));
jsFiles.forEach(file => {
  fs.copyFileSync(path.join(SRC, 'js', file), path.join(DIST, 'js', file));
});

var copied = jsFiles.length;

COPY_PATTERNS.concat(JSON_GLOB).forEach(file => {
  var src = path.join(SRC, file);
  if (!fs.existsSync(src)) return;
  var content = fs.readFileSync(src, 'utf8');
  if (file.endsWith('.json') && file !== 'pwa-manifest.json') {
    try { content = JSON.stringify(JSON.parse(content)); } catch (e) {}
  }
  fs.writeFileSync(path.join(DIST, file), content);
  copied++;
});

console.log('Copied ' + copied + ' files to dist/');
console.log('Done. Serve with: cd dist && node server.js');

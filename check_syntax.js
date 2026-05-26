const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
const start = html.indexOf('<script>') + 8;
const end = html.indexOf('</script>', start);
let script = html.slice(start, end);
script = script.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
fs.writeFileSync('_script.js', script);
try {
  new Function(script);
  console.log('Full script: Syntax OK');
} catch (e) {
  console.error('Full script error:', e.message);
}

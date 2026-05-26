const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 5555;
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.css': 'text/css',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
  console.log(req.socket.remoteAddress + ' - ' + (req.method || 'GET') + ' ' + (req.url || '/'));
  let file = req.url === '/' ? '/index.html' : req.url;
  file = path.join(__dirname, file.replace(/\?.*$/, ''));
  const ext = path.extname(file);
  const type = MIME[ext] || 'application/octet-stream';
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    const headers = { 'Content-Type': type };
    // Avoid stale previews in embedded browsers (e.g. Cursor Simple Browser) during local dev.
    if (ext === '.html' || ext === '.js' || ext === '.json' || ext === '.css') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
    }
    res.writeHead(200, headers);
    res.end(data);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Quiz app: http://127.0.0.1:' + PORT);
});

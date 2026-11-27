// Minimalny serwer statyczny do lokalnego podglądu: node serve.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.argv[2] || 5182);
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8' };

const server = createServer(async (req, res) => {
  let path;
  try {
    // błędny adres (np. „/%”) nie może wywrócić serwera: decodeURIComponent i new URL rzucają wyjątki
    path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([\\/]\.\.)+/, '');
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Bad request');
    return;
  }
  const file = join(root, path.endsWith('/') || path.endsWith('\\') ? join(path, 'index.html') : path);
  if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
});
// wypisuje faktyczny port (przy „node serve.mjs 0” system przydziela wolny)
server.listen(port, () => console.log(`http://localhost:${server.address().port}`));

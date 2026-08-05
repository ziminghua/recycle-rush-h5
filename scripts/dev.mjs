import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize } from 'node:path';

const port = Number(process.env.PORT ?? 4173);
const mime = { '.html': 'text/html; charset=utf-8' };

createServer((request, response) => {
  const requested = request.url === '/' ? '/index.html' : request.url.split('?')[0];
  const path = normalize(join(process.cwd(), requested));
  if (!path.startsWith(process.cwd())) return response.writeHead(403).end('Forbidden');

  try {
    if (!statSync(path).isFile()) throw new Error('Not a file');
    response.writeHead(200, { 'Content-Type': mime[extname(path)] ?? 'application/octet-stream' });
    createReadStream(path).pipe(response);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, '0.0.0.0', () => console.log(`Recycle Rush running at http://localhost:${port}`));

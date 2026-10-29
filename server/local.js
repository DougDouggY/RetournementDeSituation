import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { WebSocketServer } from 'ws';
import { createServer as createViteServer } from 'vite';
import { Room, makeCode, validCode, allowedOrigin } from './room.js';
const rooms = new Map(),
  port = Number(process.env.PORT) || 5173;
const production = process.argv.includes('--production');
const dist = path.resolve('dist');
const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
};
let vite;
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (req.method === 'POST' && url.pathname === '/api/rooms') {
    if (rooms.size >= 200) {
      res.writeHead(503);
      res.end('Serveur complet');
      return;
    }
    let code;
    do {
      code = makeCode();
    } while (rooms.has(code));
    rooms.set(
      code,
      new Room(code, { duration: Number(process.env.RDS_NIGHT_SECONDS) || undefined }),
    );
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ code }));
    return;
  }
  if (url.pathname === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }
  if (production) {
    if (url.pathname.startsWith('/api/')) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    try {
      const requested = decodeURIComponent(url.pathname);
      const file = path.resolve(dist, '.' + (requested === '/' ? '/index.html' : requested));
      if (!file.startsWith(dist + path.sep)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const data = await readFile(file);
      res.writeHead(200, {
        'Content-Type': mime[path.extname(file)] || 'application/octet-stream',
        'X-Content-Type-Options': 'nosniff',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }
  vite.middlewares(req, res);
});
if (!production)
  vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: process.env.RDS_NO_HMR === '1' ? false : { server, path: '/__vite_hmr' },
    },
    appType: 'spa',
  });
const wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });
server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, 'http://localhost'),
    match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
  if (!match) {
    if (url.pathname.startsWith('/api/')) socket.destroy();
    return;
  }
  const code = match[1],
    token = url.searchParams.get('token');
  const room = rooms.get(code);
  if (!validCode(code) || !room || !token || token.length > 100) {
    socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
    socket.destroy();
    return;
  }
  if (!allowedOrigin(req.headers.origin, req.headers.host)) {
    socket.destroy();
    return;
  }
  wss.handleUpgrade(req, socket, head, (ws) => {
    const member = room.join(ws, token);
    let count = 0,
      last = Date.now();
    ws.on('message', (data) => {
      if (Date.now() - last > 1000) {
        count = 0;
        last = Date.now();
      }
      if (++count > 80) return;
      room.message(member, data.toString());
    });
    ws.on('close', () => room.leave(member, ws));
    ws.on('error', () => {});
  });
});
setInterval(() => {
  const now = Date.now();
  for (const [code, r] of rooms) {
    r.tick(now);
    if (now - r.emptySince > 300000) rooms.delete(code);
  }
}, 50);
server.listen(port, '0.0.0.0', () => console.log(`Retournement de situation — port ${port}`));

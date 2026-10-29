import { DurableObject } from 'cloudflare:workers';
import { Room, makeCode, validCode, allowedOrigin } from './room.js';
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/health') return Response.json({ ok: true });
    if (url.pathname === '/api/rooms' && request.method === 'POST') {
      const code = makeCode();
      await env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(
        new Request(`https://room/init?code=${code}`, { method: 'POST' }),
      );
      return Response.json({ code }, { status: 201 });
    }
    const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/ws$/);
    if (match && validCode(match[1])) {
      if (!allowedOrigin(request.headers.get('Origin'), url.host))
        return new Response('Origin refused', { status: 403 });
      return env.ROOMS.get(env.ROOMS.idFromName(match[1])).fetch(request);
    }
    if (url.pathname.startsWith('/api/')) return new Response('Not found', { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
// Each private room is a separate single-authority actor; no resources from other games.
export class GameRoom extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.room = null;
    this.loop = null;
  }
  async fetch(request) {
    const url = new URL(request.url);
    if (url.pathname === '/init' && request.method === 'POST') {
      if (!this.room) this.room = new Room(url.searchParams.get('code'));
      return new Response('OK');
    }
    if (!this.room)
      return new Response('Salon expiré. Créez une nouvelle partie.', { status: 404 });
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket')
      return new Response('WebSocket required', { status: 426 });
    const token = url.searchParams.get('token');
    if (!token || token.length > 100) return new Response('Invalid token', { status: 400 });
    const pair = new WebSocketPair(),
      [client, server] = Object.values(pair);
    server.accept();
    const member = this.room.join(server, token);
    let messages = 0,
      last = Date.now();
    server.addEventListener('message', (e) => {
      if (typeof e.data !== 'string' || e.data.length > 4096) return;
      if (Date.now() - last > 1000) {
        messages = 0;
        last = Date.now();
      }
      if (++messages <= 80) this.room.message(member, e.data);
    });
    server.addEventListener('close', () => this.room.leave(member, server));
    server.addEventListener('error', () => this.room.leave(member, server));
    if (!this.loop)
      this.loop = setInterval(() => {
        this.room.tick();
        if (Date.now() - this.room.emptySince > 300000) {
          clearInterval(this.loop);
          this.loop = null;
          this.room = null;
        }
      }, 50);
    return new Response(null, { status: 101, webSocket: client });
  }
}

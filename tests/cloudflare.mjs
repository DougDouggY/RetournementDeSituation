import assert from 'node:assert/strict';
import WebSocket from 'ws';
const base = process.env.RDS_CF_URL || 'http://127.0.0.1:8787';
assert.equal(
  (await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(10000) }).then((r) => r.json()))
    .ok,
  true,
);
const { code } = await fetch(`${base}/api/rooms`, {
  method: 'POST',
  signal: AbortSignal.timeout(10000),
}).then((r) => r.json());
const connect = (token) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(`${base.replace('http', 'ws')}/api/rooms/${code}/ws?token=${token}`, {
      origin: base,
    });
    const state = { ws, messages: [] };
    ws.on('message', (raw) => {
      const data = JSON.parse(raw);
      state.messages.push(data);
      if (data.type === 'welcome') resolve(state);
    });
    ws.on('error', reject);
    setTimeout(() => reject(Error('Cloudflare WebSocket handshake timeout')), 10000).unref();
  });
let a, b;
try {
  a = await connect(crypto.randomUUID());
  b = await connect(crypto.randomUUID());
  const wait = async (predicate) => {
    for (let i = 0; i < 100; i++) {
      if (predicate()) return;
      await new Promise((r) => setTimeout(r, 50));
    }
    throw Error('Cloudflare state timeout');
  };
  await wait(() => a.messages.some((m) => m.type === 'state' && m.players.length === 2));
  a.ws.send(JSON.stringify({ type: 'start' }));
  await wait(() => b.messages.some((m) => m.phase === 'infiltration'));
  const first = a.messages.find((m) => m.type === 'welcome').id;
  a.ws.send(JSON.stringify({ type: 'input', x: 1, z: 0, angle: 1.57 }));
  await wait(() => b.messages.some((m) => m.players?.find((p) => p.id === first)?.x > -21));
  a.ws.send(JSON.stringify({ type: 'input', x: 0, z: 0 }));
  a.ws.send(JSON.stringify({ type: 'action', action: 'torch' }));
  await wait(() => b.messages.some((m) => m.players?.find((p) => p.id === first)?.torch));
  console.log(
    'PASS Cloudflare runtime: create room, Durable Object, two WebSockets, authoritative movement and flashlight',
  );
} finally {
  a?.ws.close();
  b?.ws.close();
}

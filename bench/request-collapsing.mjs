// Proof: client request collapsing (in-flight dedup) + 15s TTL cache.
// Drives the REAL client api.getCached against a counting HTTP server.
//   node bench/request-collapsing.mjs
import http from 'node:http';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };

// Browser globals the module touches at import / call time (jsdom-free shim).
globalThis.localStorage = {
  _s: new Map(),
  getItem(k) { return this._s.get(k) ?? null; },
  setItem(k, v) { this._s.set(k, String(v)); },
  removeItem(k) { this._s.delete(k); },
};
globalThis.localStorage.setItem('user', JSON.stringify({ id: 'bench-user' }));
globalThis.window = { location: { pathname: '/', href: '/' } };

// Counting server: one slow endpoint that records how many times it is actually hit.
let hits = 0;
const server = http.createServer((req, res) => {
  hits++;
  setTimeout(() => {
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ ok: true, hit: hits }));
  }, 50);
});
await new Promise((r) => server.listen(0, r));
const { port } = server.address();

// Import the REAL client module (axios resolves from client/node_modules).
// import.meta.env is Vite-only (undefined under node), so the module fell back
// to its localhost:5000 default — point the same axios instance at our server.
const api = (await import('../client/src/shared/lib/api.js')).default;
api.defaults.baseURL = `http://localhost:${port}`;

log('=== Request collapsing + TTL cache benchmark ===');
log(`${process.version} | ${new Date().toISOString()}`);
log('');

// BEFORE (naive): N components each call api.get -> N server hits.
const N = 20;
hits = 0;
await Promise.all(Array.from({ length: N }, () => api.get('/widgets')));
const naiveHits = hits;
log(`--- BEFORE: ${N} concurrent api.get('/widgets') (no dedup) ---`);
log(`server hits: ${naiveHits}`);
log('');

// AFTER: N concurrent getCached collapse to ONE in-flight request.
hits = 0;
await Promise.all(Array.from({ length: N }, () => api.getCached('/things')));
const collapsedHits = hits;
log(`--- AFTER: ${N} concurrent api.getCached('/things') ---`);
log(`server hits: ${collapsedHits}   (${N} callers -> ${collapsedHits} request)`);

// Repeat within the 15s TTL -> served from cache, zero new hits.
hits = 0;
await api.getCached('/things');
await api.getCached('/things');
const cachedHits = hits;
log(`repeat x2 within 15s TTL -> server hits: ${cachedHits} (served from cache)`);
log('');
log(`=> ${N} concurrent reads: ${naiveHits} -> ${collapsedHits} network call; ` +
   `cached re-reads: ${cachedHits} calls`);

await new Promise((r) => server.close(r));

// self-check
if (naiveHits !== N) throw new Error(`expected ${N} naive hits, got ${naiveHits}`);
if (collapsedHits !== 1) throw new Error(`expected 1 collapsed hit, got ${collapsedHits}`);
if (cachedHits !== 0) throw new Error(`expected 0 cached hits, got ${cachedHits}`);

mkdirSync(path.join(__dirname, 'out'), { recursive: true });
writeFileSync(path.join(__dirname, 'out/request-collapsing.txt'), lines.join('\n') + '\n');

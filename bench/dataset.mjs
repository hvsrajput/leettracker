// Proof: lazy-load (parse once per container) + O(1) hash index vs O(n) scan.
// Drives the REAL server module — no reimplementation.
//   node bench/dataset.mjs
import { performance } from 'node:perf_hooks';
import { writeFileSync, mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getProblemsDataset,
  getProblemBySlug,
} from '../server/src/utils/problemsDataset.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };

const dataFile = path.join(__dirname, '../server/src/data/problems.json');
const fileMB = (statSync(dataFile).size / 1024 / 1024).toFixed(2);

// --- Lazy load: first access pays read + JSON.parse + builds two Maps; the
//     module caches, so every later access is a no-op guard. ---
const t0 = performance.now();
const dataset = getProblemsDataset();        // cold
const coldMs = performance.now() - t0;

const t1 = performance.now();
getProblemsDataset();                        // warm (cached)
const warmMs = performance.now() - t1;

log('=== Dataset lazy-load + O(1) index benchmark ===');
log(`${process.version} | ${new Date().toISOString()}`);
log(`dataset: ${dataset.length} problems | file: ${fileMB} MB`);
log('');
log('--- Lazy load (parse once per Lambda container) ---');
log(`cold  first load (read + JSON.parse + build 2 Maps): ${coldMs.toFixed(2)} ms`);
log(`warm  later access (cached guard):                   ${warmMs.toFixed(4)} ms`);
log(`=> first request pays ${coldMs.toFixed(0)} ms once; every later lookup skips it`);
log('');

// --- O(n) linear scan vs O(1) Map.get over the same dataset ---
const K = 20000;
const slugs = [];
for (let i = 0; i < K; i++) {
  slugs.push(dataset[Math.floor(Math.random() * dataset.length)].slug);
}

// BEFORE: Array.find — what a lookup costs without the index
let found = 0;
const tn0 = performance.now();
for (let i = 0; i < K; i++) {
  if (dataset.find((p) => p.slug === slugs[i])) found++;
}
const linMs = performance.now() - tn0;

// AFTER: the real getProblemBySlug -> datasetMapBySlug.get (O(1))
let found2 = 0;
const tm0 = performance.now();
for (let i = 0; i < K; i++) {
  if (getProblemBySlug(slugs[i])) found2++;
}
const mapMs = performance.now() - tm0;

log(`--- Lookup: ${K} random slugs over ${dataset.length} problems ---`);
log(`BEFORE  O(n) Array.find linear scan: ${linMs.toFixed(2)} ms total | ${(linMs / K * 1000).toFixed(2)} us/lookup`);
log(`AFTER   O(1) Map.get (real index):   ${mapMs.toFixed(2)} ms total | ${(mapMs / K * 1000).toFixed(2)} us/lookup`);
log(`=> ${(linMs / mapMs).toFixed(0)}x faster, and flat as the dataset grows`);

// self-check: both paths must agree, and the index must actually be faster
if (found !== K || found2 !== K) throw new Error(`lookup mismatch: ${found}/${found2}/${K}`);
if (mapMs >= linMs) throw new Error(`index not faster: map ${mapMs} >= scan ${linMs}`);

mkdirSync(path.join(__dirname, 'out'), { recursive: true });
writeFileSync(path.join(__dirname, 'out/dataset.txt'), lines.join('\n') + '\n');

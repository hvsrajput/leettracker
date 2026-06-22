// Proof: batched DynamoDB reads. N individual GetItem round-trips collapse to
// ceil(N/100) BatchGetItem round-trips, with a UnprocessedKeys retry loop.
// Drives the REAL batchGetItems / getManyByNumbers — the doc client's .send is
// stubbed to COUNT calls and return synthetic items (no AWS, no latency claim).
//   node bench/batch-reads.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { docClient, TABLE_NAME, getItem } from '../server/src/db/dynamodb.js';
import { getManyByNumbers } from '../server/src/repositories/problemsRepo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const lines = [];
const log = (s = '') => { lines.push(s); console.log(s); };

// Stub the real doc client's transport. We count command types and synthesize
// responses; batchGetItems' chunking + UnprocessedKeys retry run unchanged.
let getCalls = 0;
let batchCalls = 0;
let injectUnprocessedOnce = false;
let unprocessedInjected = 0;

// Distinguish command type by its input shape (avoids importing SDK classes,
// which don't resolve from this dir): GetCommand has .Key, BatchGetCommand has
// .RequestItems.
docClient.send = async (command) => {
  const input = command.input || {};
  if (input.Key) {
    getCalls++;
    return { Item: { PK: input.Key.PK, SK: input.Key.SK } };
  }
  if (input.RequestItems) {
    batchCalls++;
    const keys = input.RequestItems[TABLE_NAME].Keys;

    // Once, hold back the last key as UnprocessedKeys to exercise the retry loop.
    if (injectUnprocessedOnce && keys.length > 1) {
      injectUnprocessedOnce = false;
      unprocessedInjected++;
      const held = keys.slice(-1);
      const done = keys.slice(0, -1);
      return {
        Responses: { [TABLE_NAME]: done.map((k) => ({ ...k })) },
        UnprocessedKeys: { [TABLE_NAME]: { Keys: held } },
      };
    }
    return { Responses: { [TABLE_NAME]: keys.map((k) => ({ ...k })) }, UnprocessedKeys: {} };
  }
  throw new Error(`unexpected command: ${command?.constructor?.name}`);
};

log('=== Batched DynamoDB reads benchmark ===');
log(`${process.version} | ${new Date().toISOString()}`);
log('');

const N = 250;
const nums = Array.from({ length: N }, (_, i) => i + 1);

// BEFORE: the naive path — the real getItem helper, once per tracked problem.
getCalls = 0;
for (const n of nums) {
  await getItem(`PROBLEM#${n}`, 'DETAIL');
}
log(`--- BEFORE: ${N} problems fetched one-by-one (getItem) ---`);
log(`GetItem round-trips: ${getCalls}`);
log('');

// AFTER: the real repository call — one BatchGetItem per 100 keys.
batchCalls = 0;
const items = await getManyByNumbers(nums);
log(`--- AFTER: getManyByNumbers(${N}) -> batchGetItems ---`);
log(`BatchGetItem round-trips: ${batchCalls}  (ceil(${N}/100) = ${Math.ceil(N / 100)})`);
log(`items returned: ${items.length}`);
log('');

// UnprocessedKeys retry: inject a throttled key once; loop must do a follow-up call.
injectUnprocessedOnce = true;
batchCalls = 0;
const retryItems = await getManyByNumbers(Array.from({ length: 100 }, (_, i) => i + 1));
log('--- UnprocessedKeys retry loop ---');
log(`injected throttled chunks: ${unprocessedInjected}`);
log(`BatchGetItem calls for 100 keys with 1 throttle: ${batchCalls} (1 base + 1 retry)`);
log(`items returned: ${retryItems.length}`);
log('');
log(`=> ${N} problem reads: ${getCalls === 0 ? N : getCalls} GetItem round-trips ` +
   `-> ${Math.ceil(N / 100)} BatchGetItem round-trips`);

// self-check
if (items.length !== N) throw new Error(`expected ${N} items, got ${items.length}`);
if (batchCalls !== 2) throw new Error(`expected 2 calls under retry, got ${batchCalls}`);
if (retryItems.length !== 100) throw new Error(`retry lost items: ${retryItems.length}`);

mkdirSync(path.join(__dirname, 'out'), { recursive: true });
writeFileSync(path.join(__dirname, 'out/batch-reads.txt'), lines.join('\n') + '\n');

/**
 * Seed DynamoDB table with default patterns.
 * 
 * Usage:
 *   AWS_REGION=ap-south-1 DYNAMODB_TABLE=LeetTrackerTable node db/seed-dynamodb.js
 * 
 * Make sure your AWS credentials are configured (env vars or ~/.aws/credentials).
 */

require('dotenv').config();
const { batchWrite, TABLE_NAME } = require('./dynamodb');

const defaultPatterns = [
  'Arrays', 'Sliding Window', 'Two Pointers', 'Binary Search',
  'DP', 'Graphs', 'Trees', 'Backtracking', 'Greedy',
  'Stack', 'Linked List', 'Heap', 'Hash Table', 'Strings',
  'Math', 'Sorting',
];

async function seed() {
  console.log(`🌱 Seeding table: ${TABLE_NAME}`);

  const items = defaultPatterns.map(name => ({
    PK: 'PATTERN',
    SK: `PAT#${name}`,
    name,
    isDefault: 1,
    createdBy: null,
  }));

  await batchWrite(items);

  console.log(`✅ Seeded ${defaultPatterns.length} default patterns`);
}

seed().catch(err => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});

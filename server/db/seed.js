const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'tracker.db');

// Remove existing DB for fresh seed
if (fs.existsSync(dbPath)) {
  fs.unlinkSync(dbPath);
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Run schema
const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
db.exec(schema);

// Seed default patterns
const defaultPatterns = [
  'Arrays', 'Sliding Window', 'Two Pointers', 'Binary Search',
  'DP', 'Graphs', 'Trees', 'Backtracking', 'Greedy',
  'Stack', 'Linked List', 'Heap', 'Hash Table', 'Strings',
  'Math', 'Sorting'
];

const insertPattern = db.prepare('INSERT INTO patterns (name, is_default) VALUES (?, 1)');
const insertMany = db.transaction((patterns) => {
  for (const name of patterns) {
    insertPattern.run(name);
  }
});
insertMany(defaultPatterns);

console.log(`✅ Database seeded at ${dbPath}`);
console.log(`   - ${defaultPatterns.length} default patterns created`);

db.close();

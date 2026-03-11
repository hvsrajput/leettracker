require('dotenv').config();
const { scanItems, deleteItem, TABLE_NAME } = require('./dynamodb');

async function wipe() {
  console.log(`🗑️ Wiping table: ${TABLE_NAME}`);
  try {
    const items = await scanItems();
    console.log(`Found ${items.length} items to delete...`);
    
    let count = 0;
    for (const item of items) {
      await deleteItem(item.PK, item.SK);
      count++;
      if (count % 50 === 0) console.log(`Deleted ${count}...`);
    }
    console.log(`✅ Successfully wiped ${count} items.`);
  } catch (err) {
    console.error('❌ Wipe failed:', err);
  }
}

wipe();

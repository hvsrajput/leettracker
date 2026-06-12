import 'dotenv/config';
import { scanItems, deleteItem, TABLE_NAME } from './dynamodb.js';

const wipe = async () => {
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
};

wipe();

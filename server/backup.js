/**
 * S3 Backup module — exports all DynamoDB data to S3 as JSON.
 * Used by:
 *   1. Scheduled Lambda (daily automatic backup)
 *   2. Manual /api/backup endpoint
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { scanItems } = require('./db/dynamodb');

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.S3_BACKUP_BUCKET || 'leettracker-backups';

async function backupToS3() {
  // Scan all items from DynamoDB
  const allItems = await scanItems();

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10); // 2026-03-11
  const timeStr = now.toISOString().replace(/[:.]/g, '-'); // safe filename

  const backupData = {
    exportedAt: now.toISOString(),
    itemCount: allItems.length,
    items: allItems,
  };

  const key = `backups/${dateStr}/leettracker-${timeStr}.json`;

  await s3.send(new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: JSON.stringify(backupData, null, 2),
    ContentType: 'application/json',
  }));

  console.log(`✅ Backup saved to s3://${BUCKET_NAME}/${key} (${allItems.length} items)`);
  return { bucket: BUCKET_NAME, key, itemCount: allItems.length };
}

module.exports = { backupToS3, BUCKET_NAME };

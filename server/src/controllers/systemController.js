import { scanItems } from '../db/dynamodb.js';
import { backupToS3 } from '../backup.js';

/**
 * @name healthCheckController
 * @description Report API health status
 * @access Public
 */
export const healthCheck = (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
};

/**
 * @name runBackupController
 * @description Back up all data to S3 and return it as downloadable JSON
 * @access Private — mounted behind the `auth` middleware in app.js
 */
export const runBackup = async (req, res) => {
  try {
    // Upload to S3
    const s3Result = await backupToS3();

    // Also return the data as downloadable JSON
    const allItems = await scanItems();
    res.setHeader('Content-Disposition', `attachment; filename=leettracker-backup-${new Date().toISOString().slice(0, 10)}.json`);
    res.json({
      exportedAt: new Date().toISOString(),
      itemCount: allItems.length,
      s3: s3Result,
      items: allItems,
    });
  } catch (err) {
    console.error('Backup error:', err);
    res.status(500).json({ error: 'Backup failed' });
  }
};

/**
 * Scheduled backup Lambda handler.
 * Triggered by Amazon EventBridge (CloudWatch Events) daily.
 * 
 * This is a SEPARATE Lambda function from the API handler.
 * It only runs the backup — no Express, no API Gateway.
 */

require('dotenv').config();
const { backupToS3 } = require('./backup');

module.exports.handler = async (event) => {
  console.log('🔄 Starting scheduled backup...', JSON.stringify(event));

  try {
    const result = await backupToS3();
    console.log('✅ Scheduled backup complete:', result);
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Backup successful', ...result }),
    };
  } catch (err) {
    console.error('❌ Scheduled backup failed:', err);
    throw err; // Let Lambda mark this invocation as failed
  }
};

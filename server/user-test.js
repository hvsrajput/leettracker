const { getItem, queryItems } = require('./db/dynamodb');
async function run() {
  const user = await getItem('USER#test@test.com', 'PROFILE');
  console.log("Test User:", user);
  const progress = await queryItems('PROGRESS#test@test.com', 'PROB#');
  console.log("Imported Problems count:", progress.length);
}
run().catch(console.error);

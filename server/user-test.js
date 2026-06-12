import { getItem, queryItems } from './src/db/dynamodb.js';

const run = async () => {
  const user = await getItem('USER#test@test.com', 'PROFILE');
  console.log("Test User:", user);
  const progress = await queryItems('PROGRESS#test@test.com', 'PROB#');
  console.log("Imported Problems count:", progress.length);
};

run().catch(console.error);

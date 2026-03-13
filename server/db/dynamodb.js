const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand, DeleteCommand, UpdateCommand, ScanCommand, BatchWriteCommand, BatchGetCommand } = require('@aws-sdk/lib-dynamodb');

// Initialize DynamoDB client
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || 'ap-south-1',
});

const docClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});

const TABLE_NAME = process.env.DYNAMODB_TABLE || 'LeetTrackerTable';

// --- Helper functions ---

async function putItem(item, conditionExpression, expressionValues) {
  const params = {
    TableName: TABLE_NAME,
    Item: item,
  };
  if (conditionExpression) {
    params.ConditionExpression = conditionExpression;
    if (expressionValues) {
      params.ExpressionAttributeValues = expressionValues;
    }
  }
  return docClient.send(new PutCommand(params));
}

async function getItem(pk, sk) {
  const result = await docClient.send(new GetCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  }));
  return result.Item || null;
}

async function queryItems(pk, skPrefix, options = {}) {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: 'PK = :pk',
    ExpressionAttributeValues: { ':pk': pk },
  };

  if (skPrefix) {
    params.KeyConditionExpression += ' AND begins_with(SK, :sk)';
    params.ExpressionAttributeValues[':sk'] = skPrefix;
  }

  if (options.filterExpression) {
    params.FilterExpression = options.filterExpression;
    Object.assign(params.ExpressionAttributeValues, options.expressionValues || {});
  }

  if (options.expressionAttributeNames) {
    params.ExpressionAttributeNames = options.expressionAttributeNames;
  }

  if (options.limit) {
    params.Limit = options.limit;
  }

  if (options.scanIndexForward === false) {
    params.ScanIndexForward = false;
  }

  const result = await docClient.send(new QueryCommand(params));
  return result.Items || [];
}

async function deleteItem(pk, sk) {
  return docClient.send(new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
  }));
}

async function updateItem(pk, sk, updateExpression, expressionValues, expressionNames) {
  const params = {
    TableName: TABLE_NAME,
    Key: { PK: pk, SK: sk },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  };
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }
  const result = await docClient.send(new UpdateCommand(params));
  return result.Attributes;
}

async function scanItems(filterExpression, expressionValues, expressionNames) {
  const params = {
    TableName: TABLE_NAME,
  };
  if (filterExpression) {
    params.FilterExpression = filterExpression;
    params.ExpressionAttributeValues = expressionValues;
  }
  if (expressionNames) {
    params.ExpressionAttributeNames = expressionNames;
  }

  // Handle pagination for full scan
  let items = [];
  let lastKey = undefined;
  do {
    if (lastKey) params.ExclusiveStartKey = lastKey;
    const result = await docClient.send(new ScanCommand(params));
    items = items.concat(result.Items || []);
    lastKey = result.LastEvaluatedKey;
  } while (lastKey);

  return items;
}

async function batchWrite(items) {
  // DynamoDB batch write supports max 25 items per call
  const chunks = [];
  for (let i = 0; i < items.length; i += 25) {
    chunks.push(items.slice(i, i + 25));
  }

  for (const chunk of chunks) {
    await docClient.send(new BatchWriteCommand({
      RequestItems: {
        [TABLE_NAME]: chunk.map(item => ({
          PutRequest: { Item: item },
        })),
      },
    }));
  }
}

async function batchGetItems(keys) {
  if (!keys || keys.length === 0) {
    return [];
  }

  const chunks = [];
  for (let i = 0; i < keys.length; i += 100) {
    chunks.push(keys.slice(i, i + 100));
  }

  const items = [];

  for (const chunk of chunks) {
    let requestItems = {
      [TABLE_NAME]: {
        Keys: chunk,
      },
    };

    do {
      const result = await docClient.send(new BatchGetCommand({
        RequestItems: requestItems,
      }));

      items.push(...(result.Responses?.[TABLE_NAME] || []));
      requestItems = result.UnprocessedKeys;
    } while (requestItems && Object.keys(requestItems).length > 0);
  }

  return items;
}

module.exports = {
  docClient,
  TABLE_NAME,
  putItem,
  getItem,
  queryItems,
  deleteItem,
  updateItem,
  scanItems,
  batchWrite,
  batchGetItems,
};

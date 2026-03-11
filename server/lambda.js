/**
 * AWS Lambda handler entry point.
 * Wraps the Express app using serverless-http.
 */
require('dotenv').config();
const serverless = require('serverless-http');
const app = require('./index');

module.exports.handler = serverless(app);

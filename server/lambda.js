/**
 * AWS Lambda handler entry point.
 * Wraps the Express app using serverless-http.
 */
import 'dotenv/config';
import serverless from 'serverless-http';
import app from './src/index.js';

export const handler = serverless(app);

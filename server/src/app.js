import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import patternsRoutes from './routes/patterns.js';
import problemsRoutes from './routes/problems.js';
import groupsRoutes from './routes/groups.js';
import dashboardRoutes from './routes/dashboard.js';
import leetcodeRoutes from './routes/leetcode.js';
import { auth } from './middleware/auth.js'
import { healthCheck, runBackup } from './controllers/systemController.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Credentialed CORS: the session lives in an HttpOnly cookie, so the browser
// only sends it when we echo a specific origin (never `*`) and allow
// credentials. Set CLIENT_ORIGIN to the deployed frontend URL in production;
// the localhost fallbacks cover Vite (5173) and CRA (3000) dev servers.
const allowedOrigins = (process.env.CLIENT_ORIGIN
  || 'http://localhost:5173,http://localhost:3000')
  .split(',')
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser clients (curl, server-to-server) that send no Origin.
    // For a disallowed browser origin, withhold the CORS headers (callback false)
    // rather than throwing — the browser still blocks the response, and we avoid
    // turning every probe into a logged 500.
    callback(null, !origin || allowedOrigins.includes(origin));
  },
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patterns', patternsRoutes);
app.use('/api/problems', problemsRoutes);
app.use('/api/groups', groupsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/leetcode', leetcodeRoutes);

/**
 * @route GET /api/health
 * @description Health check
 * @access Public
 */
app.get('/api/health', healthCheck);

/**
 * @route GET /api/backup
 * @description Back up all data to S3 and return it as downloadable JSON
 * @access Private — requires a valid session (the `auth` middleware below)
 */
app.get('/api/backup', auth, runBackup);

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Internal server error' });
});

// Only start listening when running locally (not in Lambda)
if (process.env.AWS_LAMBDA_FUNCTION_NAME === undefined) {
  app.listen(PORT, () => {
    console.log(`🚀 LeetCode Tracker API running on http://localhost:${PORT}`);
  });
}

export default app;

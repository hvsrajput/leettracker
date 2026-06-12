import jwt from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_COOKIE, cookieOptions } from '../middleware/auth.js';

// Lifetime of an issued session token. Kept in sync with the cookie maxAge in
// middleware/auth.js so the JWT and its carrier cookie expire together.
export const TOKEN_TTL = '7d';

/**
 * @name generateToken
 * @description Sign a session JWT and attach it as the HttpOnly session cookie.
 *   Cookie attributes (Secure / SameSite=None for the cross-site Vercel↔API
 *   setup) come from the shared `cookieOptions` so login, register and logout
 *   stay in sync.
 * @param {import('express').Response} res — response to set the cookie on
 * @param {{ id: string, username: string }} payload — user identity claims
 * @returns {string} the signed JWT (also returned in the body for API clients)
 */
export const generateToken = (res, { id, username }) => {
  const token = jwt.sign({ id, username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
  res.cookie(TOKEN_COOKIE, token, cookieOptions);
  return token;
};

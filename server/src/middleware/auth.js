import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET;

// Name of the HttpOnly cookie that carries the session JWT.
export const TOKEN_COOKIE = 'token';

// Options for the session cookie. The frontend (Vercel) and API (API Gateway)
// live on different registrable domains, so the browser treats this as a
// cross-site request — that requires SameSite=None, which in turn requires
// Secure. In local dev (NODE_ENV !== 'production') we relax both so the cookie
// works over plain http://localhost.
const isProd = process.env.NODE_ENV === 'production';
export const cookieOptions = {
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days, matches the JWT expiry
  path: '/',
};

/**
 * @name authMiddleware
 * @description Verify the session JWT (HttpOnly cookie, with Bearer header as
 *   fallback) and attach userId/username to the request. Reject if absent/invalid.
 * @access Private — gate for protected routes
 */
export const auth = (req, res, next) => {
  // Prefer the HttpOnly cookie; fall back to a Bearer header so existing API
  // clients (and the manual /api/backup curl in DEPLOY.md) keep working.
  const header = req.headers.authorization;
  const token = req.cookies?.[TOKEN_COOKIE]
    || (header?.startsWith('Bearer ') ? header.split(' ')[1] : null);

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

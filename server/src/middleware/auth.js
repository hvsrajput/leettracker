import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET;

/**
 * @name authMiddleware
 * @description Verify the Bearer JWT and attach userId/username to the request
 * @access Public
 */
export const auth = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = header.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

import bcrypt from 'bcryptjs';
import { TOKEN_COOKIE, cookieOptions } from '../middleware/auth.js';
import { generateToken } from '../utils/generateToken.js';
import { putItem, getItem, updateItem } from '../db/dynamodb.js';

/**
 * @name registerUserController
 * @description Register a new user
 * @access Public
 */
export const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email exists
    const existingEmail = await getItem(`USER#${email}`, 'PROFILE');
    if (existingEmail) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Check if username exists
    const existingUsername = await getItem(`USERNAME#${username}`, 'PROFILE');
    if (existingUsername) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const passwordHash = bcrypt.hashSync(password, 10);
    const createdAt = new Date().toISOString();

    // Store user by email (primary record)
    await putItem({
      PK: `USER#${email}`,
      SK: 'PROFILE',
      username,
      email,
      passwordHash,
      createdAt,
    });

    // Store username lookup record
    await putItem({
      PK: `USERNAME#${username}`,
      SK: 'PROFILE',
      email,
      username,
    });

    // Sets the HttpOnly session cookie (XSS can't read it) and returns the token.
    // We still echo the token in the body for non-browser API clients (e.g. the
    // backup curl); the SPA ignores it and relies on the cookie.
    const token = generateToken(res, { id: email, username });
    res.json({ token, user: { id: email, username, email } });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
};

/**
 * @name loginUserController
 * @description Log in an existing user and issue a JWT
 * @access Public
 */
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await getItem(`USER#${email}`, 'PROFILE');
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(res, { id: email, username: user.username });
    res.json({ token, user: { id: email, username: user.username, email: user.email, leetcodeUsername: user.leetcodeUsername } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
};

/**
 * @name logoutUserController
 * @description Clear the session cookie
 * @access Public
 */
export const logout = (req, res) => {
  // Clear with the same attributes the cookie was set with, otherwise some
  // browsers won't match and remove it.
  res.clearCookie(TOKEN_COOKIE, { ...cookieOptions, maxAge: undefined });
  res.json({ success: true });
};

/**
 * @name getMeController
 * @description Get the currently authenticated user's profile
 * @access Private
 */
export const getMe = async (req, res) => {
  try {
    const user = await getItem(`USER#${req.userId}`, 'PROFILE');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: user.email,
      username: user.username,
      email: user.email,
      leetcodeUsername: user.leetcodeUsername,
      created_at: user.createdAt,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
};

/**
 * @name updateLeetcodeUsernameController
 * @description Set or clear the user's linked LeetCode username
 * @access Private
 */
export const updateLeetcodeUsername = async (req, res) => {
  try {
    const { leetcodeUsername } = req.body;
    const user = await getItem(`USER#${req.userId}`, 'PROFILE');
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (leetcodeUsername) {
      await updateItem(
        `USER#${req.userId}`,
        'PROFILE',
        'SET leetcodeUsername = :lc',
        { ':lc': leetcodeUsername }
      );
    } else {
      await updateItem(
        `USER#${req.userId}`,
        'PROFILE',
        'REMOVE leetcodeUsername'
      );
    }

    res.json({ success: true, leetcodeUsername });
  } catch (err) {
    console.error('Update leetcode username error:', err);
    res.status(500).json({ error: 'Failed to update LeetCode username' });
  }
};

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { JWT_SECRET, auth } = require('../middleware/auth');
const { putItem, getItem, updateItem } = require('../db/dynamodb');

const router = express.Router();

module.exports = function () {
  // Register
  router.post('/register', async (req, res) => {
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

      const token = jwt.sign({ id: email, username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: email, username, email } });
    } catch (err) {
      console.error('Register error:', err);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Login
  router.post('/login', async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const user = await getItem(`USER#${email}`, 'PROFILE');
      if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const token = jwt.sign({ id: email, username: user.username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { id: email, username: user.username, email: user.email, leetcodeUsername: user.leetcodeUsername } });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Get current user
  router.get('/me', auth, async (req, res) => {
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
  });

  // Update LeetCode username
  router.put('/me/leetcode-username', auth, async (req, res) => {
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
  });

  return router;
};

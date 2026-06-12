import { putItem, queryItems } from '../db/dynamodb.js';

/**
 * @name getPatternsController
 * @description Get all patterns (defaults first, then alphabetical)
 * @access Private
 */
export const getPatterns = async (req, res) => {
  try {
    const patterns = await queryItems('PATTERN', 'PAT#');
    // Sort: defaults first, then alphabetical
    patterns.sort((a, b) => {
      if (a.isDefault !== b.isDefault) return b.isDefault - a.isDefault;
      return a.name.localeCompare(b.name);
    });
    res.json(patterns.map(p => ({
      id: p.name, // Use name as ID (unique)
      name: p.name,
      is_default: p.isDefault,
      created_by: p.createdBy,
    })));
  } catch (err) {
    console.error('Get patterns error:', err);
    res.status(500).json({ error: 'Failed to get patterns' });
  }
};

/**
 * @name addPatternController
 * @description Add a custom pattern
 * @access Private
 */
export const addPattern = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Pattern name is required' });
    }

    const trimmed = name.trim();

    // Check if exists
    const existing = await queryItems('PATTERN', `PAT#${trimmed}`);
    if (existing.length > 0) {
      return res.status(400).json({ error: 'Pattern already exists' });
    }

    await putItem({
      PK: 'PATTERN',
      SK: `PAT#${trimmed}`,
      name: trimmed,
      isDefault: 0,
      createdBy: req.userId,
    });

    res.json({ id: trimmed, name: trimmed, is_default: 0 });
  } catch (err) {
    console.error('Add pattern error:', err);
    res.status(500).json({ error: 'Failed to add pattern' });
  }
};

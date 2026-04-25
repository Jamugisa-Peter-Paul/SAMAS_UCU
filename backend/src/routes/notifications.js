/**
 * Notifications Routes
 * @module routes/notifications
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

// Get user notifications
router.get('/', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    const unread = await query(
      'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND is_read = false', [req.user.id]);
    res.json({ success: true, data: result.rows, unreadCount: parseInt(unread.rows[0].count) });
  } catch (error) { next(error); }
});

// Mark notification as read
router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Marked as read.' });
  } catch (error) { next(error); }
});

// Mark all as read
router.put('/read-all', authenticate, async (req, res, next) => {
  try {
    await query('UPDATE notifications SET is_read = true WHERE user_id = $1', [req.user.id]);
    res.json({ success: true, message: 'All marked as read.' });
  } catch (error) { next(error); }
});

module.exports = router;

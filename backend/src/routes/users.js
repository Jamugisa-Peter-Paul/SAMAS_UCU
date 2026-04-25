/**
 * Users Routes (Admin)
 * @module routes/users
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Get all users (admin only)
router.get('/', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const { role, search } = req.query;
    let sql = 'SELECT id, email, full_name, role, department, phone, is_active, created_at FROM users WHERE 1=1';
    const params = [];
    let i = 1;
    if (role) { sql += ` AND role = $${i}`; params.push(role); i++; }
    if (search) { sql += ` AND (full_name ILIKE $${i} OR email ILIKE $${i})`; params.push(`%${search}%`); i++; }
    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows, count: result.rows.length });
  } catch (error) { next(error); }
});

// Toggle user active status
router.put('/:id/toggle-active', authenticate, authorize('admin'), async (req, res, next) => {
  try {
    const result = await query(
      'UPDATE users SET is_active = NOT is_active, updated_at = CURRENT_TIMESTAMP WHERE id = $1 RETURNING id, email, full_name, is_active', [req.params.id]);
    if (result.rows.length === 0) {return res.status(404).json({ success: false, message: 'User not found.' });}
    res.json({ success: true, data: result.rows[0] });
  } catch (error) { next(error); }
});

module.exports = router;

/**
 * Materials Routes
 * @module routes/materials
 */
const express = require('express');
const router = express.Router();
const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

// Get materials for a course
router.get('/course/:courseId', authenticate, async (req, res, next) => {
  try {
    const result = await query(
      'SELECT m.*, u.full_name as uploaded_by_name FROM materials m JOIN users u ON m.uploaded_by = u.id WHERE m.course_id = $1 ORDER BY m.created_at DESC',
      [req.params.courseId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
});

// Add material to a course
router.post('/', authenticate, authorize('lecturer', 'admin'), async (req, res, next) => {
  try {
    const { courseId, title, description, fileUrl, fileType } = req.body;
    if (!courseId || !title) {
      return res.status(400).json({ success: false, message: 'Course ID and title are required.' });
    }
    const result = await query(
      `INSERT INTO materials (course_id, title, description, file_url, file_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [courseId, title, description || null, fileUrl || null, fileType || 'document', req.user.id]
    );

    // Notify enrolled students
    const enrolled = await query(
      "SELECT student_id FROM enrollments WHERE course_id = $1 AND status = 'active'", [courseId]
    );
    for (const row of enrolled.rows) {
      await query(
        `INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)`,
        [row.student_id, 'New Material', `New material "${title}" has been uploaded.`, 'info']
      );
    }

    res.status(201).json({ success: true, message: 'Material added.', data: result.rows[0] });
  } catch (error) { next(error); }
});

// Delete material
router.delete('/:id', authenticate, authorize('lecturer', 'admin'), async (req, res, next) => {
  try {
    await query('DELETE FROM materials WHERE id = $1', [req.params.id]);
    res.json({ success: true, message: 'Material deleted.' });
  } catch (error) { next(error); }
});

module.exports = router;

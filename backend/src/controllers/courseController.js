/**
 * Course Controller
 * 
 * Handles CRUD operations for courses.
 * Lecturers can create, update, and delete their courses.
 * Students can view and search available courses.
 * 
 * @module controllers/courseController
 */

const { query } = require('../config/db');

/**
 * Get all courses with optional filtering.
 * GET /api/courses
 */
const getAllCourses = async (req, res, next) => {
  try {
    const { search, semester, lecturerId } = req.query;
    
    let sql = `
      SELECT c.*, u.full_name as lecturer_name,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrolled_count
      FROM courses c
      JOIN users u ON c.lecturer_id = u.id
      WHERE c.is_active = true
    `;
    const params = [];
    let paramIndex = 1;

    if (search) {
      sql += ` AND (c.title ILIKE $${paramIndex} OR c.code ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (semester) {
      sql += ` AND c.semester = $${paramIndex}`;
      params.push(semester);
      paramIndex++;
    }

    if (lecturerId) {
      sql += ` AND c.lecturer_id = $${paramIndex}`;
      params.push(lecturerId);
      paramIndex++;
    }

    sql += ' ORDER BY c.created_at DESC';

    const result = await query(sql, params);

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get a single course by ID with full details.
 * GET /api/courses/:id
 */
const getCourseById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT c.*, u.full_name as lecturer_name, u.email as lecturer_email,
        (SELECT COUNT(*) FROM enrollments e WHERE e.course_id = c.id AND e.status = 'active') as enrolled_count
       FROM courses c
       JOIN users u ON c.lecturer_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found.',
      });
    }

    // Get course materials
    const materials = await query(
      'SELECT * FROM materials WHERE course_id = $1 ORDER BY created_at DESC',
      [id]
    );

    // Get course assignments
    const assignments = await query(
      'SELECT * FROM assignments WHERE course_id = $1 ORDER BY due_date ASC',
      [id]
    );

    // Get course quizzes
    const quizzes = await query(
      'SELECT * FROM quizzes WHERE course_id = $1 ORDER BY created_at DESC',
      [id]
    );

    res.json({
      success: true,
      data: {
        ...result.rows[0],
        materials: materials.rows,
        assignments: assignments.rows,
        quizzes: quizzes.rows,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Create a new course.
 * POST /api/courses
 * Requires: lecturer or admin role
 */
const createCourse = async (req, res, next) => {
  try {
    const { code, title, description, credits, semester, academicYear, maxStudents } = req.body;

    if (!code || !title || !semester || !academicYear) {
      return res.status(400).json({
        success: false,
        message: 'Course code, title, semester, and academic year are required.',
      });
    }

    const result = await query(
      `INSERT INTO courses (code, title, description, lecturer_id, credits, semester, academic_year, max_students)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [code, title, description || null, req.user.id, credits || 3, semester, academicYear, maxStudents || 100]
    );

    res.status(201).json({
      success: true,
      message: 'Course created successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update an existing course.
 * PUT /api/courses/:id
 * Requires: course owner (lecturer) or admin
 */
const updateCourse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, description, credits, semester, academicYear, isActive, maxStudents } = req.body;

    // Verify ownership
    const course = await query('SELECT lecturer_id FROM courses WHERE id = $1', [id]);
    if (course.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (course.rows[0].lecturer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only update your own courses.' });
    }

    const result = await query(
      `UPDATE courses SET
       title = COALESCE($1, title),
       description = COALESCE($2, description),
       credits = COALESCE($3, credits),
       semester = COALESCE($4, semester),
       academic_year = COALESCE($5, academic_year),
       is_active = COALESCE($6, is_active),
       max_students = COALESCE($7, max_students),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $8 RETURNING *`,
      [title, description, credits, semester, academicYear, isActive, maxStudents, id]
    );

    res.json({
      success: true,
      message: 'Course updated successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Delete a course.
 * DELETE /api/courses/:id
 * Requires: course owner (lecturer) or admin
 */
const deleteCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const course = await query('SELECT lecturer_id FROM courses WHERE id = $1', [id]);
    if (course.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Course not found.' });
    }

    if (course.rows[0].lecturer_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own courses.' });
    }

    await query('DELETE FROM courses WHERE id = $1', [id]);

    res.json({
      success: true,
      message: 'Course deleted successfully.',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse };

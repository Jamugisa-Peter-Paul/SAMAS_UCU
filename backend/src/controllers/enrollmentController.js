/**
 * Enrollment Controller
 * 
 * Handles student course enrollment and withdrawal operations.
 * Manages enrollment status transitions and capacity checks.
 * 
 * @module controllers/enrollmentController
 */

const { query } = require('../config/db');

/**
 * Enroll a student in a course.
 * POST /api/enrollments
 */
const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.body;
    const studentId = req.user.id;

    if (!courseId) {
      return res.status(400).json({
        success: false,
        message: 'Course ID is required.',
      });
    }

    // Check if course exists and is active
    const course = await query(
      'SELECT * FROM courses WHERE id = $1 AND is_active = true',
      [courseId]
    );

    if (course.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Course not found or is not active.',
      });
    }

    // Check enrollment capacity
    const enrolledCount = await query(
      "SELECT COUNT(*) as count FROM enrollments WHERE course_id = $1 AND status = 'active'",
      [courseId]
    );

    if (parseInt(enrolledCount.rows[0].count) >= course.rows[0].max_students) {
      return res.status(400).json({
        success: false,
        message: 'This course has reached maximum enrollment capacity.',
      });
    }

    // Enroll student
    const result = await query(
      `INSERT INTO enrollments (student_id, course_id)
       VALUES ($1, $2)
       RETURNING *`,
      [studentId, courseId]
    );

    // Create notification
    await query(
      `INSERT INTO notifications (user_id, title, message, type)
       VALUES ($1, $2, $3, $4)`,
      [studentId, 'Enrollment Successful', `You have been enrolled in ${course.rows[0].title}`, 'success']
    );

    res.status(201).json({
      success: true,
      message: `Successfully enrolled in ${course.rows[0].title}.`,
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Drop a course enrollment.
 * PUT /api/enrollments/:id/drop
 */
const dropCourse = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await query(
      `UPDATE enrollments SET status = 'dropped'
       WHERE id = $1 AND student_id = $2 AND status = 'active'
       RETURNING *`,
      [id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Enrollment not found or already dropped.',
      });
    }

    res.json({
      success: true,
      message: 'Course dropped successfully.',
      data: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get enrolled students for a course.
 * GET /api/enrollments/course/:courseId
 */
const getCourseEnrollments = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const result = await query(
      `SELECT e.*, u.full_name, u.email, u.department
       FROM enrollments e
       JOIN users u ON e.student_id = u.id
       WHERE e.course_id = $1
       ORDER BY u.full_name`,
      [courseId]
    );

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
 * Get a student's enrollments.
 * GET /api/enrollments/my
 */
const getMyEnrollments = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT e.*, c.code, c.title, c.credits, c.semester, c.academic_year,
       u.full_name as lecturer_name
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       JOIN users u ON c.lecturer_id = u.id
       WHERE e.student_id = $1
       ORDER BY e.enrolled_at DESC`,
      [req.user.id]
    );

    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { enrollInCourse, dropCourse, getCourseEnrollments, getMyEnrollments };

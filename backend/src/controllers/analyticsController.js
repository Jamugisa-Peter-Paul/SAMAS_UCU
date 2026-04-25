/**
 * Analytics Controller
 * @module controllers/analyticsController
 */
const { query } = require('../config/db');

const getDashboardStats = async (req, res, next) => {
  try {
    const { role, id } = req.user;
    let stats = {};

    if (role === 'admin') {
      const users = await query('SELECT COUNT(*) as count FROM users');
      const students = await query("SELECT COUNT(*) as count FROM users WHERE role='student'");
      const lecturers = await query("SELECT COUNT(*) as count FROM users WHERE role='lecturer'");
      const courses = await query('SELECT COUNT(*) as count FROM courses WHERE is_active=true');
      const enrollments = await query("SELECT COUNT(*) as count FROM enrollments WHERE status='active'");
      const submissions = await query('SELECT COUNT(*) as count FROM submissions');

      stats = {
        totalUsers: parseInt(users.rows[0].count),
        totalStudents: parseInt(students.rows[0].count),
        totalLecturers: parseInt(lecturers.rows[0].count),
        totalCourses: parseInt(courses.rows[0].count),
        activeEnrollments: parseInt(enrollments.rows[0].count),
        totalSubmissions: parseInt(submissions.rows[0].count),
      };
    } else if (role === 'lecturer') {
      const courses = await query('SELECT COUNT(*) as count FROM courses WHERE lecturer_id=$1 AND is_active=true', [id]);
      const students = await query(
        `SELECT COUNT(DISTINCT e.student_id) as count FROM enrollments e
         JOIN courses c ON e.course_id = c.id WHERE c.lecturer_id = $1 AND e.status='active'`, [id]);
      const assignments = await query(
        `SELECT COUNT(*) as count FROM assignments a JOIN courses c ON a.course_id = c.id WHERE c.lecturer_id = $1`, [id]);
      const pending = await query(
        `SELECT COUNT(*) as count FROM submissions s
         JOIN assignments a ON s.assignment_id = a.id
         JOIN courses c ON a.course_id = c.id WHERE c.lecturer_id = $1 AND s.status='submitted'`, [id]);

      stats = {
        myCourses: parseInt(courses.rows[0].count),
        totalStudents: parseInt(students.rows[0].count),
        totalAssignments: parseInt(assignments.rows[0].count),
        pendingGrading: parseInt(pending.rows[0].count),
      };
    } else {
      const enrollments = await query("SELECT COUNT(*) as count FROM enrollments WHERE student_id=$1 AND status='active'", [id]);
      const submissions = await query('SELECT COUNT(*) as count FROM submissions WHERE student_id=$1', [id]);
      const quizzes = await query('SELECT COUNT(*) as count FROM quiz_attempts WHERE student_id=$1', [id]);
      const avgScore = await query('SELECT AVG(score) as avg FROM submissions WHERE student_id=$1 AND score IS NOT NULL', [id]);

      stats = {
        enrolledCourses: parseInt(enrollments.rows[0].count),
        totalSubmissions: parseInt(submissions.rows[0].count),
        quizzesTaken: parseInt(quizzes.rows[0].count),
        averageScore: parseFloat(avgScore.rows[0].avg) || 0,
      };
    }

    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
};

const getCourseAnalytics = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const enrollments = await query("SELECT COUNT(*) as count FROM enrollments WHERE course_id=$1 AND status='active'", [courseId]);
    const avgScore = await query(
      `SELECT AVG(s.score) as avg FROM submissions s JOIN assignments a ON s.assignment_id=a.id WHERE a.course_id=$1 AND s.score IS NOT NULL`, [courseId]);
    const submissions = await query(
      `SELECT COUNT(*) as count FROM submissions s JOIN assignments a ON s.assignment_id=a.id WHERE a.course_id=$1`, [courseId]);
    const scoreDistribution = await query(
      `SELECT CASE WHEN s.score >= 80 THEN 'A' WHEN s.score >= 60 THEN 'B' WHEN s.score >= 40 THEN 'C' ELSE 'F' END as grade, COUNT(*) as count
       FROM submissions s JOIN assignments a ON s.assignment_id=a.id WHERE a.course_id=$1 AND s.score IS NOT NULL GROUP BY grade`, [courseId]);

    res.json({
      success: true,
      data: {
        enrolledStudents: parseInt(enrollments.rows[0].count),
        averageScore: parseFloat(avgScore.rows[0].avg) || 0,
        totalSubmissions: parseInt(submissions.rows[0].count),
        scoreDistribution: scoreDistribution.rows,
      },
    });
  } catch (error) { next(error); }
};

module.exports = { getDashboardStats, getCourseAnalytics };

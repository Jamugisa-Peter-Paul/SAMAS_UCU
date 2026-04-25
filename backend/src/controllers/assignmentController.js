/**
 * Assignment Controller
 * @module controllers/assignmentController
 */
const { query } = require('../config/db');

const getCourseAssignments = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await query(
      `SELECT a.*, (SELECT COUNT(*) FROM submissions s WHERE s.assignment_id = a.id) as submission_count
       FROM assignments a WHERE a.course_id = $1 ORDER BY a.due_date ASC`, [courseId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

const getAssignmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await query(
      `SELECT a.*, c.title as course_title, c.code as course_code
       FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = $1`, [id]);
    if (result.rows.length === 0) {return res.status(404).json({ success: false, message: 'Assignment not found.' });}

    let submission = null, submissions = [];
    if (req.user.role === 'student') {
      const sub = await query('SELECT * FROM submissions WHERE assignment_id = $1 AND student_id = $2', [id, req.user.id]);
      submission = sub.rows[0] || null;
    }
    if (req.user.role === 'lecturer' || req.user.role === 'admin') {
      const sub = await query(
        `SELECT s.*, u.full_name as student_name FROM submissions s JOIN users u ON s.student_id = u.id WHERE s.assignment_id = $1 ORDER BY s.submitted_at DESC`, [id]);
      submissions = sub.rows;
    }
    res.json({ success: true, data: { ...result.rows[0], submission, submissions } });
  } catch (error) { next(error); }
};

const createAssignment = async (req, res, next) => {
  try {
    const { courseId, title, description, dueDate, maxScore, isPublished } = req.body;
    if (!courseId || !title || !dueDate) {return res.status(400).json({ success: false, message: 'Course ID, title, and due date are required.' });}
    const result = await query(
      `INSERT INTO assignments (course_id, title, description, due_date, max_score, is_published) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [courseId, title, description || null, dueDate, maxScore || 100, isPublished || false]);
    res.status(201).json({ success: true, message: 'Assignment created.', data: result.rows[0] });
  } catch (error) { next(error); }
};

const submitAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, fileUrl } = req.body;
    const result = await query(
      `INSERT INTO submissions (assignment_id, student_id, content, file_url) VALUES ($1,$2,$3,$4)
       ON CONFLICT (assignment_id, student_id) DO UPDATE SET content = EXCLUDED.content, file_url = EXCLUDED.file_url, submitted_at = CURRENT_TIMESTAMP, status = 'submitted' RETURNING *`,
      [id, req.user.id, content || null, fileUrl || null]);
    res.status(201).json({ success: true, message: 'Submitted.', data: result.rows[0] });
  } catch (error) { next(error); }
};

const gradeSubmission = async (req, res, next) => {
  try {
    const { submissionId } = req.params;
    const { score, feedback } = req.body;
    if (score === undefined) {return res.status(400).json({ success: false, message: 'Score is required.' });}
    const result = await query(
      `UPDATE submissions SET score=$1, feedback=$2, status='graded', graded_at=CURRENT_TIMESTAMP WHERE id=$3 RETURNING *`,
      [score, feedback || null, submissionId]);
    if (result.rows.length === 0) {return res.status(404).json({ success: false, message: 'Not found.' });}
    await query(`INSERT INTO notifications (user_id, title, message, type) VALUES ($1,$2,$3,$4)`,
      [result.rows[0].student_id, 'Assignment Graded', `Score: ${score}`, 'info']);
    res.json({ success: true, message: 'Graded.', data: result.rows[0] });
  } catch (error) { next(error); }
};

module.exports = { getCourseAssignments, getAssignmentById, createAssignment, submitAssignment, gradeSubmission };

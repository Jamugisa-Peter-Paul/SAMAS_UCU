/**
 * Quiz Controller
 * @module controllers/quizController
 */
const { query } = require('../config/db');

const getCourseQuizzes = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const result = await query(
      `SELECT q.*, (SELECT COUNT(*) FROM quiz_questions qq WHERE qq.quiz_id = q.id) as question_count
       FROM quizzes q WHERE q.course_id = $1 ORDER BY q.created_at DESC`, [courseId]);
    res.json({ success: true, data: result.rows });
  } catch (error) { next(error); }
};

const getQuizById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const quiz = await query(`SELECT q.*, c.title as course_title FROM quizzes q JOIN courses c ON q.course_id = c.id WHERE q.id = $1`, [id]);
    if (quiz.rows.length === 0) {return res.status(404).json({ success: false, message: 'Quiz not found.' });}

    let questions = [];
    if (req.user.role === 'lecturer' || req.user.role === 'admin') {
      const q = await query('SELECT * FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_order', [id]);
      questions = q.rows;
    } else {
      const q = await query('SELECT id, question_text, option_a, option_b, option_c, option_d, points, question_order FROM quiz_questions WHERE quiz_id = $1 ORDER BY question_order', [id]);
      questions = q.rows;
    }

    let attempt = null;
    if (req.user.role === 'student') {
      const a = await query('SELECT * FROM quiz_attempts WHERE quiz_id = $1 AND student_id = $2', [id, req.user.id]);
      attempt = a.rows[0] || null;
    }

    res.json({ success: true, data: { ...quiz.rows[0], questions, attempt } });
  } catch (error) { next(error); }
};

const createQuiz = async (req, res, next) => {
  try {
    const { courseId, title, description, durationMinutes, isPublished, questions } = req.body;
    if (!courseId || !title) {return res.status(400).json({ success: false, message: 'Course ID and title required.' });}

    const result = await query(
      `INSERT INTO quizzes (course_id, title, description, duration_minutes, is_published, created_by) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [courseId, title, description || null, durationMinutes || 30, isPublished || false, req.user.id]);

    const quizId = result.rows[0].id;
    if (questions && questions.length > 0) {
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        await query(
          `INSERT INTO quiz_questions (quiz_id, question_text, option_a, option_b, option_c, option_d, correct_option, points, question_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [quizId, q.questionText, q.optionA, q.optionB, q.optionC, q.optionD, q.correctOption, q.points || 1, i + 1]);
      }
    }
    res.status(201).json({ success: true, message: 'Quiz created.', data: result.rows[0] });
  } catch (error) { next(error); }
};

const submitQuiz = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { answers } = req.body; // { questionId: 'A'|'B'|'C'|'D' }

    const questions = await query('SELECT * FROM quiz_questions WHERE quiz_id = $1', [id]);
    let score = 0, totalPoints = 0;
    for (const q of questions.rows) {
      totalPoints += q.points;
      if (answers[q.id] && answers[q.id].toUpperCase() === q.correct_option) {score += q.points;}
    }

    const result = await query(
      `INSERT INTO quiz_attempts (quiz_id, student_id, score, total_points, answers, completed_at) VALUES ($1,$2,$3,$4,$5,CURRENT_TIMESTAMP)
       ON CONFLICT (quiz_id, student_id) DO UPDATE SET score=EXCLUDED.score, total_points=EXCLUDED.total_points, answers=EXCLUDED.answers, completed_at=CURRENT_TIMESTAMP RETURNING *`,
      [id, req.user.id, score, totalPoints, JSON.stringify(answers)]);

    res.json({ success: true, message: `Quiz submitted. Score: ${score}/${totalPoints}`, data: result.rows[0] });
  } catch (error) { next(error); }
};

module.exports = { getCourseQuizzes, getQuizById, createQuiz, submitQuiz };

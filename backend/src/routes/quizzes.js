/**
 * Quiz Routes
 * @module routes/quizzes
 */
const express = require('express');
const router = express.Router();
const { getCourseQuizzes, getQuizById, createQuiz, submitQuiz } = require('../controllers/quizController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/course/:courseId', authenticate, getCourseQuizzes);
router.get('/:id', authenticate, getQuizById);
router.post('/', authenticate, authorize('lecturer', 'admin'), createQuiz);
router.post('/:id/submit', authenticate, authorize('student'), submitQuiz);

module.exports = router;

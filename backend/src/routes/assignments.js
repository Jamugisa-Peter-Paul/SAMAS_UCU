/**
 * Assignment Routes
 * @module routes/assignments
 */
const express = require('express');
const router = express.Router();
const { getCourseAssignments, getAssignmentById, createAssignment, submitAssignment, gradeSubmission } = require('../controllers/assignmentController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/course/:courseId', authenticate, getCourseAssignments);
router.get('/:id', authenticate, getAssignmentById);
router.post('/', authenticate, authorize('lecturer', 'admin'), createAssignment);
router.post('/:id/submit', authenticate, authorize('student'), submitAssignment);
router.put('/submissions/:submissionId/grade', authenticate, authorize('lecturer', 'admin'), gradeSubmission);

module.exports = router;

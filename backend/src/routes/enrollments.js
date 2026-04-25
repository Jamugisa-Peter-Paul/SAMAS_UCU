/**
 * Enrollment Routes
 * @module routes/enrollments
 */
const express = require('express');
const router = express.Router();
const { enrollInCourse, dropCourse, getCourseEnrollments, getMyEnrollments } = require('../controllers/enrollmentController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.post('/', authenticate, authorize('student'), enrollInCourse);
router.put('/:id/drop', authenticate, authorize('student'), dropCourse);
router.get('/my', authenticate, authorize('student'), getMyEnrollments);
router.get('/course/:courseId', authenticate, authorize('lecturer', 'admin'), getCourseEnrollments);

module.exports = router;

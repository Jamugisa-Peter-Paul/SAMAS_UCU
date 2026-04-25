/**
 * Course Routes
 * @module routes/courses
 */
const express = require('express');
const router = express.Router();
const { getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse } = require('../controllers/courseController');
const { authenticate } = require('../middleware/auth');
const { authorize } = require('../middleware/rbac');

router.get('/', authenticate, getAllCourses);
router.get('/:id', authenticate, getCourseById);
router.post('/', authenticate, authorize('lecturer', 'admin'), createCourse);
router.put('/:id', authenticate, authorize('lecturer', 'admin'), updateCourse);
router.delete('/:id', authenticate, authorize('lecturer', 'admin'), deleteCourse);

module.exports = router;

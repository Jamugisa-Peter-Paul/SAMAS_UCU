/**
 * Analytics Routes
 * @module routes/analytics
 */
const express = require('express');
const router = express.Router();
const { getDashboardStats, getCourseAnalytics } = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.get('/dashboard', authenticate, getDashboardStats);
router.get('/course/:courseId', authenticate, getCourseAnalytics);

module.exports = router;

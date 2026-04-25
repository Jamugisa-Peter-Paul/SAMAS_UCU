/**
 * SAMAS Backend Server - Entry Point
 * Smart Academic Management and Analytics System
 * Uganda Christian University
 * 
 * Express.js REST API server with JWT authentication,
 * role-based access control, and PostgreSQL database.
 * 
 * @module index
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
require('dotenv').config();

const { initializeDatabase } = require('./config/initDb');
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const courseRoutes = require('./routes/courses');
const enrollmentRoutes = require('./routes/enrollments');
const assignmentRoutes = require('./routes/assignments');
const quizRoutes = require('./routes/quizzes');
const analyticsRoutes = require('./routes/analytics');
const userRoutes = require('./routes/users');
const notificationRoutes = require('./routes/notifications');
const materialRoutes = require('./routes/materials');

const app = express();
const PORT = process.env.PORT || 5000;

// ============================================================
// MIDDLEWARE CONFIGURATION
// ============================================================

// Security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || origin.startsWith('http://localhost:3000') || origin.startsWith('http://localhost:3001') || origin === process.env.FRONTEND_URL) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Request logging
app.use(morgan('dev'));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ============================================================
// API ROUTES
// ============================================================

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'SAMAS API is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Register route modules
app.use('/api/auth', authRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/enrollments', enrollmentRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/users', userRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/materials', materialRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// Global error handler
app.use(errorHandler);

// ============================================================
// SERVER STARTUP
// ============================================================

const startServer = async () => {
  try {
    // Initialize database schema and seed data
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`\n🚀 SAMAS API Server running on http://localhost:${PORT}`);
      console.log(`📚 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Only bind to a port when run directly; skip in test environment so supertest
// can attach to the express app without an EADDRINUSE conflict.
if (require.main === module) {
  startServer();
}

module.exports = app;

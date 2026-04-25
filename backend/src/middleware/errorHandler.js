/**
 * Global Error Handler Middleware
 * 
 * Catches all unhandled errors and returns a standardized error response.
 * Logs errors in development mode with stack traces.
 * 
 * @module middleware/errorHandler
 */

/**
 * Express error handling middleware.
 * 
 * @param {Error} err - The error object.
 * @param {Object} req - Express request object.
 * @param {Object} res - Express response object.
 * @param {Function} next - Express next middleware function.
 */
const errorHandler = (err, req, res, next) => {
  console.error('[ERROR]', err.message);
  
  if (process.env.NODE_ENV === 'development') {
    console.error('[STACK]', err.stack);
  }
  
  // Handle specific error types
  if (err.code === '23505') {
    // PostgreSQL unique violation
    return res.status(409).json({
      success: false,
      message: 'A record with this information already exists.',
    });
  }
  
  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    return res.status(400).json({
      success: false,
      message: 'Referenced record does not exist.',
    });
  }
  
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};

module.exports = { errorHandler };

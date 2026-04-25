/**
 * Role-Based Access Control (RBAC) Middleware
 * 
 * Restricts access to routes based on user roles.
 * Must be used after the authenticate middleware.
 * Supports multiple allowed roles per route.
 * 
 * @module middleware/rbac
 */

/**
 * Creates middleware that restricts access to specified roles.
 * 
 * @param {...string} allowedRoles - The roles allowed to access the route.
 * @returns {Function} Express middleware function.
 * 
 * @example
 * // Only admins can access
 * router.get('/admin-only', authenticate, authorize('admin'), handler);
 * 
 * // Admins and lecturers can access
 * router.get('/staff', authenticate, authorize('admin', 'lecturer'), handler);
 */
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required.',
      });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}. Your role: ${req.user.role}`,
      });
    }
    
    next();
  };
};

module.exports = { authorize };

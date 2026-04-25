/**
 * Authentication Controller
 * 
 * Handles user registration, login, and profile retrieval.
 * Implements JWT token generation and password hashing with bcrypt.
 * 
 * @module controllers/authController
 */

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
require('dotenv').config();

/**
 * Generate a JWT token for a user.
 * @param {Object} user - The user object.
 * @returns {string} JWT token.
 */
const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
};

/**
 * Register a new user.
 * POST /api/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { email, password, fullName, role, department, phone } = req.body;

    // Validate required fields
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, full name, and role are required.',
      });
    }

    // Validate role
    if (!['admin', 'lecturer', 'student'].includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Role must be admin, lecturer, or student.',
      });
    }

    // Check if user already exists
    const existingUser = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'A user with this email already exists.',
      });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, department, phone)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, department, phone, created_at`,
      [email, passwordHash, fullName, role, department || null, phone || null]
    );

    const user = result.rows[0];
    const token = generateToken(user);

    res.status(201).json({
      success: true,
      message: 'User registered successfully.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          department: user.department,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login an existing user.
 * POST /api/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required.',
      });
    }

    // Find user
    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = result.rows[0];

    // Check if account is active
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Contact the administrator.',
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      message: 'Login successful.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          department: user.department,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Get the current user's profile.
 * GET /api/auth/profile
 */
const getProfile = async (req, res, next) => {
  try {
    const result = await query(
      `SELECT id, email, full_name, role, department, phone, avatar_url, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found.',
      });
    }

    const user = result.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        department: user.department,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update the current user's profile.
 * PUT /api/auth/profile
 */
const updateProfile = async (req, res, next) => {
  try {
    const { fullName, department, phone } = req.body;

    const result = await query(
      `UPDATE users SET full_name = COALESCE($1, full_name),
       department = COALESCE($2, department),
       phone = COALESCE($3, phone),
       updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING id, email, full_name, role, department, phone`,
      [fullName, department, phone, req.user.id]
    );

    const user = result.rows[0];

    res.json({
      success: true,
      message: 'Profile updated successfully.',
      data: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        department: user.department,
        phone: user.phone,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getProfile, updateProfile };

/**
 * Unit Tests for Authentication Controller
 * Tests registration, login, and profile functionality.
 * Uses mocking to isolate controller logic from database.
 */

// Mock the database module
jest.mock('../../src/config/db', () => ({
  query: jest.fn(),
}));

const { query } = require('../../src/config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Mock environment variables
process.env.JWT_SECRET = 'test-secret-key';

const { register, login, getProfile } = require('../../src/controllers/authController');

// Helper to create mock Express request/response objects
const mockRequest = (body = {}, params = {}, user = null, query = {}) => ({
  body, params, user, query,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = jest.fn();

describe('Auth Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('should return 400 if required fields are missing', async () => {
      const req = mockRequest({ email: 'test@test.com' });
      const res = mockResponse();

      await register(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: false })
      );
    });

    test('should return 400 for invalid role', async () => {
      const req = mockRequest({
        email: 'test@test.com', password: 'pass123',
        fullName: 'Test User', role: 'superuser',
      });
      const res = mockResponse();

      await register(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 409 if user already exists', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: '123' }] });

      const req = mockRequest({
        email: 'existing@test.com', password: 'pass123',
        fullName: 'Test User', role: 'student',
      });
      const res = mockResponse();

      await register(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('should register a new user successfully', async () => {
      query
        .mockResolvedValueOnce({ rows: [] }) // No existing user
        .mockResolvedValueOnce({
          rows: [{
            id: 'new-id', email: 'new@test.com',
            full_name: 'New User', role: 'student',
            department: 'CS', created_at: new Date(),
          }],
        });

      const req = mockRequest({
        email: 'new@test.com', password: 'pass123',
        fullName: 'New User', role: 'student', department: 'CS',
      });
      const res = mockResponse();

      await register(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({ email: 'new@test.com' }),
            token: expect.any(String),
          }),
        })
      );
    });
  });

  describe('login', () => {
    test('should return 400 if email or password missing', async () => {
      const req = mockRequest({ email: 'test@test.com' });
      const res = mockResponse();

      await login(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(400);
    });

    test('should return 401 for non-existent user', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({ email: 'none@test.com', password: 'pass' });
      const res = mockResponse();

      await login(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should return 401 for wrong password', async () => {
      const hash = await bcrypt.hash('correct', 10);
      query.mockResolvedValueOnce({
        rows: [{ id: '1', email: 'test@test.com', password_hash: hash, is_active: true, full_name: 'T', role: 'student' }],
      });

      const req = mockRequest({ email: 'test@test.com', password: 'wrong' });
      const res = mockResponse();

      await login(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(401);
    });

    test('should login successfully with correct credentials', async () => {
      const hash = await bcrypt.hash('correct', 10);
      query.mockResolvedValueOnce({
        rows: [{ id: '1', email: 'test@test.com', password_hash: hash, is_active: true, full_name: 'Test', role: 'student', department: 'CS' }],
      });

      const req = mockRequest({ email: 'test@test.com', password: 'correct' });
      const res = mockResponse();

      await login(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ token: expect.any(String) }),
        })
      );
    });
  });

  describe('getProfile', () => {
    test('should return user profile', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: '1', email: 'test@test.com', full_name: 'Test', role: 'student', department: 'CS', phone: null, avatar_url: null, created_at: new Date() }],
      });

      const req = mockRequest({}, {}, { id: '1' });
      const res = mockResponse();

      await getProfile(req, res, mockNext);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: expect.objectContaining({ email: 'test@test.com' }),
        })
      );
    });

    test('should return 404 if user not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const req = mockRequest({}, {}, { id: 'non-existent' });
      const res = mockResponse();

      await getProfile(req, res, mockNext);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

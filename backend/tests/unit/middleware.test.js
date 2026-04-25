/**
 * Unit Tests for Authentication Middleware
 * Tests JWT verification and token validation.
 */

const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'test-secret-key';

const { authenticate } = require('../../src/middleware/auth');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('Auth Middleware', () => {
  test('should return 401 if no Authorization header', () => {
    const req = { headers: {} };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 401 if token format is wrong', () => {
    const req = { headers: { authorization: 'InvalidFormat' } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should return 401 for invalid token', () => {
    const req = { headers: { authorization: 'Bearer invalid.token.here' } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('should call next() with valid token', () => {
    const token = jwt.sign(
      { id: '1', email: 'test@test.com', role: 'student', fullName: 'Test' },
      process.env.JWT_SECRET, { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    authenticate(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toBeDefined();
    expect(req.user.email).toBe('test@test.com');
  });

  test('should return 401 for expired token', () => {
    const token = jwt.sign(
      { id: '1', email: 'test@test.com', role: 'student', fullName: 'Test' },
      process.env.JWT_SECRET, { expiresIn: '0s' }
    );
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockResponse();
    const next = jest.fn();

    // Small delay to ensure token expires
    setTimeout(() => {
      authenticate(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
    }, 100);
  });
});

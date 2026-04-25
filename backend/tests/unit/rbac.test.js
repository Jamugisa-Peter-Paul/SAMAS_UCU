/**
 * Unit Tests for RBAC Middleware
 * Tests role-based access control authorization.
 */

const { authorize } = require('../../src/middleware/rbac');

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('RBAC Middleware', () => {
  test('should return 401 if no user on request', () => {
    const middleware = authorize('admin');
    const req = {};
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('should return 403 if user role not allowed', () => {
    const middleware = authorize('admin');
    const req = { user: { role: 'student' } };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('should call next() if user role is allowed', () => {
    const middleware = authorize('admin', 'lecturer');
    const req = { user: { role: 'lecturer' } };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  test('should handle multiple allowed roles', () => {
    const middleware = authorize('admin', 'lecturer', 'student');
    const req = { user: { role: 'student' } };
    const res = mockResponse();
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });
});

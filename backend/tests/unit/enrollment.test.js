/**
 * Unit Tests for Enrollment Controller
 * Tests enroll, drop, and list operations with mocked database.
 */

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

const { query } = require('../../src/config/db');
const {
  enrollInCourse, dropCourse, getCourseEnrollments, getMyEnrollments,
} = require('../../src/controllers/enrollmentController');

const mockReq = (body = {}, params = {}, user = { id: 'student1', role: 'student' }) =>
  ({ body, params, user });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ─── enrollInCourse ───────────────────────────────────────────────────────────
describe('enrollInCourse', () => {
  test('returns 400 when courseId missing', async () => {
    const res = mockRes();
    await enrollInCourse(mockReq({}), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('returns 404 when course does not exist', async () => {
    query.mockResolvedValueOnce({ rows: [] }); // course lookup
    const res = mockRes();
    await enrollInCourse(mockReq({ courseId: 'bad-id' }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 400 when course at capacity', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'SE101', max_students: 2 }] }) // course
      .mockResolvedValueOnce({ rows: [{ count: '2' }] });                                // enrolled count

    const res = mockRes();
    await enrollInCourse(mockReq({ courseId: 'c1' }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('capacity') }));
  });

  test('enrolls student successfully', async () => {
    const enrollment = { id: 'e1', student_id: 'student1', course_id: 'c1', status: 'active' };
    query
      .mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'Software Eng', max_students: 50 }] }) // course
      .mockResolvedValueOnce({ rows: [{ count: '10' }] })                                        // enrolled count
      .mockResolvedValueOnce({ rows: [enrollment] })                                             // insert enrollment
      .mockResolvedValueOnce({ rows: [] });                                                      // insert notification

    const res = mockRes();
    await enrollInCourse(mockReq({ courseId: 'c1' }), res, next);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: enrollment })
    );
  });

  test('forwards database errors to next', async () => {
    const err = new Error('DB error');
    query.mockRejectedValueOnce(err);
    await enrollInCourse(mockReq({ courseId: 'c1' }), mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── dropCourse ───────────────────────────────────────────────────────────────
describe('dropCourse', () => {
  test('returns 404 when enrollment not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await dropCourse(mockReq({}, { id: 'bad' }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('drops enrollment successfully', async () => {
    const dropped = { id: 'e1', status: 'dropped' };
    query.mockResolvedValueOnce({ rows: [dropped] });
    const res = mockRes();
    await dropCourse(mockReq({}, { id: 'e1' }), res, next);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: dropped }));
  });
});

// ─── getCourseEnrollments ─────────────────────────────────────────────────────
describe('getCourseEnrollments', () => {
  test('returns enrolled students for a course', async () => {
    const rows = [
      { id: 'e1', full_name: 'Alice', email: 'alice@ucu.ac.ug' },
      { id: 'e2', full_name: 'Bob',   email: 'bob@ucu.ac.ug' },
    ];
    query.mockResolvedValueOnce({ rows });
    const res = mockRes();
    await getCourseEnrollments(mockReq({}, { courseId: 'c1' }), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: rows, count: 2 })
    );
  });
});

// ─── getMyEnrollments ─────────────────────────────────────────────────────────
describe('getMyEnrollments', () => {
  test('returns current student enrollments', async () => {
    const rows = [{ id: 'e1', title: 'Software Eng', code: 'SE101' }];
    query.mockResolvedValueOnce({ rows });
    const res = mockRes();
    await getMyEnrollments(mockReq(), res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: rows, count: 1 })
    );
  });
});

/**
 * Unit Tests for Course Controller
 * Tests CRUD operations with mocked database.
 */

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));

const { query } = require('../../src/config/db');
const {
  getAllCourses, getCourseById, createCourse, updateCourse, deleteCourse,
} = require('../../src/controllers/courseController');

const mockReq = (body = {}, params = {}, user = { id: 'u1', role: 'lecturer' }, queryParams = {}) =>
  ({ body, params, user, query: queryParams });

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
};

const next = jest.fn();

beforeEach(() => jest.clearAllMocks());

// ─── getAllCourses ─────────────────────────────────────────────────────────────
describe('getAllCourses', () => {
  test('returns all active courses', async () => {
    const rows = [{ id: '1', title: 'Software Engineering', code: 'SE101' }];
    query.mockResolvedValueOnce({ rows });

    const res = mockRes();
    await getAllCourses(mockReq(), res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: rows, count: 1 })
    );
  });

  test('filters by search term', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await getAllCourses(mockReq({}, {}, { id: 'u1', role: 'student' }, { search: 'math' }), res, next);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), expect.any(Array));
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  test('forwards database errors to next', async () => {
    const err = new Error('DB error');
    query.mockRejectedValueOnce(err);
    await getAllCourses(mockReq(), mockRes(), next);
    expect(next).toHaveBeenCalledWith(err);
  });
});

// ─── getCourseById ────────────────────────────────────────────────────────────
describe('getCourseById', () => {
  test('returns 404 when course not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await getCourseById(mockReq({}, { id: 'bad-id' }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns course with materials, assignments, quizzes', async () => {
    const course = { id: '1', title: 'SE101', lecturer_id: 'u1' };
    query
      .mockResolvedValueOnce({ rows: [course] })   // course
      .mockResolvedValueOnce({ rows: [] })          // materials
      .mockResolvedValueOnce({ rows: [] })          // assignments
      .mockResolvedValueOnce({ rows: [] });         // quizzes

    const res = mockRes();
    await getCourseById(mockReq({}, { id: '1' }), res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: '1', materials: [], assignments: [], quizzes: [] }),
      })
    );
  });
});

// ─── createCourse ─────────────────────────────────────────────────────────────
describe('createCourse', () => {
  test('returns 400 when required fields missing', async () => {
    const res = mockRes();
    await createCourse(mockReq({ title: 'Test' }), res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('creates course and returns 201', async () => {
    const newCourse = { id: 'c1', code: 'SE101', title: 'Software Eng' };
    query.mockResolvedValueOnce({ rows: [newCourse] });

    const res = mockRes();
    await createCourse(
      mockReq({ code: 'SE101', title: 'Software Eng', semester: 'Sem1', academicYear: '2024/25' }),
      res,
      next
    );

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: newCourse })
    );
  });
});

// ─── updateCourse ─────────────────────────────────────────────────────────────
describe('updateCourse', () => {
  test('returns 404 when course not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await updateCourse(mockReq({}, { id: 'bad' }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when not course owner', async () => {
    query.mockResolvedValueOnce({ rows: [{ lecturer_id: 'other-user' }] });
    const res = mockRes();
    await updateCourse(mockReq({}, { id: 'c1' }, { id: 'u1', role: 'lecturer' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('updates course successfully as owner', async () => {
    const updated = { id: 'c1', title: 'Updated' };
    query
      .mockResolvedValueOnce({ rows: [{ lecturer_id: 'u1' }] }) // ownership check
      .mockResolvedValueOnce({ rows: [updated] });               // update

    const res = mockRes();
    await updateCourse(mockReq({ title: 'Updated' }, { id: 'c1' }, { id: 'u1', role: 'lecturer' }), res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: updated }));
  });

  test('admin can update any course', async () => {
    const updated = { id: 'c1', title: 'Admin Updated' };
    query
      .mockResolvedValueOnce({ rows: [{ lecturer_id: 'other' }] })
      .mockResolvedValueOnce({ rows: [updated] });

    const res = mockRes();
    await updateCourse(mockReq({ title: 'Admin Updated' }, { id: 'c1' }, { id: 'admin1', role: 'admin' }), res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

// ─── deleteCourse ─────────────────────────────────────────────────────────────
describe('deleteCourse', () => {
  test('returns 404 when course not found', async () => {
    query.mockResolvedValueOnce({ rows: [] });
    const res = mockRes();
    await deleteCourse(mockReq({}, { id: 'bad' }), res, next);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('returns 403 when not authorized', async () => {
    query.mockResolvedValueOnce({ rows: [{ lecturer_id: 'other' }] });
    const res = mockRes();
    await deleteCourse(mockReq({}, { id: 'c1' }, { id: 'u1', role: 'student' }), res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });

  test('deletes course successfully', async () => {
    query
      .mockResolvedValueOnce({ rows: [{ lecturer_id: 'u1' }] })
      .mockResolvedValueOnce({ rows: [] });

    const res = mockRes();
    await deleteCourse(mockReq({}, { id: 'c1' }, { id: 'u1', role: 'lecturer' }), res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

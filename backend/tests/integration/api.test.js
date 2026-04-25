/**
 * Integration Tests for SAMAS REST API
 * Uses supertest to exercise the full HTTP stack with a mocked database.
 * Validates route wiring, middleware chain, and response contracts.
 */

jest.mock('../../src/config/db', () => ({ query: jest.fn() }));
jest.mock('../../src/config/initDb', () => ({ initializeDatabase: jest.fn().mockResolvedValue(true) }));

process.env.JWT_SECRET = 'integration-test-secret';
process.env.NODE_ENV   = 'test';

const request = require('supertest');
const jwt     = require('jsonwebtoken');
const bcrypt  = require('bcryptjs');
const { query } = require('../../src/config/db');
const app       = require('../../src/index');

// ─── Token helpers ─────────────────────────────────────────────────────────────
const makeToken = (role = 'student', id = 'user-1') =>
  jwt.sign({ id, email: `${role}@ucu.ac.ug`, role, fullName: `Test ${role}` }, process.env.JWT_SECRET, { expiresIn: '1h' });

const studentToken  = makeToken('student');
const lecturerToken = makeToken('lecturer', 'lect-1');
const adminToken    = makeToken('admin', 'admin-1');

// ─── Health Check ─────────────────────────────────────────────────────────────
describe('GET /api/health', () => {
  test('returns 200 with status message', async () => {
    const res = await request(app).get('/api/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/SAMAS API is running/i);
  });
});

// ─── 404 Handler ──────────────────────────────────────────────────────────────
describe('Unknown Route', () => {
  test('returns 404 for undefined routes', async () => {
    const res = await request(app).get('/api/does-not-exist');
    expect(res.statusCode).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ─── Auth Routes ──────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  beforeEach(() => query.mockClear());

  test('returns 400 when body is empty', async () => {
    const res = await request(app).post('/api/auth/register').send({});
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('returns 409 when email already registered', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'existing' }] });
    const res = await request(app).post('/api/auth/register').send({
      email: 'taken@ucu.ac.ug', password: 'pass123', fullName: 'Taken', role: 'student',
    });
    expect(res.statusCode).toBe(409);
  });

  test('returns 201 with token on success', async () => {
    query
      .mockResolvedValueOnce({ rows: [] }) // email not taken
      .mockResolvedValueOnce({
        rows: [{ id: 'new-id', email: 'new@ucu.ac.ug', full_name: 'New User', role: 'student', department: 'CS', created_at: new Date() }],
      });

    const res = await request(app).post('/api/auth/register').send({
      email: 'new@ucu.ac.ug', password: 'StrongPass1!', fullName: 'New User', role: 'student',
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.data.token).toBeDefined();
  });
});

describe('POST /api/auth/login', () => {
  test('returns 400 when credentials missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'x@y.com' });
    expect(res.statusCode).toBe(400);
  });

  test('returns 401 for wrong password', async () => {
    const hash = await bcrypt.hash('correct', 10);
    query.mockResolvedValueOnce({
      rows: [{ id: '1', email: 'u@ucu.ac.ug', password_hash: hash, is_active: true, full_name: 'U', role: 'student' }],
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'u@ucu.ac.ug', password: 'wrong' });
    expect(res.statusCode).toBe(401);
  });

  test('returns 200 with token on correct credentials', async () => {
    const hash = await bcrypt.hash('correct', 10);
    query.mockResolvedValueOnce({
      rows: [{ id: '1', email: 'u@ucu.ac.ug', password_hash: hash, is_active: true, full_name: 'User', role: 'student', department: 'CS' }],
    });
    const res = await request(app).post('/api/auth/login').send({ email: 'u@ucu.ac.ug', password: 'correct' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.token).toBeDefined();
  });
});

// ─── Protected Routes — authentication guard ──────────────────────────────────
describe('Authentication guard on protected routes', () => {
  test('GET /api/courses returns 401 without token', async () => {
    const res = await request(app).get('/api/courses');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/courses returns 401 with malformed token', async () => {
    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', 'Bearer not.a.real.token');
    expect(res.statusCode).toBe(401);
  });
});

// ─── Courses — authenticated access ──────────────────────────────────────────
describe('GET /api/courses', () => {
  test('returns course list with valid token', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c1', title: 'SE101', code: 'SE101' }] });

    const res = await request(app)
      .get('/api/courses')
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});

// ─── RBAC — role enforcement ───────────────────────────────────────────────────
describe('RBAC enforcement', () => {
  test('student cannot create a course (403)', async () => {
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ code: 'X101', title: 'X', semester: 'Sem1', academicYear: '2024/25' });
    expect(res.statusCode).toBe(403);
  });

  test('lecturer can create a course (201)', async () => {
    query.mockResolvedValueOnce({ rows: [{ id: 'c2', code: 'X101', title: 'X' }] });
    const res = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${lecturerToken}`)
      .send({ code: 'X101', title: 'X', semester: 'Sem1', academicYear: '2024/25' });
    expect(res.statusCode).toBe(201);
  });
});

// ─── Analytics — role-specific data ──────────────────────────────────────────
describe('GET /api/analytics/dashboard', () => {
  test('returns admin stats for admin user', async () => {
    // Six parallel admin queries
    for (let i = 0; i < 6; i++) {
      query.mockResolvedValueOnce({ rows: [{ count: '10' }] });
    }
    const res = await request(app)
      .get('/api/analytics/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.totalUsers).toBeDefined();
  });
});

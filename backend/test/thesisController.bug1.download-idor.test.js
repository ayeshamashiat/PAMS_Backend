/**
 * Bug 1: downloadThesisPDF has no ownership/role-scoped check.
 * Any authenticated Student/Faculty/PGC/Admin can download any thesis PDF
 * by id, regardless of whether they own/supervise it.
 */

jest.mock('fs', () => ({
  existsSync: jest.fn(() => true),
  createReadStream: jest.fn(() => {
    const { EventEmitter } = require('events');
    const stream = new EventEmitter();
    stream.pipe = jest.fn((res) => {
      res.end();
      return res;
    });
    return stream;
  }),
}));

jest.mock('../models/thesis');
jest.mock('../models/student');
jest.mock('../models/user');
jest.mock('../models/studentCourse');
jest.mock('../models/thesisProposal');
jest.mock('../models/supervisorAssignment');
jest.mock('../models/thesisProgress');

const Thesis = require('../models/thesis');
const Student = require('../models/student');
const { downloadThesisPDF } = require('../controllers/thesisController');

function mockRes() {
  return {
    statusCode: 200,
    headers: {},
    status(code) { this.statusCode = code; return this; },
    setHeader(k, v) { this.headers[k] = v; },
    json(payload) { this.body = payload; return this; },
    end() { this.ended = true; },
    headersSent: false,
  };
}

const OWNER_STUDENT_ID = 'student-owner-id';
const SUPERVISOR_FACULTY_ID = 'faculty-supervisor-id';
const THESIS_ID = 'thesis-1';

test('a Student who does not own the thesis gets 403, not the file', async () => {
  jest.clearAllMocks();
  Thesis.findById.mockResolvedValue({
    _id: THESIS_ID,
    student_id: OWNER_STUDENT_ID,
    supervisor_id: SUPERVISOR_FACULTY_ID,
    attachment: 'thesis-1.pdf',
  });
  Student.findOne.mockResolvedValue({ _id: 'some-other-student-id' });

  const req = {
    params: { thesisId: THESIS_ID },
    user: { _id: 'other-student-user-id', role: 'Student' },
  };
  const res = mockRes();

  await downloadThesisPDF(req, res);

  expect(res.statusCode).toBe(403);
});

test('a Faculty member who does not supervise the thesis gets 403, not the file', async () => {
  jest.clearAllMocks();
  Thesis.findById.mockResolvedValue({
    _id: THESIS_ID,
    student_id: OWNER_STUDENT_ID,
    supervisor_id: SUPERVISOR_FACULTY_ID,
    attachment: 'thesis-1.pdf',
  });

  const req = {
    params: { thesisId: THESIS_ID },
    user: { _id: 'unrelated-faculty-user-id', role: 'Faculty', faculty_id: 'some-other-faculty-id' },
  };
  const res = mockRes();

  await downloadThesisPDF(req, res);

  expect(res.statusCode).toBe(403);
});

test('the owning student can download their own thesis', async () => {
  jest.clearAllMocks();
  Thesis.findById.mockResolvedValue({
    _id: THESIS_ID,
    student_id: OWNER_STUDENT_ID,
    supervisor_id: SUPERVISOR_FACULTY_ID,
    attachment: 'thesis-1.pdf',
  });
  Student.findOne.mockResolvedValue({ _id: OWNER_STUDENT_ID, user_id: 'owner-user-id' });

  const req = {
    params: { thesisId: THESIS_ID },
    user: { _id: 'owner-user-id', role: 'Student' },
  };
  const res = mockRes();

  await downloadThesisPDF(req, res);

  expect(res.statusCode).not.toBe(403);
});

test('an Admin can download any thesis', async () => {
  jest.clearAllMocks();
  Thesis.findById.mockResolvedValue({
    _id: THESIS_ID,
    student_id: OWNER_STUDENT_ID,
    supervisor_id: SUPERVISOR_FACULTY_ID,
    attachment: 'thesis-1.pdf',
  });

  const req = {
    params: { thesisId: THESIS_ID },
    user: { _id: 'admin-user-id', role: 'Admin' },
  };
  const res = mockRes();

  await downloadThesisPDF(req, res);

  expect(res.statusCode).not.toBe(403);
});

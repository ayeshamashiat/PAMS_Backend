/**
 * Bug 2: listTheses returns every thesis in the system to any Faculty
 * caller instead of scoping results to theses the caller supervises.
 */

jest.mock('../models/thesis');
jest.mock('../models/faculty');

const Thesis = require('../models/thesis');
const { listTheses } = require('../controllers/thesisController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const ALL_THESES = [
  { _id: 't1', student_id: 's1', supervisor_id: 'faculty-A', status: 'Submitted' },
  { _id: 't2', student_id: 's2', supervisor_id: 'faculty-B', status: 'Submitted' },
  { _id: 't3', student_id: 's3', supervisor_id: 'faculty-A', status: 'Approved' },
];

function mockThesisFindChain(returnValue) {
  const chain = {
    populate: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    exec: jest.fn(() => Promise.resolve(returnValue)),
  };
  return chain;
}

test('Faculty caller only sees theses they supervise, not all theses', async () => {
  jest.clearAllMocks();
  Thesis.find.mockImplementation((filter) => {
    const scoped = ALL_THESES.filter((t) =>
      filter && filter.supervisor_id
        ? t.supervisor_id === filter.supervisor_id
        : true
    );
    return mockThesisFindChain(scoped);
  });

  const req = {
    query: {},
    user: { _id: 'faculty-user-A', role: 'Faculty', faculty_id: 'faculty-A' },
  };
  const res = mockRes();

  await listTheses(req, res);

  expect(res.body.theses.every((t) => t.supervisor_id === 'faculty-A')).toBe(true);
  expect(res.body.theses.some((t) => t.supervisor_id === 'faculty-B')).toBe(false);
  expect(Thesis.find).toHaveBeenCalledWith(
    expect.objectContaining({ supervisor_id: 'faculty-A' })
  );
});

test('PGC caller sees all theses regardless of supervisor', async () => {
  jest.clearAllMocks();
  Thesis.find.mockImplementation(() => mockThesisFindChain(ALL_THESES));

  const req = { query: {}, user: { _id: 'pgc-user', role: 'PGC' } };
  const res = mockRes();

  await listTheses(req, res);

  expect(res.body.count).toBe(3);
});

test('Admin caller sees all theses regardless of supervisor', async () => {
  jest.clearAllMocks();
  Thesis.find.mockImplementation(() => mockThesisFindChain(ALL_THESES));

  const req = { query: {}, user: { _id: 'admin-user', role: 'Admin' } };
  const res = mockRes();

  await listTheses(req, res);

  expect(res.body.count).toBe(3);
});

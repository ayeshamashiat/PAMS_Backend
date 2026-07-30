/**
 * Bug 3: submitThesis (new submission and resubmission) assigns `timeline`
 * as a plain string ("timeline || ''"), but ThesisProposal.timeline is now
 * typed as `{ startDate: Date, endDate: Date }`.
 */

jest.mock('../models/student');
jest.mock('../models/thesisProposal');
jest.mock('../models/thesisProgress');
jest.mock('../models/thesis');
jest.mock('../models/supervisorAssignment');
jest.mock('../models/studentCourse');
jest.mock('../models/user');

const Student = require('../models/student');
const ThesisProposal = require('../models/thesisProposal');
const ThesisProgress = require('../models/thesisProgress');
const { submitThesis } = require('../controllers/thesisController');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

const ELIGIBLE_STUDENT = {
  _id: 'student-1',
  supervisor_id: 'faculty-1',
  obtained_credits: 12,
  cgpa: 3.0,
};

test('new proposal submission stores timeline as { startDate, endDate }, not a raw string', async () => {
  jest.clearAllMocks();
  ThesisProgress.findOne.mockResolvedValue({
    unlocked_stages: ['Enrolled', 'Supervisor Assignment'],
    save: jest.fn().mockResolvedValue(true),
  });
  Student.findOne.mockResolvedValue(ELIGIBLE_STUDENT);
  ThesisProposal.findOne.mockResolvedValue(null);

  let savedDoc;
  ThesisProposal.mockImplementation(function (data) {
    Object.assign(this, data);
    this.save = jest.fn().mockImplementation(() => {
      savedDoc = this;
      return Promise.resolve(this);
    });
  });

  const req = {
    user: { _id: 'user-1' },
    body: {
      research_topic: 'Topic',
      title: 'Title',
      background: 'Background',
      objective: 'Objective',
      methodology: 'Methodology',
      estimated_cost: '1000',
      timeline: '2026-01-01 to 2026-06-01',
      references: 'refs',
    },
    file: null,
  };
  const res = mockRes();

  await submitThesis(req, res);

  expect(savedDoc).toBeDefined();
  expect(typeof savedDoc.timeline).not.toBe('string');
  expect(savedDoc.timeline).toEqual(
    expect.objectContaining({ startDate: expect.anything(), endDate: expect.anything() })
  );
});

test('resubmission after rejection stores timeline as { startDate, endDate }, not a raw string', async () => {
  jest.clearAllMocks();
  ThesisProgress.findOne.mockResolvedValue({
    unlocked_stages: ['Enrolled', 'Supervisor Assignment'],
    save: jest.fn().mockResolvedValue(true),
  });
  Student.findOne.mockResolvedValue(ELIGIBLE_STUDENT);

  const existingProposal = {
    _id: 'proposal-1',
    status: 'Rejected',
    feedback: 'Needs more detail',
    feedbackHistory: [],
    timeline: undefined,
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
  };
  ThesisProposal.findOne.mockResolvedValue(existingProposal);

  const req = {
    user: { _id: 'user-1' },
    body: {
      research_topic: 'Topic',
      title: 'Title',
      background: 'Background',
      objective: 'Objective',
      methodology: 'Methodology',
      estimated_cost: '1000',
      timeline: { startDate: '2026-01-01', endDate: '2026-06-01' },
      references: 'refs',
    },
    file: null,
  };
  const res = mockRes();

  await submitThesis(req, res);

  expect(typeof existingProposal.timeline).not.toBe('string');
  expect(existingProposal.timeline).toEqual(
    expect.objectContaining({ startDate: expect.anything(), endDate: expect.anything() })
  );
});

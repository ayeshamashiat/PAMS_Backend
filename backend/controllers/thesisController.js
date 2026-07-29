const fs = require('fs');
const path = require('path');

const User = require('../models/user');
const Student = require('../models/student');
const StudentCourse = require('../models/studentCourse');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment');
const ThesisProgress = require('../models/thesisProgress');
const Thesis = require('../models/thesis');
const { computeUnlockedStages } = require('../services/progressService');
const { getThesisProgress } = require('./thesisProgressController');


const submitThesis = async (req, res) => {
  try {
    const {
      research_topic,
      title,
      background,
      objective,
      methodology,
      estimated_cost,
      timeline,
      references,
    } = req.body;

    // Get student data
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student profile not found" });
    }
    const thesisProposal = await ThesisProposal.findOne({ student_id: student._id });

    // Must have supervisor assigned
    if (!student.supervisor_id) {
      return res.status(400).json({ message: "You must have a supervisor assigned before submitting a proposal" });
    }

    if (!thesisProposal) {
      return res.status(400).json({
        message: "You must have your thesis proposal approved before submitting the thesis."
      });
    }

    // ✅ Eligibility: obtained_credits ≥ 9, cgpa ≥ 2.5, supervisor assigned
    const earnedCredits = Number(student.obtained_credits || 0);
    const cgpa = Number(student.cgpa || 0);
    const isEligible = earnedCredits >= 9 && cgpa >= 2.5 && !!student.supervisor_id;

    if (!isEligible) {
      return res.status(400).json({
        message: "You are not eligible to submit a thesis proposal. Please ensure you meet all requirements."
      });
    }

    // Existing proposal?
    const existingProposal = await ThesisProposal.findOne({ student_id: student._id });

    const canSubmit =
      !existingProposal ||
      ['Rejected', 'RevisionRequested', 'PGCRejected'].includes(existingProposal.status);

    if (!canSubmit) {
      return res.status(400).json({
        message: "You already have a proposal submitted or approved. You can only resubmit if it was rejected or revision was requested."
      });
    }

    // Handle file upload
    let attachmentPath = null;
    if (req.file) {
      attachmentPath = req.file.filename;
    }

    if (existingProposal && ['Rejected', 'RevisionRequested', 'PGCRejected'].includes(existingProposal.status)) {
      // Resubmission
      // Save previous feedback into history (if present) before clearing
      if (existingProposal.feedback) {
        if (!existingProposal.feedbackHistory) existingProposal.feedbackHistory = [];
        existingProposal.feedbackHistory.push({
          feedback: existingProposal.feedback,
          status: existingProposal.status,
          date: new Date()
        });
      }

      existingProposal.research_topic = research_topic;
      existingProposal.title = title;
      existingProposal.background = background;
      existingProposal.objective = objective;
      existingProposal.methodology = methodology;
      existingProposal.estimated_cost = estimated_cost || '';
      existingProposal.timeline = timeline || '';
      existingProposal.references = references || '';
      existingProposal.status = 'Submitted';
      existingProposal.feedback = ''; // clear latest feedback

      if (attachmentPath) {
        // Replace old file if any
        if (existingProposal.attachment) {
          const oldFilePath = path.join(process.cwd(), 'uploads', existingProposal.attachment);
          if (fs.existsSync(oldFilePath)) {
            fs.unlinkSync(oldFilePath);
          }
        }
        existingProposal.attachment = attachmentPath;
      }

      await existingProposal.save();

      return res.status(200).json({
        message: "Thesis proposal resubmitted successfully",
        proposal: existingProposal,
      });
    } else {
      // New submission
      const newProposal = new ThesisProposal({
        student_id: student._id,
        supervisor_id: student.supervisor_id,
        research_topic,
        title,
        background,
        objective,
        methodology,
        estimated_cost: estimated_cost || '',
        timeline: timeline || '',
        references: references || '',
        attachment: attachmentPath,
        status: 'Submitted',
        feedbackHistory: []
      });

      await newProposal.save();

      // Update thesis progress
      let progress = await ThesisProgress.findOne({ student: student._id });
      if (!progress) {
        progress = new ThesisProgress({
          student: student._id,
          current_stage: 'Proposal',
          unlocked_stages: ['Enrolled', 'Supervisor Assignment', 'Proposal'],
        });
      }

      if (!progress.unlocked_stages.includes('Proposal')) {
        progress.unlocked_stages.push('Proposal');
      }
      progress.current_stage = 'Proposal';

      await progress.save();

      return res.status(201).json({
        message: "Thesis proposal submitted successfully",
        proposal: newProposal,
      });
    }

  } catch (error) {
    console.error("Error submitting thesis proposal:", error);
    res.status(500).json({
      message: "Server error",
      error: error.message
    });
  }
};

/**
 * POST /api/thesis/upload
 * multipart/form-data with 'attachment' (pdf)
 * Only allowed after proposal is approved (Approved or PGCApproved)
 */
const uploadThesis = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    // require supervisor
    if (!student.supervisor_id) {
      return res.status(400).json({ message: 'You must have a supervisor assigned before uploading thesis' });
    }

    const proposal = await ThesisProposal.findOne({ student_id: student._id });
    if (!proposal || !['Approved', 'PGCApproved'].includes(proposal.status)) {
      return res.status(400).json({ message: 'Thesis upload is only allowed after your proposal is approved' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded. Please attach a PDF.' });
    }

    const filename = req.file.filename;

    // If thesis exists and was rejected allow resubmission, else prevent duplicate
    let thesis = await Thesis.findOne({ student_id: student._id });
    if (thesis && !['Rejected'].includes(thesis.status)) {
      return res.status(400).json({ message: 'You already have a submitted thesis. Contact admin to make changes.' });
    }

    if (thesis && thesis.attachment) {
      const oldFile = path.join(process.cwd(), 'uploads', thesis.attachment);
      if (fs.existsSync(oldFile)) {
        try { fs.unlinkSync(oldFile); } catch (e) { console.warn('Failed to remove old thesis file', e.message); }
      }
      thesis.attachment = filename;
      thesis.status = 'Submitted';
      thesis.submitted_at = new Date();
      await thesis.save();
    } else {
      thesis = new Thesis({
        student_id: student._id,
        supervisor_id: student.supervisor_id,
        title: proposal.title || req.body.title || 'Thesis',
        abstract: req.body.abstract || '',
        attachment: filename,
        status: 'Submitted'
      });
      await thesis.save();
    }

    // Update progress: unlock 'Thesis' stage
    let progress = await ThesisProgress.findOne({ student: student._id });
    if (!progress) {
      progress = new ThesisProgress({
        student: student._id,
        current_stage: 'Thesis',
        unlocked_stages: ['Enrolled', 'Supervisor Assignment', 'Proposal', 'Thesis']
      });
      await progress.save();
    } else {
      // use model method to safely unlock
      await progress.unlockStage('Thesis');
    }

    return res.status(201).json({ message: 'Thesis uploaded successfully', thesis });
  } catch (error) {
    console.error('Error uploading thesis:', error);
    return res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/thesis/my-thesis
 */
const getMyThesis = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) return res.status(404).json({ message: 'Student profile not found' });

    const thesis = await Thesis.findOne({ student_id: student._id })
      .populate({ path: 'supervisor_id', populate: { path: 'user_id', select: 'first_name last_name' } });

    if (!thesis) return res.status(404).json({ message: 'No thesis found for this student' });

    res.json({ thesis });
  } catch (error) {
    console.error('Error fetching thesis:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/thesis/download/:thesisId
 */
const downloadThesisPDF = async (req, res) => {
  try {
    const { thesisId } = req.params;
    const thesis = await Thesis.findById(thesisId);
    if (!thesis) return res.status(404).json({ message: 'Thesis not found' });

    if (!thesis.attachment) return res.status(404).json({ message: 'No PDF attachment found' });

    const filePath = path.join(process.cwd(), 'uploads', thesis.attachment);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'PDF not found on server' });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="thesis-${thesisId}.pdf"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', (err) => {
      console.error('Error streaming thesis file:', err);
      if (!res.headersSent) res.status(500).json({ message: 'Error downloading file' });
    });
  } catch (error) {
    console.error('Error downloading thesis:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/thesis/
 * List theses (PGC/Faculty/Admin). Optional query: ?status=Accepted&studentId=...
 */
const listTheses = async (req, res) => {
  try {
    const { status, studentId } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (studentId) filter.student_id = studentId;

    const theses = await Thesis.find(filter)
      .populate({ path: 'student_id', populate: { path: 'user_id', select: 'first_name last_name email' } })
      .populate({ path: 'supervisor_id', populate: { path: 'user_id', select: 'first_name last_name' } })
      .sort({ submitted_at: -1 })
      .exec();

    res.json({ count: theses.length, theses });
  } catch (error) {
    console.error('Error listing theses:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  submitThesis,
  uploadThesis,
  getMyThesis,
  downloadThesisPDF,
  listTheses,
};
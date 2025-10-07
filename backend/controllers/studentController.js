// controllers/studentController.js
const fs = require('fs');
const path = require('path');

const User = require('../models/user');
const Student = require('../models/student');
const StudentCourse = require('../models/studentCourse');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment');
const ThesisProgress = require('../models/thesisProgress');
const { computeUnlockedStages } = require('../services/progressService');
const { getThesisProgress } = require('./thesisProgressController');

/**
 * GET /api/students/profile
 */
const getStudentProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).lean({virtuals: true});
    if (!user || user.role !== 'Student') {
      return res.status(404).json({ message: 'Student not found' });
    }

    const student = await Student.findOne({ user_id: user._id });
    if (!student) return res.status(404).json({ message: 'Student details not found' });

    res.json({
      fullName: `${user.first_name} ${user.last_name}`,
      studentId: student.student_number,
      email: user.email,
      department: user.department,
      program: student.program_id,
      currentAcademicYear: student.admission_year
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/students/progress
 * Returns studentInfo + eligibility (requires: obtained_credits ≥ 9, cgpa ≥ 2.5, supervisor assigned)
 */
const getStudentProgress = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id })
      .populate('supervisor_id');

    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    // ✅ Use correct schema fields & thresholds
    const earnedCredits = Number(student.obtained_credits || 0);
    const cgpa = Number(student.cgpa || 0);

    const hasMinCGPA = cgpa >= 2.5;            // ≥ 2.5
    const hasMinCredits = earnedCredits >= 9;  // ≥ 9
    const hasSupervisor = !!student.supervisor_id;

    // ✅ Eligibility requires ALL THREE
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;

    // Current proposal & progress
    const currentProposal = await ThesisProposal.findOne({ student_id: student._id });
    const progress = await ThesisProgress.findOne({ student: student._id });

    const studentInfo = {
      cgpa,
      obtained_credits: earnedCredits,
      hasSupervisor,
      supervisorName: hasSupervisor
        ? `${student.supervisor_id?.user_id?.first_name || ''} ${student.supervisor_id?.user_id?.last_name || ''}`.trim()
        : null
    };

    let message = '';
    if (!isEligible) {
      const reasons = [];
      if (!hasMinCGPA) reasons.push('CGPA below 2.5');
      if (!hasMinCredits) reasons.push('Insufficient credits (< 9)');
      if (!hasSupervisor) reasons.push('No supervisor assigned');
      message = `Not eligible: ${reasons.join(', ')}`;
    }

    res.json({
      isEligible,
      studentInfo,
      message,
      progress: progress ? {
        current_stage: progress.current_stage,
        unlocked_stages: progress.unlocked_stages
      } : null,
      proposal: currentProposal ? {
        status: currentProposal.status,
        hasProposal: true
      } : { hasProposal: false }
    });

  } catch (error) {
    console.error('Error fetching student progress:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/students/courses
 */
const getStudentCourses = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id })
      .populate('program_id')
      .exec();

    if (!student) return res.status(404).json({ error: 'Student not found' });

    const enrolledCourses = await StudentCourse.find({ student_id: student._id })
      .populate('course_id')
      .exec();

    if (!enrolledCourses.length) {
      return res.status(404).json({ message: 'No courses found for this student' });
    }

    const courseList = enrolledCourses.map(sc => ({
      _id: sc.course_id._id,
      course_code: sc.course_id.course_code,
      course_name: sc.course_id.course_name,
      credit: sc.course_id.credit,
      status: sc.course_id.status,
      semester: sc.semester,
      academic_year: sc.academic_year,
      grade: sc.grade || null,
      obtained_credit: sc.obtained_credit || 0
    }));

    const totalEarnedCredits = enrolledCourses.reduce(
      (sum, c) => sum + (c.obtained_credit || 0),
      0
    );

    res.status(200).json({
      student: {
        _id: student._id,
        student_number: student.student_number,
        program_id: student.program_id,
        current_semester: student.current_semester,
        cgpa: student.cgpa
      },
      total_courses: enrolledCourses.length,
      totalEarnedCredits,
      enrolledCourses: courseList
    });
  } catch (error) {
    console.error('Error fetching student courses:', error.message);
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/students/:id
 */
const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id)
      .populate('user_id')
      .populate('department')
      .populate('program_id');
  if (!student) return res.status(404).json({ error: 'Student not found' });
    res.json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * GET /api/students/my-proposal
 */
const getMyProposal = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const proposal = await ThesisProposal.findOne({ student_id: student._id })
      .populate({
        path: 'supervisor_id',
        populate: { path: 'user_id', select: 'first_name last_name' }
      });

    if (!proposal) {
      return res.status(404).json({ message: 'No thesis proposal found' });
    }

    res.json({ proposal });
  } catch (error) {
    console.error('Error fetching student proposal:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * GET /api/students/proposal-pdf/:proposalId
 */
const downloadProposalPDF = async (req, res) => {
  try {
    const { proposalId } = req.params;

    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: 'Student profile not found' });
    }

    const proposal = await ThesisProposal.findOne({
      _id: proposalId,
      student_id: student._id
    });

    if (!proposal) {
      return res.status(404).json({ message: 'Proposal not found or unauthorized' });
    }

    if (!proposal.attachment) {
      return res.status(404).json({ message: 'No PDF attachment found' });
    }

    const filePath = path.join(process.cwd(), 'uploads', proposal.attachment);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'PDF file not found on server' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="thesis-proposal-${proposalId}.pdf"`);

    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);

    fileStream.on('error', (error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Error downloading file' });
      }
    });

  } catch (error) {
    console.error('Error downloading proposal PDF:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * POST /api/students/submit/check
 * (multipart with 'attachment') — requires supervisor + eligibility (credits/cgpa).
 */
const submitThesisProposal = async (req, res) => {
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

    // Must have supervisor assigned
    if (!student.supervisor_id) {
      return res.status(400).json({ message: "You must have a supervisor assigned before submitting a proposal" });
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
 * GET /api/students/result
 */
const getResult = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });

    if (!student) {
      return res.status(404).json({ message: 'Student not found' });
    }

    res.json({
      student_id: student._id,
      user_id: student.user_id,
      cgpa: student.cgpa,
      obtained_credits: student.obtained_credits,
      current_semester: student.current_semester,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
};

/**
 * GET /api/students/supervisor-assignment/check-eligibility
 * Only checks credits for *requesting* a supervisor (separate from proposal eligibility).
 */
const checkSupervisorEligibility = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ isEligible: false, message: 'Student not found' });
    }
    const isEligible = (Number(student.obtained_credits || 0) >= 9);
    res.status(200).json({
      isEligible,
      message: isEligible
        ? 'Eligible for supervisor assignment.'
        : 'Not eligible for supervisor assignment (need ≥ 9 credits).',
    });
  } catch (err) {
    res.status(500).json({ isEligible: false, message: 'Server error' });
  }
};

/**
 * GET /api/students/assignment/check-status
 */
const checkAssignmentStatus = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student not found." });
    }

    const assignment = await SupervisorAssignment.findOne({ student_id: student._id })
      .populate({
        path: "student_id",
        populate: [
          { path: "user_id", select: "first_name last_name email department" },
          { path: "program_id", select: "degree_type program_name" }
        ]
      })
      .populate({
        path: "priority_list.faculty_id",
        populate: { path: "user_id", select: "first_name last_name email department" },
        select: "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity"
      })
      .populate({
        path: "accepted_faculty",
        populate: { path: "user_id", select: "first_name last_name email department" },
        select: "employee_id designation specialization research_interests current_supervision_count max_supervision_capacity"
      });

    if (!assignment) {
      return res.status(404).json({ message: "No supervisor assignment found for this student." });
    }

    res.json({ assignment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getStudentProfile,
  getStudentProgress,
  getStudentCourses,
  getStudentById,
  submitThesisProposal,
  getResult,
  checkSupervisorEligibility,
  checkAssignmentStatus,
  getThesisProgress,
  getMyProposal,
  downloadProposalPDF
};

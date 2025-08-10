const Faculty = require('../models/faculty');
const Student = require('../models/student');
const SupervisorAssignment = require('../models/supervisorAssignment');
const { sendNotification } = require('../utils/notification');
const jwt = require('jsonwebtoken');

const getUserIdFromToken = (token) => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.id; 
  } catch (err) {
    console.error("Invalid or expired token:", err.message);
    return null;
  }
};

// Step 1: Create assignment request
const createAssignmentRequest = async (req, res) => {
  try {
    const { priorityFacultyIds } = req.body; // array of faculty IDs

    if (!priorityFacultyIds || priorityFacultyIds.length === 0 || priorityFacultyIds.length > 3) {
      return res.status(400).json({ message: 'Provide 1 to 3 faculty IDs.' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const userId = getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ message: 'Unauthorized' });
    }


    const student = await Student.findOne({ user_id: userId });
    if (!student) return res.status(404).json({ message: 'Student not found' });

    const studentId = student._id;

    const existing = await SupervisorAssignment.findOne({ student_id: studentId });
    if (existing) return res.status(409).json({ message: 'Assignment already exists.' });

    const priority_list = priorityFacultyIds.map(fid => ({
      faculty_id: fid,
      status: 'NotAssigned'
    }));

    priority_list[0].status = 'Requested';

    const assignment = new SupervisorAssignment({
      student_id: studentId,
      priority_list,
      current_priority_index: 0,
      overall_status: 'Pending'
    });

    await assignment.save();
    sendNotification(priorityFacultyIds[0], 'You have a new supervision request.');

    res.status(201).json({ message: 'Supervisor assignment request created.', assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Step 2: Supervisor responds (accept/reject)
const supervisorRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Accepted' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);

    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    assignment.supervisor_response = response;
    assignment.status = (response === 'Accepted') ? 'SupervisorAccepted' : 'SupervisorRejected';
    await assignment.save();

    if (response === 'Accepted') {
      // Notify PGC for approval
      sendNotification('PGC_USER_ID', 'Supervisor accepted. Awaiting your approval.');
    } else {
      // Move to next supervisor in priority list
      assignment.current_priority_index += 1;
      assignment.supervisor_response = 'Pending';
      assignment.status = 'Pending';
      if (assignment.current_priority_index < assignment.supervisor_priority_list.length) {
        await assignment.save();
        // Notify next supervisor
        const nextSupervisor = await Faculty.findById(assignment.supervisor_priority_list[assignment.current_priority_index]);
        sendNotification(nextSupervisor.user_id, 'You have a new supervision request.');
      } else {
        assignment.status = 'Failed';
        await assignment.save();
        sendNotification(assignment.student_id, 'All supervisor requests rejected.');
      }
    }
    await assignment.save();
    res.json({ message: 'Supervisor response recorded.', assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Step 3: PGC responds (approve/reject)
const pgcRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Approved' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);

    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    assignment.pgc_response = response;
    assignment.status = (response === 'Approved') ? 'PGCApproved' : 'PGCRejected';
    await assignment.save();

    if (response === 'Approved') {
      // Assign supervisor to student
      const supervisorId = assignment.supervisor_priority_list[assignment.current_priority_index];
      await Student.findByIdAndUpdate(assignment.student_id, { supervisor_id: supervisorId });
      await Faculty.findByIdAndUpdate(supervisorId, { $inc: { current_supervision_count: 1 } });
      assignment.status = 'Assigned';
      await assignment.save();
      sendNotification(assignment.student_id, 'Supervisor assigned successfully.');
      sendNotification(supervisorId, 'You have been assigned a new student.');
    } else {
      // Move to next supervisor
      assignment.current_priority_index += 1;
      assignment.supervisor_response = 'Pending';
      assignment.pgc_response = 'Pending';
      assignment.status = 'Pending';
      if (assignment.current_priority_index < assignment.supervisor_priority_list.length) {
        await assignment.save();
        // Notify next supervisor
        const nextSupervisor = await Faculty.findById(assignment.supervisor_priority_list[assignment.current_priority_index]);
        sendNotification(nextSupervisor.user_id, 'You have a new supervision request.');
      } else {
        assignment.status = 'Failed';
        await assignment.save();
        sendNotification(assignment.student_id, 'All supervisor requests rejected by PGC.');
      }
    }
    await assignment.save();
    res.json({ message: 'PGC response recorded.', assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get available supervisors based on priority list
const getAvailableSupervisors = async (req, res) => {
  try {
    const availableSupervisors = await Faculty.find({
      $expr: { $gt: ["$max_supervision_capacity", "$current_supervision_count"] }
    });
    res.json({ availableSupervisors });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createAssignmentRequest,
  getAvailableSupervisors,
  supervisorRespond,
  pgcRespond
};

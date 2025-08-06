const Faculty = require('../models/faculty');
const Student = require('../models/student');
const SupervisorAssignment = require('../models/supervisorAssignment');
const { sendNotification } = require('../utils/notification');

// Step 1: Get available supervisors and create a priority list
const createAssignmentRequest = async (req, res) => {
  try {
    const { studentId, prioritySupervisorIds } = req.body;

    //validate that supervisors are available
    const availableSupervisors = await Faculty.find({
      _id: { $in: prioritySupervisorIds },
      $expr: { $gt: ["$max_supervision_capacity", "$current_supervision_count"] }
    });

    if (availableSupervisors.length === 0) {
      return res.status(400).json({ message: 'No available supervisors in the provided list.' });
    }

    // Create assignment request
    const assignment = await SupervisorAssignment.create({
      student_id: studentId,
      supervisor_priority_list: availableSupervisors.map(s => s._id),
      current_priority_index: 0
    });

    // Send request to top-priority supervisor
    sendNotification(availableSupervisors[0].user_id, 'You have a new supervision request.');

    res.status(201).json({ message: 'Assignment request created.', assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  supervisorRespond
};

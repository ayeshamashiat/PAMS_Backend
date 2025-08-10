const SupervisorAssignment = require('../models/supervisorAssignment');
const { sendNotification } = require('../utils/notification');

const pgcRespond = async (req, res) => {
  try {
    const { assignmentId, response } = req.body; // response: 'Accepted' or 'Rejected'
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    const idx = assignment.current_priority_index;
    if (assignment.priority_list[idx].status !== 'Accepted') {
      return res.status(400).json({ message: 'Supervisor has not accepted yet.' });
    }

    if (response === 'Accepted') {
      assignment.priority_list[idx].status = 'PGCAccepted';
      assignment.overall_status = 'Assigned';
      sendNotification(assignment.student_id, 'Supervisor assigned!');
    } else {
      assignment.priority_list[idx].status = 'PGCRejected';
      assignment.current_priority_index += 1;
      assignment.accepted_faculty = null;
      if (assignment.current_priority_index < assignment.priority_list.length) {
        assignment.priority_list[assignment.current_priority_index].status = 'Requested';
        sendNotification(assignment.priority_list[assignment.current_priority_index].faculty_id, 'You have a new supervision request.');
      } else {
        assignment.overall_status = 'Failed';
        sendNotification(assignment.student_id, 'PGC rejected all supervisors. Will assign manually.');
      }
    }
    await assignment.save();
    res.json({ message: 'PGC response recorded.', assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const pgcManualAssign = async (req, res) => {
  try {
    const { assignmentId, facultyId } = req.body;
    const assignment = await SupervisorAssignment.findById(assignmentId);
    if (!assignment) return res.status(404).json({ message: 'Assignment not found.' });

    assignment.accepted_faculty = facultyId;
    assignment.overall_status = 'Assigned';
    await assignment.save();
    sendNotification(assignment.student_id, 'Supervisor assigned by PGC.');
    res.json({ message: 'Supervisor manually assigned by PGC.', assignment });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


module.exports = {
    pgcRespond,
    pgcManualAssign
}
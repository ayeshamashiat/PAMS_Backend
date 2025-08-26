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
};

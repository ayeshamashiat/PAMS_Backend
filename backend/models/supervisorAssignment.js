const mongoose = require('mongoose');

const supervisorAssignmentSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  supervisor_priority_list: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }],
  current_priority_index: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Pending', 'SupervisorAccepted', 'SupervisorRejected', 'PGCApproved', 'PGCRejected', 'Assigned', 'Failed'],
    default: 'Pending'
  },
  supervisor_response: { type: String, enum: ['Accepted', 'Rejected', 'Pending'], default: 'Pending' },
  pgc_response: { type: String, enum: ['Approved', 'Rejected', 'Pending'], default: 'Pending' }
}, { timestamps: true });

module.exports = mongoose.model('SupervisorAssignment', supervisorAssignmentSchema);
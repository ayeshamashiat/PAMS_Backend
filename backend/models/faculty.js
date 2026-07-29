const mongoose = require('mongoose');
const supervisorAssignment = require('./supervisorAssignment');

const facultySchema = new mongoose.Schema({
  user_id:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employee_id:            { type: String, required: true, unique: true },
  designation:            { type: String },
  specialization:         { type: String },
  research_interests:     { type: String },
  max_supervision_capacity: { type: Number, default: 5 },
  current_supervision_count: { type: Number, default: 0 }
});

module.exports = mongoose.model('Faculty', facultySchema);
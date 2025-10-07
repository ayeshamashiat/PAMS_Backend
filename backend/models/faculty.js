const mongoose = require('mongoose');

const facultySchema = new mongoose.Schema({
  user_id:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employee_id:            { type: String, required: true, unique: true },
  department_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  designation:            { type: String },
  specialization:         { type: String },
  research_interests:     { type: String },
  max_supervision_capacity: { type: Number, default: 5 },
  current_supervision_count: { type: Number, default: 0 }
});

module.exports = mongoose.model('Faculty', facultySchema);
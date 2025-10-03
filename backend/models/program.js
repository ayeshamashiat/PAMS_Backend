const mongoose = require('mongoose');

const programSchema = new mongoose.Schema({
  program_name:            { type: String, required: true },
  program_code:            { type: String, required: true, unique: true },
  department_id:           { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  degree_type: {
    type: String,
    enum: ['MSc', 'MEngg', 'PhD', 'MScTE'], 
    required: true
  },
  duration_years:           { type: Number, required: true },
  total_credit_hours:       { type: Number, required: true },
  thesis_credit_hours:      { type: Number, default: 0 },
  coursework_credit_hours:  { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Active', 'Inactive'], 
    default: 'Active'
  }
});

module.exports = mongoose.model('Program', programSchema);

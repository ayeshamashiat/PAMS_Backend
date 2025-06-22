const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user_id:                { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  student_number:         { type: String, required: true, unique: true },
  program_id:             { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  admission_year:         { type: Number },
  current_semester:       { type: Number, default: 1 },
  cgpa:                   { type: Number, default: 0.0 },
  total_credit_hours:     { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Applied', 'Admitted', 'Enrolled', 'Graduated', 'Dropped'], 
    default: 'Applied'
  },
  supervisor_id:          { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
  admission_date:         { type: Date },
  expected_graduation:    { type: Date }
});

module.exports = mongoose.model('Student', studentSchema);

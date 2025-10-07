const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  student_number: { type: String, required: true, unique: true },
  program_id: { type: String,
    enum: ['M.Sc. CSE', 'M.Sc. CE', 'M.Sc. ME', 'M.Sc. EEE', 'M.Sc. TE', 'M.Engg. CSE', 'M.Engg. ME', 'M.Engg. EEE', 'M.Engg. CE', 'PhD CSE', 'PhD ME', 'PhD CE', 'PhD EEE', 'PhD TE'], 
    required: true 
  },
  admission_year: { type: Number, required: true },
  current_semester: { type: Number, default: 1 },
  cgpa: { type: Number, default: 0.0 },
  total_credit_hours: { type: Number, default: 0 }, // all attempted credits
  obtained_credits: { type: Number, default: 0 },   // ✅ completed credits
  supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null }, // Added this field
  status: {
    type: String,
    enum: ['Applied', 'Admitted', 'Enrolled', 'Graduated', 'Dropped'],
    default: 'Applied'
  },
  admission_date: { type: Date, default: Date.now },
  expected_graduation: { type: Date }
});

studentSchema.virtual('semester_season').get(function () {
  return this.current_semester % 2 === 1 ? 'Summer' : 'Winter';
});


module.exports = mongoose.model('Student', studentSchema);
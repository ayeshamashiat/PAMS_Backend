const mongoose = require('mongoose');

const studentSchema = new mongoose.Schema({
  user_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true, 
    unique: true 
  },
  first_name: { type: String, required: true }, 
  last_name: { type: String, required: true },
  department: { type: String, required: true }, 
  program: { type: String, required: true },    
  admission_year: { type: Number, required: true },

  current_semester: { type: Number, default: 1 },
  cgpa: { type: Number, default: 0.0 },
  total_credit_hours: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['Applied', 'Admitted', 'Enrolled', 'Graduated', 'Dropped'], 
    default: 'Applied'
  },

  supervisor_id: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Faculty',
    default: null
  },

  admission_date: { type: Date, default: Date.now },
  expected_graduation: { type: Date }
});

module.exports = mongoose.model('Student', studentSchema);

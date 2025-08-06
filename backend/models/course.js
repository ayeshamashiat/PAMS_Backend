const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  course_code:    { type: String, required: true, unique: true },
  course_name:    { type: String, required: true },
  credit:         { type: Number, required: true },
  semester:       { type: String, required: true }, // e.g., 'Summer', 'Winter'
  academic_year:  { type: String, required: true }, // e.g., '2023-2024'
  program_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Program' }, // optional, if courses are program-specific
  status:         { type: String, enum: ['Active', 'Inactive'], default: 'Active' }
});

module.exports = mongoose.model('Course', courseSchema);
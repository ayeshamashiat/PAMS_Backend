const mongoose = require('mongoose');

const studentCourseSchema = new mongoose.Schema({
  student_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  course_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  obtained_credit: { type: Number, required: true },
  grade:         { type: String }, // e.g., 'A', 'B+', etc.
  semester:      { type: String }, // optional, for redundancy
  academic_year: { type: String }  // optional, for redundancy
});

module.exports = mongoose.model('StudentCourse', studentCourseSchema);
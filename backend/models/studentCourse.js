const mongoose = require('mongoose');

const studentCourseSchema = new mongoose.Schema({
  student_id:    { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  course_id:     { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
  obtained_credit: { type: Number, default: 0.0},
  grade:         { type: String }, 
  semester:      { type: String }, 
  academic_year: { type: String }, 
});

studentCourseSchema.index(
  { student_id: 1, course_id: 1 },
  { unique: true }
);

module.exports = mongoose.model('StudentCourse', studentCourseSchema);
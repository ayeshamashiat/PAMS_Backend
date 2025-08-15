const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  course_code:    { type: String, required: true, unique: true },
  course_name:    { type: String, required: true },
  credit:         { type: Number, required: true },
  semester:       { type: String, required: true }, 
  academic_year:  { type: String, required: true }, 
});

module.exports = mongoose.model('Course', courseSchema);
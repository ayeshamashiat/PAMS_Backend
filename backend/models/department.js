const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema({
  department_name:       { type: String, required: true },
  department_code:       { type: String, required: true, unique: true },
  head_of_department:    { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' }
});

module.exports = mongoose.model('Department', departmentSchema);

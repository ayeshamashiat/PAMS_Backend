const mongoose = require('mongoose');

const adminStaffSchema = new mongoose.Schema({
  user_id:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  employee_id:   { type: String, required: true, unique: true },
  department:    { type: String },
  position:      { type: String }
});

module.exports = mongoose.model('AdminStaff', adminStaffSchema);

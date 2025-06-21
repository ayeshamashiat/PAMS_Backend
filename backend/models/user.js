const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username:      { type: String, required: true, unique: true },
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true }, 
  first_name:    { type: String, required: true },
  last_name:     { type: String, required: true },
  phone:         { type: String },
  address:       { type: String },
  date_of_birth: { type: Date },
  role: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin', 'PGC', 'CASR'], 
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended'], 
    default: 'Active'
  },

  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);

const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  email:      { type: String, required: true, unique: true },
  password_hash: { type: String, required: true }, 
  first_name:    { type: String, required: true },
  last_name:     { type: String, required: true },
  department:    { type: String, 
    enum: ['CSE', 'EEE', 'MPE', 'CEE', 'TVE'],
    required: true 
  }, 
  role: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin', 'PGC', 'CASR'], 
    required: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

module.exports = mongoose.model('User', userSchema);

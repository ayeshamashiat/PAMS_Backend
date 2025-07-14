const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  user_id:    { type: String, required: true, unique: true },
  email:         { type: String, required: true, unique: true },
  password_hash: { type: String, required: true }, 
  first_name:    { type: String, required: true },
  last_name:     { type: String, required: true },
  program:       { type: String, required: true },
  department:    { type: String, required: true },
  role: {
    type: String,
    enum: ['Student', 'Faculty', 'Admin', 'PGC', 'CASR'], 
    required: true
  },
  resetPasswordToken: String,
  resetPasswordExpires: Date
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });


module.exports = mongoose.model('User', userSchema);

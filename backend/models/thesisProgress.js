const mongoose = require('mongoose');

const thesisProgressSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  current_stage: {
    type: String,
    enum: ['Enrolled', 'Supervisor Assignment', 'Proposal', 'Thesis', 'Predefense', 'Defense'],
    default: 'Enrolled'
  },
  unlocked_stages: [{ type: String }],
  is_active: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('ThesisProgress', thesisProgressSchema);

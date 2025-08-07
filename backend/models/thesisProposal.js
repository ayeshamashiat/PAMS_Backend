const mongoose = require('mongoose');

const thesisProposalSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
  supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
  title: { type: String, required: true },
  background: { type: String, required: true },
  objective: { type: String, required: true },
  methodology: { type: String, required: true },
  estimated_cost: { type: String },
  timeline: { type: String },
  references: { type: String },
  attachment: { type: String }, // file path or URL to PDF
  status: { type: String, enum: ['Submitted', 'Under Review', 'Approved', 'RevisionRequested', 'Rejected'], default: 'Submitted' },
  feedback: { type: String }
}, { timestamps: true });

module.exports = mongoose.model('ThesisProposal', thesisProposalSchema);
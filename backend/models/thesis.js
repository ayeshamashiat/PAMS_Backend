const mongoose = require('mongoose');

const THESIS_STATUS = ['Submitted', 'Under Review', 'Accepted', 'Rejected'];

const thesisSchema = new mongoose.Schema(
  {
    student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true },
    supervisor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty' },
    title: { type: String, required: true },
    abstract: { type: String },
    attachment: { type: String }, // filename in uploads/
    status: { type: String, enum: THESIS_STATUS, default: 'Submitted' },
    submitted_at: { type: Date, default: Date.now },
    feedback: { type: String }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Thesis', thesisSchema);

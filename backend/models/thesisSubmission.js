// models/thesisSubmission.js
const mongoose = require("mongoose");

const thesisSubmissionSchema = new mongoose.Schema(
  {
    student_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    supervisor_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Faculty",
      required: true,
    },

    title: { type: String, required: true },
    abstract: { type: String, default: "" },

    attachment: { type: String }, // e.g. "/uploads/thesis/<file.pdf>"

    status: {
      type: String,
      enum: [
        "Submitted",
        "Under Review",
        "Approved",
        "RevisionRequested",
        "SupervisorAccepted",
        "Supervisorrejected",
        "Rejected",
        "PGCApproved",
        "PGCRejected",
      ],
      default: "Submitted",
    },

    feedback: { type: String }, // latest
    feedbackHistory: [
      {
        feedback: String,
        status: String, // Approved | Rejected | Comment | RevisionRequested
        date: { type: Date, default: Date.now },
        reviewedBy: String, // 'supervisor' | 'pgc'
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("ThesisSubmission", thesisSubmissionSchema);

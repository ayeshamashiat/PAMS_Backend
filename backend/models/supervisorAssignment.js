const mongoose = require('mongoose');

const supervisorAssignmentSchema = new mongoose.Schema({
  student_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Student', required: true, unique: true },
  priority_list: [
    {
      faculty_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', required: true },
      status: {
        type: String,
        enum: ['NotAssigned', 'Requested', 'Rejected', 'SupervisorAccepted', 'SupervisorRejected', 'PGCRejected', 'PGCAccepted'],
        default: 'NotAssigned'
      }
    }
  ],
  current_priority_index: { type: Number, default: 0 },
  overall_status: {
    type: String,
    enum: ["Requested", "Pending", "Approved", "Rejected", "PGCReview", "Assigned", "Failed"],
    default: "Requested",
  },

  accepted_faculty: { type: mongoose.Schema.Types.ObjectId, ref: 'Faculty', default: null }, // ✅ cache
}, { timestamps: true });

// Middleware to update faculty's current_supervision_count
async function updateFacultySupervisionCount(facultyId) {
  if (!facultyId) return;

  const Faculty = mongoose.model('Faculty');
  const count = await mongoose.model('SupervisorAssignment').countDocuments({
    accepted_faculty: facultyId,
    overall_status: 'Assigned'
  });

  await Faculty.findByIdAndUpdate(facultyId, { current_supervision_count: count });
}

// Pre-save hook to update supervision count before saving
supervisorAssignmentSchema.pre('save', async function (next) {
  const previousDoc = await this.constructor.findById(this._id);
  const oldFacultyId = previousDoc ? previousDoc.accepted_faculty : null;
  const newFacultyId = this.accepted_faculty;

  // If accepted_faculty or overall_status changes
  if (this.isModified('accepted_faculty') || this.isModified('overall_status')) {
    // Update old faculty count if it exists and is different
    if (oldFacultyId && (!newFacultyId || oldFacultyId.toString() !== newFacultyId.toString())) {
      await updateFacultySupervisionCount(oldFacultyId);
    }
    // Update new faculty count if it exists
    if (newFacultyId && this.overall_status === 'Assigned') {
      await updateFacultySupervisionCount(newFacultyId);
    }
  }
  next();
});

// Post-remove hook to update supervision count after deletion
supervisorAssignmentSchema.post('remove', async function (doc, next) {
  if (doc.accepted_faculty) {
    await updateFacultySupervisionCount(doc.accepted_faculty);
  }
  next();
});

// Post-update hook for operations like findOneAndUpdate
supervisorAssignmentSchema.post('findOneAndUpdate', async function (doc, next) {
  if (doc && (doc.isModified('accepted_faculty') || doc.isModified('overall_status'))) {
    const previousDoc = await this.findById(doc._id);
    const oldFacultyId = previousDoc ? previousDoc.accepted_faculty : null;
    const newFacultyId = doc.accepted_faculty;

    if (oldFacultyId && (!newFacultyId || oldFacultyId.toString() !== newFacultyId.toString())) {
      await updateFacultySupervisionCount(oldFacultyId);
    }
    if (newFacultyId && doc.overall_status === 'Assigned') {
      await updateFacultySupervisionCount(newFacultyId);
    }
  }
  next();
});

module.exports = mongoose.model('SupervisorAssignment', supervisorAssignmentSchema);

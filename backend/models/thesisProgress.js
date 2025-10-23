const mongoose = require('mongoose');

const STAGE_ORDER = [
  'Enrolled',
  'Supervisor Assignment',
  'Proposal',
  'Thesis',
  'Predefense',
  'Defense',
];

const thesisProgressSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      unique: true,
    },
    current_stage: {
      type: String,
      enum: STAGE_ORDER,
      default: 'Enrolled',
    },
    unlocked_stages: [{ type: String }],
    is_active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ------------------------------------------------------------
// 🧠 Auto-ensure progressive unlocking before saving
// ------------------------------------------------------------
thesisProgressSchema.pre('save', function (next) {
  if (this.unlocked_stages && this.unlocked_stages.length > 0) {
    // Find the highest stage unlocked
    const maxStageIndex = Math.max(
      ...this.unlocked_stages.map((s) => STAGE_ORDER.indexOf(s))
    );

    // Include all earlier stages automatically
    const requiredStages = STAGE_ORDER.slice(0, maxStageIndex + 1);

    this.unlocked_stages = Array.from(new Set(requiredStages)); // remove duplicates
  } else {
    // If no unlocked stages, start with Enrolled
    this.unlocked_stages = ['Enrolled'];
  }
  next();
});

// ------------------------------------------------------------
// 🧩 Utility method: unlock a specific stage safely
// ------------------------------------------------------------
thesisProgressSchema.methods.unlockStage = function (stage) {
  const index = STAGE_ORDER.indexOf(stage);
  if (index === -1) throw new Error(`Invalid stage: ${stage}`);

  const stagesToUnlock = STAGE_ORDER.slice(0, index + 1);
  this.unlocked_stages = Array.from(
    new Set([...this.unlocked_stages, ...stagesToUnlock])
  );

  this.current_stage = stage;
  return this.save();
};

module.exports = mongoose.model('ThesisProgress', thesisProgressSchema);

const Student = require('../models/student');
const ThesisProgress = require('../models/thesisProgress');
const ThesisProposal = require('../models/thesisProposal');
const SupervisorAssignment = require('../models/supervisorAssignment'); // Add this import
const { computeUnlockedStages } = require('../services/progressService');

const stageLabels = {
  Proposal: "Thesis Proposal",
  Thesis: "Thesis Upload", 
  Predefense: "Predefense",
  Defense: "Defense",
  "Supervisor Assignment": "Supervisor Assignment",
  Enrolled: "Enrolled",
};

const getThesisProgress = async (req, res) => {
  try {
    const studentId = req.user.id;

    // ✅ Find student record
    const student = await Student.findById(studentId).populate("supervisors");
    if (!student) {
      return res.status(404).json({
        isEligible: false,
        message: "Student not found.",
        progress: [],
        supervisors: [],
      });
    }

    // ✅ Check eligibility (your existing logic)
    const isEligible = checkEligibility(student); // <- your function
    const message = isEligible
      ? "You meet the requirements for thesis proposal."
      : "You are not eligible yet. Complete required steps first.";

    // ✅ Build progress array (always include key stages in order)
    const progress = [
      {
        step: "Supervisor Assignment",
        unlocked: Boolean(student.supervisors?.length > 0),
      },
      {
        step: "Thesis Proposal",
        unlocked: isEligible,
      },
      {
        step: "Proposal Upload",
        unlocked: false, // default, update when you add upload logic
      },
    ];

    // ✅ Normalize supervisors (avoid sending full mongoose docs)
    const supervisors = student.supervisors?.map((s) => ({
      id: s._id,
      name: s.name,
      department: s.department,
    })) || [];

    // ✅ Consistent JSON response
    return res.json({
      isEligible,
      message,
      progress,
      supervisors,
    });

  } catch (error) {
    console.error("Error in getThesisProgress:", error);
    return res.status(500).json({
      isEligible: false,
      message: "Server error while fetching progress.",
      progress: [],
      supervisors: [],
    });
  }
};

const checkProgressEligibility = async (req, res) => {
  try {
    const student = await Student.findOne({ user_id: req.user._id });
    if (!student) {
      return res.status(404).json({ message: "Student not found" });
    }

    // Check for supervisor - either fully assigned OR supervisor has accepted
    let hasSupervisor = student.supervisor_id;
    
    if (!hasSupervisor) {
      const supervisorAssignment = await SupervisorAssignment.findOne({ student_id: student._id });
      if (supervisorAssignment) {
        const hasAcceptedSupervisor = supervisorAssignment.priority_list.some(
          p => p.status === 'PGCAccepted'
        );
        hasSupervisor = hasAcceptedSupervisor;
      }
    }


    // Eligibility checks
    const hasMinCGPA = student.cgpa > 2.5;
    const hasMinCredits = student.obtained_credits >= 9;
    const isEligible = hasMinCGPA && hasMinCredits && hasSupervisor;
    
    let reason = "";
    if (!hasMinCredits) reason = "Need at least 9 credits.";
    else if (!hasMinCGPA) reason = "CGPA must be above 2.5.";
    else if (!hasSupervisor) reason = "No supervisor assigned yet.";

    // Compute unlocked stages
    const unlockedStages = await computeUnlockedStages(student);
    
    // Rename stages for frontend consistency
    const progress = unlockedStages.map((s) => ({
      step: stageLabels[s.step] || s.step,
      unlocked: s.unlocked,
    }));

    // Get or create thesis progress record
    let thesisProgress = await ThesisProgress.findOne({ student: student._id });
    if (!thesisProgress) {
      thesisProgress = await ThesisProgress.create({
        student: student._id,
        current_stage: "Enrolled",
        unlocked_stages: progress.filter((s) => s.unlocked).map((s) => s.step),
      });
    } else {
      thesisProgress.unlocked_stages = progress.filter((s) => s.unlocked).map((s) => s.step);
      await thesisProgress.save();
    }

    res.status(200).json({
      eligible: isEligible,
      reason: isEligible ? "" : reason,
      progress: progress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

module.exports = { 
  checkProgressEligibility,
  getThesisProgress 
};
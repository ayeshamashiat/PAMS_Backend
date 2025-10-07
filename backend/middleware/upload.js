// middleware/upload.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const UPLOAD_DIR = "uploads";
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Choose a descriptive filename based on route + mimetype
function makeFilename(req, file) {
  const ext = path.extname(file.originalname).toLowerCase();
  const isCSV = ext === ".csv" || file.mimetype === "text/csv";
  const isPDF = ext === ".pdf" || file.mimetype === "application/pdf";

  // Name hint from route
  const baseHint = (() => {
    const url = `${req.baseUrl}${req.url}`.toLowerCase();
    if (url.includes("/students") && /\/submit\/check/i.test(req.url)) return "proposal";
    if (url.includes("/students") && /\/thesis\/submit/i.test(req.url)) return "thesis";
    if (isCSV && url.includes("faculty")) return "faculty";
    if (isCSV && url.includes("student")) return "students";
    if (isCSV && url.includes("course")) return "courses";
    return isPDF ? "document" : "upload";
  })();

  return `${baseHint}_${Date.now()}${ext}`;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, makeFilename(req, file)),
});

/**
 * File filter rules (merged):
 * - Allow PDFs ONLY for student proposal/thesis endpoints:
 *   - baseUrl includes "/students" AND (url matches /submit/check OR /thesis/submit)
 * - Allow CSV files for bulk uploads (any route).
 * - Reject everything else.
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const mimetype = (file.mimetype || "").toLowerCase();

  const isCSV = ext === ".csv" || mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv");
  const isPDF = ext === ".pdf" || mimetype === "application/pdf";

  const isStudents = (req.baseUrl || "").includes("/students");
  const isProposal = /\/submit\/check/i.test(req.url || "");
  const isThesis = /\/thesis\/submit/i.test(req.url || "");

  // PDFs: only for students proposal/thesis submits
  if (isPDF && isStudents && (isProposal || isThesis)) {
    return cb(null, true);
  }

  // CSV: allowed globally (bulk uploads)
  if (isCSV) {
    return cb(null, true);
  }

  return cb(
    new Error(
      "Only CSV files are allowed for bulk upload. PDFs are allowed only for student proposal/thesis submission."
    ),
    false
  );
};

module.exports = multer({ storage, fileFilter });

// middleware/upload.js
const multer = require("multer");
const path = require("path");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Allow PDFs for proposal submit & thesis submit; CSV for bulk uploads
  const isStudents = req.baseUrl.includes("/students");
  const isProposal = /\/submit\/check/.test(req.url);
  const isThesis = /\/thesis\/submit/.test(req.url);

  if (
    (isStudents && (isProposal || isThesis) && ext === ".pdf") ||
    ext === ".csv"
  ) {
    return cb(null, true);
  }
  cb(
    new Error(
      "Only PDF files are allowed for thesis proposal/thesis submission, and CSV for bulk upload"
    ),
    false
  );
};

module.exports = multer({ storage, fileFilter });

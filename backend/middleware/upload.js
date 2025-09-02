const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Which student routes are allowed to receive a PDF
const PDF_ROUTES = ["/submit/check", "/thesis/submit"]; // proposal + thesis

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // put proposals and theses in separate folders (optional but cleaner)
    let sub = "uploads";
    const isStudents = req.baseUrl.includes("/students");

    if (isStudents && req.url.includes("/submit/check"))
      sub = "uploads/proposals";
    else if (isStudents && req.url.includes("/thesis/submit"))
      sub = "uploads/thesis";

    ensureDir(sub);
    cb(null, sub);
  },
  filename: function (req, file, cb) {
    const safe = file.originalname.replace(/\s+/g, "_");
    cb(null, `${Date.now()}-${safe}`);
  },
});

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  const isPdf = ext === ".pdf";
  const isCsv = ext === ".csv";

  const isStudents = req.baseUrl.includes("/students");
  const isPdfRoute = PDF_ROUTES.some((seg) => req.url.includes(seg));

  // Allow: PDF on the listed student routes; CSV anywhere (for bulk imports you already use)
  if ((isStudents && isPdfRoute && isPdf) || isCsv) return cb(null, true);

  cb(
    new Error(
      "Only PDF files are allowed for proposal/thesis; CSV is allowed for bulk upload"
    ),
    false
  );
};

module.exports = multer({ storage, fileFilter });

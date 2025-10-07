const multer = require("multer");
const path = require("path");
const fs = require("fs");

const dir = "uploads/course_csv";
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, dir),
  filename: (req, file, cb) =>
    cb(null, "courses-" + Date.now() + path.extname(file.originalname)),
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) cb(null, true);
  else cb(new Error("Only CSV files are allowed"), false);
};

const uploadCourseCSV = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

module.exports = uploadCourseCSV;

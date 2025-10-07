const multer = require("multer");
const path = require("path");

// Storage config: store in /uploads/student_csv
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/student_csv");
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "students-" + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter: allow only CSV
const fileFilter = (req, file, cb) => {
  if (file.mimetype === "text/csv" || file.originalname.endsWith(".csv")) {
    cb(null, true);
  } else {
    cb(new Error("Only CSV files are allowed for student upload"), false);
  }
};

// Multer instance with limits
const uploadStudentCSV = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB max
  }
});

module.exports = uploadStudentCSV;

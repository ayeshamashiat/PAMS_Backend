const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/'); // or your desired folder
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  // Allow PDF for thesis proposal, CSV for student bulk upload
  const ext = path.extname(file.originalname).toLowerCase();
  if (
    (req.baseUrl.includes('/students') && req.url.includes('/submit/check') && ext === '.pdf') ||
    ext === '.csv'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed for thesis proposal, and CSV for bulk upload'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

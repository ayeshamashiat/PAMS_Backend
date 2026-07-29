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
  const ext = path.extname(file.originalname).toLowerCase();
  if
    (
      // allow student proposal PDF upload
      (req.baseUrl.includes('/students') && req.url.includes('/submit/check') && ext === '.pdf') ||
      // allow thesis upload PDF (route uses /thesis/upload)
      (req.baseUrl.includes('/thesis') && req.url.includes('/upload') && ext === '.pdf')
    ) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({ storage, fileFilter });

module.exports = upload;

const multer = require("multer");
const path = require("path");

const csvFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (ext == ".csv") {
    file.mimetype = "text/csv";
    cb(null, true);
  } else {
    cb("Please upload only CSV file.", false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    console.log(file);
    cb(null, __dirname + "/raman/");
  },
  filename: (req, file, cb) => {
    console.log(file);
    cb(null, `raman-results-${file.originalname}`);
  }
});

module.exports = multer({ storage: storage, fileFilter: csvFilter });

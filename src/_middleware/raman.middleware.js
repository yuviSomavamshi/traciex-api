const multer = require("multer");

const excelFilter = (req, file, cb) => {
  console.log(file.mimetype);
  if (file.mimetype.includes("csv")) {
    cb(null, true);
  } else {
    cb("Please upload only excel file.", false);
  }
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, __dirname + "/raman/");
  },
  filename: (req, file, cb) => {
    cb(null, `raman-reader-${file.originalname}`);
  }
});

module.exports = multer({ storage: storage, fileFilter: excelFilter });

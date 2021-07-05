const express = require("express");
const router = express.Router();
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");
const upload = require("../_middleware/raman.middleware");
const uuid = require("uuid").v4;
const ramanService = require("../services/raman.service");

// routes
const setUUID = (req, res, next) => {
  req.batchId = uuid();
  next();
};

router.get("/", authorize([Role.SubAdmin]), ramanService.findAll);
router.post("/upload", authorize([Role.SubAdmin]), setUUID, upload.single("file"), ramanService.upload);
router.delete("/:file", authorize([Role.SubAdmin]), ramanService.deleteCode);

module.exports = router;

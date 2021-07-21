const express = require("express");
const router = express.Router();
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");
const upload = require("../_middleware/raman.middleware");
const uuid = require("uuid").v4;
const ramanService = require("../services/raman.service");
const checkCSRF = require("../_middleware/checkCSRF");

// routes
const setUUID = (req, res, next) => {
  req.batchId = uuid();
  next();
};

var APIKEYS = ["23423432423", "3453454343"];
if (process.env.APIKEYS && process.env.APIKEYS.split(",").length > 0) {
  APIKEYS = process.env.APIKEYS.split(",");
}

router.get("/", checkCSRF, authorize([Role.SubAdmin]), ramanService.findAll);
router.post("/upload", setUUID, checkCSRF, authorize([Role.SubAdmin]), upload.single("file"), ramanService.upload);
router.post("/uploadByRaman", setUUID, apiKey, upload.single("file"), ramanService.uploadByRaman);
router.post("/download", setUUID, apiKey, ramanService.download);
router.post("/:file/delete", checkCSRF, authorize([Role.SubAdmin]), ramanService.deleteCode);

module.exports = router;

function apiKey(req, res, next) {
  if (!APIKEYS.includes(req.headers["x-api-key"])) {
    return res.status(401).send({ message: "Unauthorized" });
  }
  next();
}

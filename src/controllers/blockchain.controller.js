const express = require("express");
const router = express.Router();
const Joi = require("joi");
const authorize = require("../_middleware/authorize");
const Role = require("../_helpers/role");
const validateRequest = require("../_middleware/validate-request");
const validateQueryString = validateRequest.validateQueryString;
const blockchainService = require("../services/blockchain.service");
var APIKEYS = ["23423432423", "3453454343"];
if (process.env.APIKEYS && process.env.APIKEYS.split(",").length > 0) {
  APIKEYS = process.env.APIKEYS.split(",");
}
const checkCSRF = require("../_middleware/checkCSRF");

router.post("/register-device", checkCSRF, authorize([Role.Staff]), registerSchema, blockchainService.register);
router.post("/scrap-device", checkCSRF, authorize([Role.Staff]), scrapDeviceSchema, blockchainService.scrap);
router.post("/upload-diagnosis-report", apiKey, uploadSchema, blockchainService.upload);
router.post("/diagnosis-report", checkCSRF, authorize([Role.Staff, Role.Patient]), reportSchema, blockchainService.resultPatient);
router.get("/dashboard/customers/count", checkCSRF, authorize([Role.Admin, Role.SubAdmin]), blockchainService.getCustomerCount);
router.get("/dashboard/locations/count", checkCSRF, authorize([Role.Admin, Role.SubAdmin]), blockchainService.getLocationCount);
router.get(
  "/dashboard/breathalyzer-test-stats",
  checkCSRF,
  authorize([Role.Admin, Role.SubAdmin]),
  statisticQSSchema,
  blockchainService.getTestStats
);
router.get(
  "/dashboard/breathalyzer-usage-stats",
  checkCSRF,
  authorize([Role.Admin, Role.SubAdmin]),
  statisticQSSchema,
  blockchainService.getAvgStats
);
router.get("/location", checkCSRF, authorize([Role.Staff]), blockchainService.patientList);
router.post("/checkout", checkCSRF, authorize([Role.Staff]), blockchainService.checkout);

module.exports = router;

function statisticQSSchema(req, res, next) {
  const schema = Joi.object({
    startDate: Joi.string().required(),
    endDate: Joi.string().required(),
    type: Joi.string()
  });
  validateQueryString(req, next, schema);
}

function reportSchema(req, res, next) {
  const schema = Joi.object({
    patientId: Joi.string().required()
  });
  validateRequest(req, next, schema);
}
function registerSchema(req, res, next) {
  const schema = Joi.object({
    patientId: Joi.string().required(),
    barcode: Joi.string().required(),
    timestamp: Joi.string(),
    location: Joi.string(),
    locationId: Joi.string()
  });
  validateRequest(req, next, schema);
}

function scrapDeviceSchema(req, res, next) {
  const schema = Joi.object({
    barcode: Joi.string().required()
  });
  validateRequest(req, next, schema);
}

function uploadSchema(req, res, next) {
  const schema = Joi.object({
    subject_id: Joi.string().required(),
    machine_id: Joi.string().required(),
    date: Joi.string(),
    time: Joi.string(),
    location: Joi.string().required(),
    diagnosis: Joi.string().required().valid("Positive", "Negative", "Invalid").empty("")
  });
  validateRequest(req, next, schema);
}

function apiKey(req, res, next) {
  if (!APIKEYS.includes(req.headers["x-api-key"])) {
    return res.status(401).send({ message: "Unauthorized Access" });
  }
  next();
}

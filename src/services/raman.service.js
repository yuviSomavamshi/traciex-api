const db = require("../_helpers/db");
const Pagination = require("../utils/pagination");
const whiteboard = require("../utils/whiteboad");
const Op = require("sequelize").Op;
const path = require("path");
const logger = require("../utils/logger");

const upload = async (req, res) => {
  try {
    logger.trace("The file uploaded by web:", req.file);
    if (req.file == undefined) {
      return res.status(400).send({ message: "Please upload a CSV file!" });
    }
    const raman = new db.Raman({
      filename: req.file.filename,
      batchId: req.batchId,
      status: 0,
      accountId: req.user.id,
      location: "Web"
    });
    raman
      .save()
      .then(() => {
        res.status(200).send({
          message: "File processed successfully: " + req.file.originalname
        });
        whiteboard.publish("mount_file", { file: req.file.filename, secret: process.env.SECRET });
      })
      .catch((error) => {
        if (error.name == "SequelizeUniqueConstraintError") {
          return res.status(400).send({
            message: "File name already exists",
            error: error.message
          });
        }
        logger.error("Exception while saving record to raman table", error);
        res.status(500).send({
          message: "Fail to import data into database!",
          error: error.message
        });
      });
  } catch (e) {
    logger.error("Exception while uploading raman", e);
    res.status(500).send({
      message: "Could not upload the file: " + req.file.originalname
    });
  }
};

const uploadByRaman = async (req, res) => {
  try {
    logger.trace("The file uploaded by raman spectrum:", req.file);
    if (req.file == undefined) {
      return res.status(400).send({ message: "Please upload a CSV file!" });
    }

    const raman = new db.Raman({
      filename: req.file.filename,
      batchId: req.batchId,
      status: 1,
      accountId: req.headers["x-client-id"],
      location: req.headers["x-loc"]
    });
    raman
      .save()
      .then(() => {
        res.status(200).send({
          message: "File processed successfully: " + req.file.originalname
        });
      })
      .catch((error) => {
        if (error.name == "SequelizeUniqueConstraintError") {
          return res.status(400).send({
            message: "File name already exists",
            error: error.message
          });
        }
        res.status(500).send({
          message: "Fail to import data into database!",
          error: error.message
        });
      });
  } catch (e) {
    logger.error("Exception while uploading raman", e);
    res.status(500).send({
      message: "Could not upload the file: " + req.file.originalname
    });
  }
};

const download = (req, res) => {
  const file = path.join(__dirname, "../_middleware/raman", req.body.filename);
  res.download(file);
};

// Retrieve all Raman Readers from the database.
const findAll = (req, res) => {
  let { page, size, token, status, order, sortBy } = req.query;
  if (token == null) token = "";
  const { limit, offset } = Pagination.getPagination(page, size);
  status = status != null ? status.split(",") : [0, 1, 2];
  let orderW = [];
  if (sortBy != null && order != null) {
    orderW = [[sortBy || "createdAt", order || "DESC"]];
  }

  db.Raman.findAndCountAll({
    include: db.Account,
    where: { filename: { [Op.like]: `%${token}%` }, status: { [Op.in]: status } },
    limit,
    offset,
    order: orderW
  })
    .then((data) => {
      res.send(Pagination.getPagingData(data, page, limit));
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving raman."
      });
    });
};

const deleteCode = (req, res) => {
  db.Raman.destroy({ where: { filename: req.params.file } })
    .then((data) => {
      if (data == 1) {
        res.send({ message: "Raman Result file deleted successfully" });
      } else {
        res.status(404).send({ message: "Raman not found" });
      }
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while deleting Raman Result file:" + req.params.file
      });
    });
};

module.exports = {
  upload,
  download,
  findAll,
  deleteCode,
  uploadByRaman
};

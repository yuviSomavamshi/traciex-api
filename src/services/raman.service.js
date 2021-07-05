const db = require("../_helpers/db");
const readXlsxFile = require("read-excel-file/node");
const Pagination = require("../utils/pagination");

const Op = require("sequelize").Op;

const upload = async (req, res) => {
  try {
    console.log("The file uploaded to:", req.file);
    if (req.file == undefined) {
      return res.status(400).send({ message: "Please upload a CSV file!" });
    }
    const raman = new db.Raman({
      filename: req.file.filename,
      batchId: req.batchId,
      status: 0,
      accountId: req.user.id
    });
    raman
      .save()
      .then(() => {
        res.status(200).send({
          message: "File processed successfully: " + req.file.originalname
        });
      })
      .catch((error) => {
        res.status(500).send({
          message: "Fail to import data into database!",
          error: error.message
        });
      });

  } catch (e) {
    console.error("Exception while uploading raman", e);
    res.status(500).send({
      message: "Could not upload the file: " + req.file.originalname
    });
  }
};

const STATUS = ["Saved", "Deleted"];

const download = (req, res) => {
  let ramanReaders = [];
  db.Raman.findAll().then((objs) => {
    objs.forEach((obj) => {
      ramanReaders.push({
        filename: obj.filename,
        batchId: obj.batchId,
        status: STATUS[obj.status] || "-",
        createdAt: obj.createdAt,
        updatedAt: obj.updatedAt
      });
    });

    res.status(200).send(ramanReaders);
  });
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

  db.Raman.findAndCountAll({ where: { filename: { [Op.like]: `%${token}%` }, status: { [Op.in]: status } }, limit, offset, order: orderW })
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
        res.send({ message: "Raman delete successfully" });
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
  deleteCode
};

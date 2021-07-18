const db = require("../_helpers/db");
const Role = require("../_helpers/role");

const readXlsxFile = require("read-excel-file/node");
const excel = require("exceljs");
const Pagination = require("../utils/pagination");
const logger = require("../utils/logger");
const { QueryTypes } = require("sequelize");
const Op = require("sequelize").Op;

function getUniqueItemsByProperties(items, prop) {
  let valid = [],
    duplicates = [];
  let keys = new Set();
  items.forEach((element) => {
    if (!keys.has(element[prop])) {
      valid.push(element);
      keys.add(element.code);
    } else {
      duplicates.push(element.code);
    }
  });
  return { valid, duplicates };
}

const upload = async (req, res) => {
  try {
    if (req.file === undefined) {
      return res.status(400).send({ message: "Please upload an Excel file!" });
    }

    let path = __dirname + "/../_middleware/uploads/" + req.file.filename;

    readXlsxFile(path).then(async (rows) => {
      // skip header
      rows.shift();

      if (rows.length > 10000) {
        return res.status(400).send({
          message: "Exceeding maximum file upload limit. Max Limit: 10000 barcodes per file upload."
        });
      }
      let barcodes = [],
        invalid = [],
        duplicates = [],
        valid = [];

      rows.forEach((row) => {
        let barcode = {
          code: row[0],
          batchId: req.batchId,
          accountId: req.user.id,
          filename: req.file.originalname
        };

        if (barcode && barcode.code !== null && /^[a-zA-Z0-9-]{8,20}$/.test(String(barcode.code))) {
          if (barcodes.indexOf(barcode) === -1) {
            barcodes.push(barcode);
          }
        } else {
          invalid.push(barcode.code);
        }
      });

      if (barcodes.length === 0) {
        return res.status(400).send({
          totalUploaded: rows.length,
          totalInvalid: invalid.length,
          invalidBarcodes: invalid,
          message: "No barcodes found in file uploaded"
        });
      }

      for (let i = 0; i < barcodes.length; i++) {
        let result = await db.Barcode.findOne({
          where: { code: barcodes[i].code }
        });
        if (result !== null) {
          duplicates.push(barcodes[i].code);
        } else {
          valid.push(barcodes[i]);
        }
      }
      const result = getUniqueItemsByProperties(valid, "code");
      valid = result.valid;
      duplicates = [...duplicates, ...result.duplicates];
      if (valid.length === 0) {
        return res.status(400).send({
          totalUploaded: rows.length,
          totalValid: valid.length,
          totalDuplicates: duplicates.length,
          totalInvalid: invalid.length,
          duplicateBarcodes: duplicates,
          invalidBarcodes: invalid,
          message: `No valid barcodes found in ${req.file.originalname} file uploaded. Total Duplicate Barcodes: ${duplicates.length}, Total Invalid Barcodes: ${invalid.length}`
        });
      }
      const obj = await db.BarcodeMeta.findOne({ where: { originalFileName: req.file.originalname } });
      if (obj) {
        await obj.update(
          {
            batchIds: [...obj.batchIds, req.batchId],
            totalUploaded: obj.totalUploaded + rows.length,
            totalValid: obj.totalValid + valid.length,
            totalDuplicates: obj.totalDuplicates + duplicates.length,
            totalInvalid: obj.totalInvalid + invalid.length
          },
          { where: { originalFileName: req.file.originalname } }
        );
      } else {
        await db.BarcodeMeta.create({
          originalFileName: req.file.originalname,
          batchIds: [req.batchId],
          totalUploaded: rows.length,
          totalValid: valid.length,
          totalDuplicates: duplicates.length,
          totalInvalid: invalid.length
        });
      }
      try {
        await db.Barcode.bulkCreate(valid, {
          returning: ["code"],
          ignoreDuplicates: true
        });
      } catch (e) {
        logger.error("Fail to import data into database!", e);
        return res.status(500).send({
          message: "Fail to import data into database!",
          error: error.message
        });
      }
      res.status(200).send({
        totalUploaded: rows.length,
        totalValid: valid.length,
        totalDuplicates: duplicates.length,
        totalInvalid: invalid.length,
        duplicateBarcodes: duplicates,
        invalidBarcodes: invalid,
        message: "File processed successfully: " + req.file.originalname
      });
    });
  } catch (e) {
    logger.error("Exception while uploading barcodes", e);
    res.status(500).send({
      message: "Could not upload the file: " + req.file.originalname
    });
  }
};

// Retrieve all BarcodeMeta from the database.
const findAllMeta = (req, res) => {
  let { page, size, token, order, sortBy } = req.query;
  if (token === null) token = "";
  const { limit, offset } = Pagination.getPagination(page, size);
  // status = status !== null ? status.split(",") : [0, 1, 2];
  let orderW = [];
  if (sortBy !== null && order !== null) {
    orderW = [[sortBy || "createdAt", order || "DESC"]];
  }

  db.BarcodeMeta.findAndCountAll({
    where: { originalFileName: { [Op.like]: `%${token}%` } },
    limit,
    offset,
    order: orderW
  })
    .then((data) => {
      res.send(Pagination.getPagingData(data, page, limit));
    })
    .catch((err) => {
      res.status(500).send({
        message: err.message || "Some error occurred while retrieving barcodes."
      });
    });
};

const deleteMeta = async (req, res) => {
  const result = await db.Barcode.findAndCountAll({
    where: {
      filename: req.params.file,
      status: 1
    }
  });
  if (result && result.count > 0) {
    return res.status(409).send({ message: `Barcode file cannot be deleted, You have utilited: ${result.count} kits` });
  }

  db.Barcode.destroy({ where: { filename: req.params.file } })
    .then(async (data) => {
      res.send({ message: "Barcode delete successfully" });
      await db.BarcodeMeta.destroy({ where: { originalFileName: req.params.file } });
    })
    .catch((err) => {
      logger.error(err);
      res.status(500).send({
        message: err.message || "Some error occurred while deleteing barcode."
      });
    });
};

const report = async (req, res) => {
  try {
    if (req.user.role === Role.Customer) {
      req.query.customerId = req.user.id;
    }

    if (isNaN(Date.parse(req.query.start))) {
      return res.status(400).send({
        message: "Invalid start date"
      });
    }
    if (isNaN(Date.parse(req.query.end))) {
      return res.status(400).send({
        message: "Invalid end date"
      });
    }

    if (Date.parse(req.query.start) > Date.parse(req.query.end)) {
      return res.status(400).send({
        message: "Start date cannot be greater than end date"
      });
    }

    const QS = `SELECT DATE_FORMAT(barcodes.updatedAt, '%Y-%m-%d') AS 'dt', barcodes.status, count(barcodes.code) as 'hits' FROM accounts, barcodes WHERE barcodes.staffId = accounts.id and barcodes.staffId in (select id from accounts where customerId=$customer and role='Staff') and barcodes.updatedAt>=$start and barcodes.updatedAt<=$end group by name, dt, status`;
    const records = await db.sequelize.query(QS, {
      bind: {
        customer: req.query.customerId,
        start: req.query.start + " 00:00:00",
        end: req.query.end + " 23:59:59"
      },
      type: QueryTypes.SELECT
    });
    let workbook = new excel.Workbook();
    let worksheet = workbook.addWorksheet("Usage Report");

    worksheet.columns = [
      { header: "Date", key: "dt", width: 25 },
      { header: "Status", key: "status", width: 10 },
      { header: "Count", key: "hits", width: 10 }
    ];

    let data = [];
    records.forEach((rec) => {
      let result = "";
      if (rec.status === 0) {
        result = "Unassigned";
      } else if (rec.status === 1) {
        result = "Assigned";
      } else if (rec.status === 2) {
        result = "Scrapped";
      } else {
        result = "Unknown";
      }
      rec.status = result;
      data.push(rec);
    });

    // Add Array Rows
    worksheet.addRows(data);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", "attachment; filename=" + "UsageReport-" + Date.now() + ".xlsx");

    return workbook.xlsx.write(res).then(function () {
      res.status(200).end();
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while verifying barcode."
    });
  }
};

const customerUsageReport = async (req, res) => {
  try {
    if (isNaN(Date.parse(req.query.startDate))) {
      return res.status(400).send({
        message: "Invalid start date"
      });
    }
    if (isNaN(Date.parse(req.query.endDate))) {
      return res.status(400).send({
        message: "Invalid end date"
      });
    }

    if (Date.parse(req.query.start) > Date.parse(req.query.end)) {
      return res.status(400).send({
        message: "Start date cannot be greater than end date"
      });
    }

    const QS = `SELECT CASE WHEN status = 1 THEN 'Assigned' WHEN status = 2 THEN 'Scrapped' END AS S, COUNT(*) AS HITS FROM barcodes WHERE updatedAt >=$start AND updatedAt<=$end AND staffId IN (SELECT id FROM accounts WHERE customerId=$customer) GROUP BY S`;
    const records = await db.sequelize.query(QS, {
      bind: {
        customer: req.user.id,
        start: req.query.startDate + " 00:00:00",
        end: req.query.endDate + " 23:59:59"
      },
      type: QueryTypes.SELECT
    });
    let total = 0,
      used = 0,
      scrapped = 0;

    records.forEach((item) => {
      if (item.S === "Assigned") {
        total += item.HITS;
        used += item.HITS;
      } else if (item.S === "Scrapped") {
        total += item.HITS;
        scrapped += item.HITS;
      }
    });
    res.send({
      total_kits: formatKits(total),
      kits_assigned: formatKits(used),
      kits_scrapped: formatKits(scrapped)
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while verifying barcode."
    });
  }
};

const staffUsageReport = async (req, res) => {
  try {
    if (isNaN(Date.parse(req.query.startDate))) {
      return res.status(400).send({
        message: "Invalid start date"
      });
    }
    if (isNaN(Date.parse(req.query.endDate))) {
      return res.status(400).send({
        message: "Invalid end date"
      });
    }

    if (Date.parse(req.query.start) > Date.parse(req.query.end)) {
      return res.status(400).send({
        message: "Start date cannot be greater than end date"
      });
    }

    const QS = `SELECT CASE WHEN status = 1 THEN 'Assigned' WHEN status = 2 THEN 'Scrapped' END AS S, COUNT(*) AS HITS FROM barcodes WHERE updatedAt >=$start AND updatedAt<=$end AND staffId=$staff GROUP BY S`;
    const records = await db.sequelize.query(QS, {
      bind: {
        staff: req.user.id,
        start: req.query.startDate + " 00:00:00",
        end: req.query.endDate + " 23:59:59"
      },
      type: QueryTypes.SELECT
    });
    let total = 0,
      used = 0,
      scrapped = 0;

    records.forEach((item) => {
      if (item.S === "Assigned") {
        total += item.HITS;
        used += item.HITS;
      } else if (item.S === "Scrapped") {
        total += item.HITS;
        scrapped += item.HITS;
      }
    });
    res.send({
      total_kits: formatKits(total),
      kits_assigned: formatKits(used),
      kits_scrapped: formatKits(scrapped)
    });
  } catch (err) {
    res.status(500).send({
      message: err.message || "Some error occurred while verifyin barcode."
    });
  }
};

module.exports = {
  upload,
  findAllMeta,
  deleteMeta,
  report,
  customerUsageReport,
  staffUsageReport
};

const formatKits = (n) => {
  if (n < 1e3) return n;
  if (n >= 1e3 && n < 1e6) return +(n / 1e3).toFixed(1) + "K";
  if (n >= 1e6 && n < 1e9) return +(n / 1e6).toFixed(1) + "M";
  if (n >= 1e9 && n < 1e12) return +(n / 1e9).toFixed(1) + "B";
  if (n >= 1e12) return +(n / 1e12).toFixed(1) + "T";
};

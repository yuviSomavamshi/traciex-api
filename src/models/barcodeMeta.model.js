const { DataTypes } = require("sequelize");

module.exports = model;

function model(sequelize) {
  const attributes = {
    originalFileName: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      defaultValue: ""
    },
    batchId: {
      type: DataTypes.UUID,
      allowNull: false,
      defaultValue: DataTypes.UUIDV4
    },
    totalUploaded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalValid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalDuplicates: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalInvalid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  };
  return sequelize.define("barcodeMeta", attributes);
}

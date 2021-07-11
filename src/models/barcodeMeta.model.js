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
    batchIds: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: []
    },
    totalUploaded: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalValid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalDuplicates: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    totalInvalid: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
  };
  return sequelize.define("barcodeMeta", attributes);
}

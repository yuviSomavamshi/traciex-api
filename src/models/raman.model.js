const { DataTypes } = require("sequelize");

module.exports = model;

function model(sequelize) {
  const attributes = {
    filename: { type: DataTypes.STRING(300), allowNull: false, primaryKey: true },
    batchId: { type: DataTypes.UUID, allowNull: false, defaultValue: DataTypes.UUIDV4 },
    status: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    accountId: { type: DataTypes.UUID, allowNull: false },
    location: { type: DataTypes.STRING, allowNull: false }
  };

  return sequelize.define("raman_reader", attributes);
}

const { DataTypes } = require("sequelize");
const moment = require("moment");

module.exports = model;

function model(sequelize) {
  const attributes = {
    id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      defaultValue: DataTypes.UUIDV4
    },
    email: { type: DataTypes.STRING, allowNull: false },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    name: { type: DataTypes.STRING, allowNull: false },
    contact: { type: DataTypes.STRING },
    country: { type: DataTypes.STRING },
    acceptTerms: { type: DataTypes.BOOLEAN },
    role: { type: DataTypes.STRING, allowNull: false },
    verificationToken: { type: DataTypes.STRING },
    verified: { type: DataTypes.DATE },
    resetToken: { type: DataTypes.STRING },
    resetTokenExpires: { type: DataTypes.DATE },
    passwordReset: { type: DataTypes.DATE },
    customerId: { type: DataTypes.UUID },
    addedById: { type: DataTypes.UUID },
    created: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated: { type: DataTypes.DATE },
    activationDt: { type: DataTypes.DATE },
    expiryDt: { type: DataTypes.DATE },
    isActivated: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.activationDt && moment(this.activationDt).utc().millisecond() < moment(new Date().getTime()).utc().millisecond();
      }
    },
    isExpired: {
      type: DataTypes.VIRTUAL,
      get() {
        return this.expiryDt && moment(this.expiryDt).utc().millisecond() < moment(new Date().getTime()).utc().millisecond();
      }
    },
    isVerified: {
      type: DataTypes.VIRTUAL,
      get() {
        return !!(this.verified || this.passwordReset);
      }
    }
  };

  const options = {
    // disable default timestamp fields (createdAt and updatedAt)
    timestamps: false,
    defaultScope: {
      // exclude password hash by default
      attributes: { exclude: ["passwordHash"] }
    },
    scopes: {
      // include hash with this scope
      withHash: { attributes: {} }
    }
  };

  return sequelize.define("account", attributes, options);
}

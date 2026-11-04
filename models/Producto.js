const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
module.exports = sequelize.define("Producto", {
  nombre: { type: DataTypes.STRING(150), allowNull: false },
  sku: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  descripcion: { type: DataTypes.TEXT },
  precio: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  costo: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0 },
  },
  stock_minimo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 5,
    validate: { min: 0 },
  },
  unidad: {
    type: DataTypes.STRING(30),
    allowNull: false,
    defaultValue: "Unidad",
  },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
});

const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const Producto = require("./Producto");
const Usuario = require("./Usuario");
const Categoria = sequelize.define("Categoria", {
  nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true },
  descripcion: { type: DataTypes.TEXT },
});
const Proveedor = sequelize.define("Proveedor", {
  razon_social: { type: DataTypes.STRING(150), allowNull: false, unique: true },
  contacto: { type: DataTypes.STRING(100) },
  telefono: { type: DataTypes.STRING(30) },
  email: { type: DataTypes.STRING(254), validate: { isEmail: true } },
  ruc: { type: DataTypes.STRING(11) },
  direccion: { type: DataTypes.STRING(250) },
});
const Movimiento = sequelize.define(
  "Movimiento",
  {
    tipo_movimiento: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: { isIn: [["Entrada", "Salida", "Ajuste"]] },
    },
    cantidad: { type: DataTypes.INTEGER, allowNull: false },
    stock_anterior: { type: DataTypes.INTEGER, allowNull: false },
    stock_resultante: { type: DataTypes.INTEGER, allowNull: false },
    fecha_hora: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    observaciones: { type: DataTypes.STRING(500), allowNull: false },
    referencia: { type: DataTypes.STRING(100) },
    request_id: { type: DataTypes.STRING(80), unique: true, allowNull: false },
    anulado: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    revierte_id: {
      type: DataTypes.INTEGER,
      unique: true,
      allowNull: true,
      references: { model: "Movimientos", key: "id" },
    },
  },
  { indexes: [{ fields: ["fecha_hora"] }, { fields: ["producto_id"] }] },
);
Categoria.hasMany(Producto, {
  foreignKey: { name: "categoria_id", allowNull: false },
  as: "productos",
  onDelete: "RESTRICT",
});
Producto.belongsTo(Categoria, { foreignKey: "categoria_id", as: "categoria" });
Proveedor.hasMany(Producto, {
  foreignKey: { name: "proveedor_id", allowNull: false },
  as: "productos",
  onDelete: "RESTRICT",
});
Producto.belongsTo(Proveedor, { foreignKey: "proveedor_id", as: "proveedor" });
Producto.hasMany(Movimiento, {
  foreignKey: { name: "producto_id", allowNull: false },
  as: "movimientos",
  onDelete: "RESTRICT",
});
Movimiento.belongsTo(Producto, { foreignKey: "producto_id", as: "producto" });
Usuario.hasMany(Movimiento, {
  foreignKey: { name: "usuario_id", allowNull: false },
  as: "movimientos",
  onDelete: "RESTRICT",
});
Movimiento.belongsTo(Usuario, { foreignKey: "usuario_id", as: "usuario" });
module.exports = {
  sequelize,
  Producto,
  Categoria,
  Proveedor,
  Usuario,
  Movimiento,
};

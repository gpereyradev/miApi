const { DataTypes } = require("sequelize");
const sequelize = require("../config/db");
const bcrypt = require("bcryptjs");
const Usuario = sequelize.define(
  "Usuario",
  {
    nombre: { type: DataTypes.STRING(100), allowNull: false },
    email: {
      type: DataTypes.STRING(254),
      allowNull: false,
      unique: true,
      validate: { isEmail: true },
    },
    password: { type: DataTypes.STRING, allowNull: false },
    rol: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Almacenero",
      validate: { isIn: [["Administrador", "Almacenero", "Supervisor"]] },
    },
    activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    token_version: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    defaultScope: { attributes: { exclude: ["password", "token_version"] } },
    hooks: {
      beforeSave: async (usuario) => {
        if (usuario.changed("password"))
          usuario.password = await bcrypt.hash(usuario.password, 12);
      },
    },
  },
);
module.exports = Usuario;

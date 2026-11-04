const { Sequelize } = require("sequelize");
require("dotenv").config({ quiet: true });
const common = {
  logging: false,
  pool: { max: Number(process.env.DB_POOL_MAX || 5), min: 0, idle: 10000 },
  retry: { max: 2 },
};
module.exports = process.env.DATABASE_URL
  ? new Sequelize(process.env.DATABASE_URL, {
      ...common,
      dialect: "postgres",
      dialectOptions: {
        ssl: ["localhost", "127.0.0.1"].includes(
          new URL(process.env.DATABASE_URL).hostname,
        )
          ? false
          : { require: true, rejectUnauthorized: true },
      },
    })
  : new Sequelize(
      process.env.DB_NAME || "inventra",
      process.env.DB_USER || "root",
      process.env.DB_PASSWORD || "",
      {
        ...common,
        dialect: "mysql",
        host: process.env.DB_HOST || "localhost",
        port: Number(process.env.DB_PORT || 3306),
      },
    );

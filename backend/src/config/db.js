const mysql = require("mysql2/promise");

// Create a pool for future database-backed routes. It connects when queried.
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "refound",
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;

require("dotenv").config();

const app = require("./app");
const initializeDatabase = require("./config/initializeDatabase");
const pool = require("./config/db");
const port = Number(process.env.PORT) || 5000;

async function startServer() {
  try {
    await initializeDatabase();
    app.listen(port, () => {
      console.log(`ReFound API listening on http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Could not initialize the database. Check MySQL is running, the database exists, and server/.env is correct.");
    console.error(error);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();

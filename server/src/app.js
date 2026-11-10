const express = require("express");
const cors = require("cors");
const healthRouter = require("./routes/health");
const itemsRouter = require("./routes/items");
const manageRouter = require("./routes/manage");
const { router: staffAuthRouter } = require("./routes/staffAuth");
const staffRouter = require("./routes/staff");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
app.use(express.json({ limit: "32kb" }));
app.use("/api/health", healthRouter);
app.use("/api/items", itemsRouter);
app.use("/api/manage", manageRouter);
app.use("/api/staff/auth", staffAuthRouter);
app.use("/api/staff", staffRouter);

app.use((req, res) => {
  res.status(404).json({ error: "Not found." });
});

app.use((error, _req, res, _next) => {
  const status = error.status || (error.type === "entity.parse.failed" ? 400 : 500);
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: status >= 500 ? "Internal server error." : (error.message || "Invalid request."),
  });
});

module.exports = app;

const express = require("express");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json({
    status: "ok",
    message: "ReFound API is running",
    timestamp: new Date().toISOString(),
  });
});

module.exports = router;

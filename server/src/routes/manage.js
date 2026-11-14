const crypto = require("node:crypto");
const express = require("express");
const pool = require("../config/db");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

async function findManagedItem(id, token) {
  if (typeof token !== "string" || token.length !== 43) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const [items] = await pool.execute(
    `SELECT id, type, title, description, category, location, event_date, status, storage_location, photo_url,
            contact_name, contact_email, created_at
     FROM items WHERE id = ? AND management_token_hash = ?`,
    [id, tokenHash],
  );
  return items[0] || null;
}

router.get("/:id", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const item = await findManagedItem(id, req.get("x-management-token"));
  if (!item) return res.status(404).json({ error: "Managed item not found." });

  const [claims] = await pool.execute(
    `SELECT id, claimant_name, claimant_email, message, status, created_at
     FROM claims WHERE item_id = ? ORDER BY created_at DESC`,
    [id],
  );
  res.json({ item, claims });
}));

router.patch("/:id/status", (_req, res) => {
  res.status(403).json({ error: "Only staff can change item status." });
});

router.patch("/:id/claims/:claimId", (_req, res) => {
  res.status(403).json({ error: "Only staff can decide claims." });
});

module.exports = router;

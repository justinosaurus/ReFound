const crypto = require("node:crypto");
const express = require("express");
const pool = require("../config/db");

const router = express.Router();

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function bodyObject(req) {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw invalid("Request body must be a JSON object.");
  }
  return req.body;
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
    `SELECT id, type, title, description, category, location, event_date, status,
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

router.patch("/:id/status", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const body = bodyObject(req);
  if (!["open", "resolved"].includes(body.status)) throw invalid("Status must be open or resolved.");

  const item = await findManagedItem(id, req.get("x-management-token"));
  if (!item) return res.status(404).json({ error: "Managed item not found." });
  await pool.execute("UPDATE items SET status = ? WHERE id = ?", [body.status, id]);
  res.json({ item: { ...item, status: body.status } });
}));

router.patch("/:id/claims/:claimId", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const claimId = parseId(req.params.claimId);
  if (!id || !claimId) throw invalid("Item or claim ID is invalid.");
  const body = bodyObject(req);
  if (!["accepted", "declined"].includes(body.status)) {
    throw invalid("Claim status must be accepted or declined.");
  }

  if (!await findManagedItem(id, req.get("x-management-token"))) {
    return res.status(404).json({ error: "Managed item not found." });
  }
  const [result] = await pool.execute(
    "UPDATE claims SET status = ? WHERE id = ? AND item_id = ? AND status = 'pending'",
    [body.status, claimId, id],
  );
  if (!result.affectedRows) return res.status(409).json({ error: "Pending claim not found." });
  res.json({ claim: { id: claimId, status: body.status } });
}));

module.exports = router;

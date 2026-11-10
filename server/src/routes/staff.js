const express = require("express");
const pool = require("../config/db");
const { requireStaff } = require("./staffAuth");

const router = express.Router();
const statuses = [
  "lost_reported",
  "with_finder",
  "received_by_staff",
  "verified",
  "awaiting_claim_review",
  "approved_for_pickup",
  "resolved",
];

function asyncHandler(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw invalid(`${field} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

async function transaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

function conflict(message) {
  const error = new Error(message);
  error.status = 409;
  return error;
}

router.use(requireStaff);

router.get("/items", asyncHandler(async (req, res) => {
  const status = req.query.status || "active";
  if (status !== "active" && status !== "all" && !statuses.includes(status)) {
    throw invalid("Status filter is invalid.");
  }

  const conditions = [];
  const values = [];
  if (status === "active") conditions.push("status <> 'resolved'");
  if (status !== "active" && status !== "all") {
    conditions.push("status = ?");
    values.push(status);
  }

  const [items] = await pool.execute(
    `SELECT id, type, title, description, category, location, event_date, status,
            storage_location, contact_name, contact_email, created_at
     FROM items ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
     ORDER BY created_at DESC LIMIT 300`,
    values,
  );
  const ids = items.map((item) => item.id);
  let claims = [];
  if (ids.length) {
    const placeholders = ids.map(() => "?").join(", ");
    [claims] = await pool.execute(
      `SELECT id, item_id, claimant_name, claimant_email, message, status, created_at
       FROM claims WHERE item_id IN (${placeholders}) ORDER BY created_at DESC`,
      ids,
    );
  }
  const claimsByItem = new Map(items.map((item) => [String(item.id), []]));
  for (const claim of claims) claimsByItem.get(String(claim.item_id))?.push(claim);
  res.json({ items: items.map((item) => ({ ...item, claims: claimsByItem.get(String(item.id)) })) });
}));

router.patch("/items/:id/receive", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    throw invalid("Request body must be a JSON object.");
  }
  const storageLocation = requiredText(req.body.storageLocation, "Storage location", 160);
  const [result] = await pool.execute(
    `UPDATE items SET status = 'received_by_staff', storage_location = ?
     WHERE id = ? AND type = 'found' AND status = 'with_finder'`,
    [storageLocation, id],
  );
  if (!result.affectedRows) throw conflict("Only a found item still with its finder can be received.");
  res.json({ item: { id, status: "received_by_staff", storage_location: storageLocation } });
}));

router.patch("/items/:id/verify", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");

  const status = await transaction(async (connection) => {
    const [items] = await connection.execute(
      "SELECT id, type, status FROM items WHERE id = ? FOR UPDATE",
      [id],
    );
    if (!items.length || items[0].type !== "found" || items[0].status !== "received_by_staff") {
      throw conflict("Receive the found item before verifying it.");
    }
    const [pending] = await connection.execute(
      "SELECT COUNT(*) AS count FROM claims WHERE item_id = ? AND status = 'pending'",
      [id],
    );
    const nextStatus = Number(pending[0].count) ? "awaiting_claim_review" : "verified";
    await connection.execute("UPDATE items SET status = ? WHERE id = ?", [nextStatus, id]);
    return nextStatus;
  });
  res.json({ item: { id, status } });
}));

router.patch("/items/:id/claims/:claimId", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  const claimId = parseId(req.params.claimId);
  if (!id || !claimId) throw invalid("Item or claim ID is invalid.");
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body) ||
      !["approved", "declined"].includes(req.body.status)) {
    throw invalid("Claim status must be approved or declined.");
  }

  const status = req.body.status;
  const updated = await transaction(async (connection) => {
    const [items] = await connection.execute(
      "SELECT id, type, status FROM items WHERE id = ? FOR UPDATE",
      [id],
    );
    const item = items[0];
    if (!item) throw conflict("Item not found.");
    if (item.type === "lost" && item.status === "lost_reported" && status === "declined") {
      const [legacyClaims] = await connection.execute(
        "SELECT id, status FROM claims WHERE id = ? AND item_id = ? FOR UPDATE",
        [claimId, id],
      );
      if (!legacyClaims.length || legacyClaims[0].status !== "pending") throw conflict("Pending claim not found.");
      await connection.execute("UPDATE claims SET status = 'declined' WHERE id = ?", [claimId]);
      return { itemStatus: item.status };
    }
    if (item.type !== "found" || !["verified", "awaiting_claim_review"].includes(item.status)) {
      throw conflict("Claims can only be decided after a found item is received and verified.");
    }
    const [claims] = await connection.execute(
      "SELECT id, status FROM claims WHERE id = ? AND item_id = ? FOR UPDATE",
      [claimId, id],
    );
    if (!claims.length || claims[0].status !== "pending") throw conflict("Pending claim not found.");
    await connection.execute("UPDATE claims SET status = ? WHERE id = ?", [status, claimId]);

    let itemStatus = item.status;
    if (status === "approved") {
      await connection.execute(
        "UPDATE claims SET status = 'declined' WHERE item_id = ? AND id <> ? AND status = 'pending'",
        [id, claimId],
      );
      itemStatus = "approved_for_pickup";
      await connection.execute("UPDATE items SET status = ? WHERE id = ?", [itemStatus, id]);
    } else {
      const [pending] = await connection.execute(
        "SELECT COUNT(*) AS count FROM claims WHERE item_id = ? AND status = 'pending'",
        [id],
      );
      if (!Number(pending[0].count)) {
        itemStatus = "verified";
        await connection.execute("UPDATE items SET status = ? WHERE id = ?", [itemStatus, id]);
      }
    }
    return { itemStatus };
  });
  res.json({ claim: { id: claimId, status }, item: { id, status: updated.itemStatus } });
}));

router.patch("/items/:id/resolve", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const [result] = await pool.execute(
    `UPDATE items SET status_before_resolved = status, status = 'resolved'
     WHERE id = ? AND type = 'found' AND status = 'approved_for_pickup'`,
    [id],
  );
  if (!result.affectedRows) throw conflict("Only an approved found item can be marked resolved.");
  res.json({ item: { id, status: "resolved" } });
}));

router.patch("/items/:id/reopen", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const status = await transaction(async (connection) => {
    const [items] = await connection.execute(
      "SELECT id, type, status, status_before_resolved FROM items WHERE id = ? FOR UPDATE",
      [id],
    );
    const item = items[0];
    if (!item || item.status !== "resolved") throw conflict("Resolved item not found.");
    const restoredStatus = item.status_before_resolved ||
      (item.type === "found" ? "with_finder" : "lost_reported");
    await connection.execute(
      "UPDATE items SET status = ?, status_before_resolved = NULL WHERE id = ?",
      [restoredStatus, id],
    );
    return restoredStatus;
  });
  res.json({ item: { id, status } });
}));

module.exports = router;

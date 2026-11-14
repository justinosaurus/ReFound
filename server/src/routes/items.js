const crypto = require("node:crypto");
const express = require("express");
const fs = require("node:fs/promises");
const path = require("node:path");
const multer = require("multer");
const pool = require("../config/db");
const { scoreMatch } = require("../lib/matching");

const router = express.Router();
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const publicFields = "id, type, title, description, category, location, event_date, status, photo_url, created_at";
const uploadsDirectory = path.join(__dirname, "..", "..", "uploads");
const photoExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const photoUpload = multer({
  storage: multer.diskStorage({
    destination(req, _file, callback) {
      fs.mkdir(uploadsDirectory, { recursive: true }).then(
        () => callback(null, uploadsDirectory),
        callback,
      );
    },
    filename(_req, file, callback) {
      callback(null, `${crypto.randomBytes(16).toString("hex")}${photoExtensions[file.mimetype]}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 8, parts: 9, fieldSize: 4000 },
  fileFilter(_req, file, callback) {
    if (!photoExtensions[file.mimetype]) {
      return callback(invalid("Choose a JPG, PNG, or WebP photo."));
    }
    callback(null, true);
  },
});

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

function requiredText(value, field, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw invalid(`${field} is required and must be at most ${maxLength} characters.`);
  }
  return value.trim();
}

function parseId(value) {
  if (!/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

function validDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

async function validPhoto(file) {
  const header = await fs.readFile(file.path);
  if (file.mimetype === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  if (file.mimetype === "image/png") {
    return header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return file.mimetype === "image/webp" &&
    header.toString("ascii", 0, 4) === "RIFF" &&
    header.toString("ascii", 8, 12) === "WEBP";
}

router.get("/", asyncHandler(async (req, res) => {
  const { type, q, category } = req.query;
  if (type && !["lost", "found"].includes(type)) throw invalid("Type must be lost or found.");
  if (q !== undefined && (typeof q !== "string" || q.length > 100)) throw invalid("Search must be at most 100 characters.");
  if (category !== undefined && (typeof category !== "string" || category.length > 60)) throw invalid("Category must be at most 60 characters.");

  const conditions = ["status <> 'resolved'"];
  const values = [];
  if (type) {
    conditions.push("type = ?");
    values.push(type);
  }
  if (category) {
    conditions.push("category = ?");
    values.push(category);
  }
  if (q && q.trim()) {
    conditions.push("(title LIKE ? OR description LIKE ? OR location LIKE ?)");
    const term = `%${q.trim()}%`;
    values.push(term, term, term);
  }

  const [items] = await pool.execute(
    `SELECT ${publicFields} FROM items WHERE ${conditions.join(" AND ")} ORDER BY created_at DESC LIMIT 100`,
    values,
  );
  res.json({ items });
}));

router.post("/", photoUpload.single("photo"), asyncHandler(async (req, res) => {
  let itemCreated = false;
  try {
    const body = bodyObject(req);
    if (!["lost", "found"].includes(body.type)) throw invalid("Type must be lost or found.");

    const title = requiredText(body.title, "Title", 120);
    const description = requiredText(body.description, "Description", 2000);
    const category = requiredText(body.category, "Category", 60);
    const location = requiredText(body.location, "Location", 160);
    const contactName = requiredText(body.contactName, "Contact name", 100);
    const contactEmail = requiredText(body.contactEmail, "Contact email", 254).toLowerCase();
    if (!emailPattern.test(contactEmail)) throw invalid("Enter a valid contact email address.");
    if (!validDate(body.eventDate)) throw invalid("Enter a valid item date.");
    if (req.file && !(await validPhoto(req.file))) throw invalid("The selected file is not a valid JPG, PNG, or WebP image.");

    const managementToken = crypto.randomBytes(32).toString("base64url");
    const tokenHash = crypto.createHash("sha256").update(managementToken).digest("hex");
    const photoUrl = req.file ? `/uploads/${path.basename(req.file.filename)}` : null;
    const [result] = await pool.execute(
      `INSERT INTO items
        (type, title, description, category, location, event_date, contact_name, contact_email, photo_url, management_token_hash, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        body.type, title, description, category, location, body.eventDate, contactName, contactEmail,
        photoUrl, tokenHash, body.type === "found" ? "with_finder" : "lost_reported",
      ],
    );
    itemCreated = true;
    const [items] = await pool.execute(`SELECT ${publicFields} FROM items WHERE id = ?`, [result.insertId]);
    res.status(201).json({ item: items[0], managementToken });
  } catch (error) {
    if (req.file && !itemCreated) await fs.rm(req.file.path, { force: true });
    throw error;
  }
}));

router.get("/:id/matches", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const [items] = await pool.execute(
    `SELECT ${publicFields} FROM items WHERE id = ? AND status NOT IN ('approved_for_pickup', 'resolved')`,
    [id],
  );
  if (!items.length) return res.status(404).json({ error: "Item not found." });

  const [candidates] = await pool.execute(
    `SELECT ${publicFields} FROM items
     WHERE type <> ? AND status NOT IN ('approved_for_pickup', 'resolved') AND id <> ?
     ORDER BY created_at DESC LIMIT 300`,
    [items[0].type, id],
  );
  const matches = candidates
    .map((item) => ({ ...item, matchScore: scoreMatch(items[0], item) }))
    .filter((item) => item.matchScore >= 20)
    .sort((a, b) => b.matchScore - a.matchScore || new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);
  res.json({ matches });
}));

router.post("/:id/claims", asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) throw invalid("Item ID is invalid.");
  const body = bodyObject(req);
  const claimantName = requiredText(body.claimantName, "Name", 100);
  const claimantEmail = requiredText(body.claimantEmail, "Email", 254).toLowerCase();
  const message = requiredText(body.message, "Message", 2000);
  if (!emailPattern.test(claimantEmail)) throw invalid("Enter a valid email address.");

  try {
    const claimId = await (async () => {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        const [items] = await connection.execute(
          "SELECT id, type, status FROM items WHERE id = ? AND status NOT IN ('approved_for_pickup', 'resolved') FOR UPDATE",
          [id],
        );
        if (!items.length) {
          const error = new Error("Open item not found.");
          error.status = 404;
          throw error;
        }
        if (items[0].type !== "found") {
          const error = new Error("Claims are submitted on found-item reports. If you found this item, report it as found.");
          error.status = 400;
          throw error;
        }
        const [result] = await connection.execute(
          "INSERT INTO claims (item_id, claimant_name, claimant_email, message) VALUES (?, ?, ?, ?)",
          [id, claimantName, claimantEmail, message],
        );
        if (items[0].status === "verified") {
          await connection.execute("UPDATE items SET status = 'awaiting_claim_review' WHERE id = ?", [id]);
        }
        await connection.commit();
        return result.insertId;
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    })();
    res.status(201).json({ claim: { id: claimId, status: "pending" } });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ error: "A claim from this email is already on this item." });
    }
    throw error;
  }
}));

module.exports = router;

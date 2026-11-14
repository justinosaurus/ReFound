const fs = require("node:fs/promises");
const path = require("node:path");
const pool = require("./db");

async function initializeDatabase() {
  const schemaPath = path.join(__dirname, "..", "db", "schema.sql");
  const schema = await fs.readFile(schemaPath, "utf8");
  const statements = schema
    .split(";")
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const statement of statements) {
    await pool.query(statement);
  }

  const [itemColumns] = await pool.execute(
    "SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items'",
  );
  const itemColumnNames = new Set(itemColumns.map((column) => column.COLUMN_NAME));
  if (!itemColumnNames.has("storage_location")) {
    await pool.query("ALTER TABLE items ADD COLUMN storage_location VARCHAR(160) NULL");
  }
  if (!itemColumnNames.has("photo_url")) {
    await pool.query("ALTER TABLE items ADD COLUMN photo_url VARCHAR(255) NULL");
  }
  if (!itemColumnNames.has("status_before_resolved")) {
    await pool.query(
      `ALTER TABLE items ADD COLUMN status_before_resolved ENUM(
        'lost_reported', 'with_finder', 'received_by_staff', 'verified',
        'awaiting_claim_review', 'approved_for_pickup'
      ) NULL`,
    );
  }

  const [itemStatusColumns] = await pool.execute(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'items' AND COLUMN_NAME = 'status'",
  );
  if (itemStatusColumns[0]?.COLUMN_TYPE.includes("'open'")) {
    await pool.query(
      `ALTER TABLE items MODIFY status ENUM(
        'open', 'resolved', 'lost_reported', 'with_finder', 'received_by_staff',
        'verified', 'awaiting_claim_review', 'approved_for_pickup'
      ) NOT NULL DEFAULT 'lost_reported'`,
    );
    await pool.query(
      `UPDATE items SET status = CASE
        WHEN status = 'open' AND type = 'found' THEN 'with_finder'
        WHEN status = 'open' THEN 'lost_reported'
        ELSE status
      END`,
    );
    await pool.query(
      `ALTER TABLE items MODIFY status ENUM(
        'lost_reported', 'with_finder', 'received_by_staff', 'verified',
        'awaiting_claim_review', 'approved_for_pickup', 'resolved'
      ) NOT NULL DEFAULT 'lost_reported'`,
    );
  }

  const [claimStatusColumns] = await pool.execute(
    "SELECT COLUMN_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'claims' AND COLUMN_NAME = 'status'",
  );
  if (claimStatusColumns[0]?.COLUMN_TYPE.includes("'accepted'")) {
    await pool.query(
      "ALTER TABLE claims MODIFY status ENUM('pending', 'accepted', 'approved', 'declined') NOT NULL DEFAULT 'pending'",
    );
    await pool.query("UPDATE claims SET status = 'pending' WHERE status = 'accepted'");
    await pool.query(
      "ALTER TABLE claims MODIFY status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending'",
    );
  }

  await createInitialStaffUser();
}

async function createInitialStaffUser() {
  const username = process.env.STAFF_USERNAME?.trim().toLowerCase();
  const password = process.env.STAFF_PASSWORD;
  if (!username && !password) {
    console.warn("Staff login is not configured. Set STAFF_USERNAME and STAFF_PASSWORD to create the initial staff account.");
    return;
  }
  if (!username || !password || password.length < 12) {
    throw new Error("Set both STAFF_USERNAME and STAFF_PASSWORD; the staff password must be at least 12 characters.");
  }

  const crypto = require("node:crypto");
  const { promisify } = require("node:util");
  const scrypt = promisify(crypto.scrypt);
  const [existingUsers] = await pool.execute("SELECT id FROM staff_users WHERE username = ?", [username]);
  if (existingUsers.length) return;

  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scrypt(password, salt, 64);
  const passwordHash = `scrypt$${salt}$${derivedKey.toString("hex")}`;
  await pool.execute("INSERT INTO staff_users (username, password_hash) VALUES (?, ?)", [username, passwordHash]);
}

module.exports = initializeDatabase;

CREATE TABLE IF NOT EXISTS items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  type ENUM('lost', 'found') NOT NULL,
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(60) NOT NULL,
  location VARCHAR(160) NOT NULL,
  event_date DATE NOT NULL,
  contact_name VARCHAR(100) NOT NULL,
  contact_email VARCHAR(254) NOT NULL,
  photo_url VARCHAR(255) NULL,
  management_token_hash CHAR(64) NOT NULL,
  status ENUM(
    'lost_reported',
    'with_finder',
    'received_by_staff',
    'verified',
    'awaiting_claim_review',
    'approved_for_pickup',
    'resolved'
  ) NOT NULL DEFAULT 'lost_reported',
  storage_location VARCHAR(160) NULL,
  status_before_resolved ENUM(
    'lost_reported',
    'with_finder',
    'received_by_staff',
    'verified',
    'awaiting_claim_review',
    'approved_for_pickup'
  ) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_status_type_date (status, type, event_date),
  KEY idx_items_category (category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS claims (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id BIGINT UNSIGNED NOT NULL,
  claimant_name VARCHAR(100) NOT NULL,
  claimant_email VARCHAR(254) NOT NULL,
  message TEXT NOT NULL,
  status ENUM('pending', 'approved', 'declined') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_claim_item_email (item_id, claimant_email),
  KEY idx_claims_item_status (item_id, status),
  CONSTRAINT fk_claims_item FOREIGN KEY (item_id) REFERENCES items (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS staff_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_staff_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

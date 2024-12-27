CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  is_2fa_enabled BOOLEAN DEFAULT FALSE,
  two_fa_code VARCHAR(6),
  two_fa_code_expiry TIMESTAMP
);

CREATE TABLE blacklisted_tokens (
    token TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

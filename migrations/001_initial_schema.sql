CREATE TABLE IF NOT EXISTS template_cleaning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  max_users INTEGER,
  place TEXT,
  name TEXT,
  instructions TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  discord_id TEXT UNIQUE NOT NULL,
  has_role BOOLEAN NOT NULL,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cleaning (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  finished INTEGER DEFAULT 0,
  started BOOLEAN,
  sent_next_week_message BOOLEAN,
  date_start DATE,
  date_end DATE,
  discord_thread_id TEXT,
  instruction_message_id TEXT,
  template_rel INTEGER,
  FOREIGN KEY(template_rel) REFERENCES template_cleaning(id)
);

CREATE TABLE IF NOT EXISTS cleaning_participants (
  cleaning_id INTEGER,
  user_id INTEGER,
  PRIMARY KEY (cleaning_id, user_id),
  FOREIGN KEY (cleaning_id) REFERENCES cleaning(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_cleaning_date ON cleaning(date_start);
CREATE INDEX IF NOT EXISTS idx_cleaning_template ON cleaning(template_rel);

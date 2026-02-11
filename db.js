import Database from 'better-sqlite3';
const db = new Database('uklidy.db');

import { cleaning_role } from './config.js';

let bot;

export function db_init(bot_instance) {
  bot = bot_instance;

  db.prepare(`CREATE TABLE IF NOT EXISTS template_cleaning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    max_users INTEGER,
    place TEXT,
    name TEXT,
    instructions TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discord_id TEXT UNIQUE NOT NULL
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS cleaning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    finished INTEGER DEFAULT 0,
    date_start DATE,
    date_end DATE,
    template_rel INTEGER,
    FOREIGN KEY(template_rel) REFERENCES template_cleaning(id)
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS cleaning_participants (
    cleaning_id INTEGER,
    user_id INTEGER,
    PRIMARY KEY (cleaning_id, user_id),
    FOREIGN KEY (cleaning_id) REFERENCES cleaning(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  )`).run();

  sync_users(bot.guild_fetched);
}

async function sync_users(guild) {
  const members = await guild.members.fetch();
  const eligible_members = members.filter(m => m.roles.cache.has(CLEANING_ROLE) && !m.user.bot);

  const insert_user = db.prepare(`
    INSERT INTO users (discord_id)
    VALUES (?)
    ON CONFLICT(discord_id) DO NOTHING
  `);

  const sync_transaction = db.transaction((member_list) => {
    for (const [id, member] of member_list) {
      insert_user.run(id);
    }
  });

  sync_transaction(eligible_members);
  console.log(`Synced ${eligible_members.size} users.`);
}

// Add functions
const _create_cleaning = ({template_id, date_start, date_end}) => {
  const stmt = db.prepare(`
    INSERT INTO cleaning 
    (users, finished, date_start, date_end, template_rel) VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(null, 0, date_start, date_end, template_id);
  return info.lastInsertRowid;
}

const _create_cleaning_template = ({max_users, place, name, instructions}) => {
  const stmt = db.prepare(`
    INSERT INTO template_cleaning 
    (max_users, place, name, instructions) VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(max_users, place, name, instructions);
  return info.lastInsertRowid;
};


// Log functions to combine with add functions
function send_log(message) {
  bot.send_log("```" + message + "```");
}

const _log_cleaning_created = (prev_ret, {template_id, date_start, date_end}) => {
  let log_message = `Created cleaning with template ${template_id} \n`
  log_message += `From ${date_start} to ${date_end}`;

  send_log(log_message)
}

const _log_template_created = (prev_ret, { name }) => {
  let log_message = `Created template ${name}`; 
  send_log(log_message);
};

// Combined functions
/**
 * @template {Array<any>} T
 * @template R
 * @param {(...args: T) => R} task_fn
 * @param {(result: R, ...args: T) => void} log_fn
 * @returns {(...args: T) => R}
 */
const with_logging = (task_fn, log_fn) => {
  return (...args) => {
    const result = task_fn(...args);
    log_fn(result, ...args);
    return result;
  };
};

export const create_cleaning_logged = with_logging(_create_cleaning, _log_cleaning_created);
export const create_template_logged = with_logging(_create_cleaning_template, _log_template_created);

// Get functions
export function get_cleanings(start_date, end_date) {
  try {
    console.log("Fetching dates from " + start_date + " to " + end_date);

    let sql = `SELECT c.id, c.users, c.finished, c.date_start, c.date_end, c.template_rel,
                      t.max_users, t.place, t.name, t.instructions
               FROM cleaning c
               LEFT JOIN template_cleaning t ON c.template_rel = t.id
               WHERE date_start BETWEEN ? AND ?`;

    const stmt = db.prepare(sql);
    const rows = stmt.all(start_date, end_date);
    return rows.map(r => ({
      id: r.id,
      users: r.users ? r.users.split(',').map(u => u.trim()) : [],
      finished: !!r.finished,
      date_start: r.date_start,
      date_end: r.date_end,
      template_rel: r.template_rel,
      template: {
        max_users: r.max_users,
        place: r.place,
        name: r.name,
        instructions: r.instructions
      }
    }));
  } catch (err) {
    console.error("get_cleanings error:", err);
    return [];
  }
}

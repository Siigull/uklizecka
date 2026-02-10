import Database from 'better-sqlite3';
const db = new Database('uklidy.db');
db.leave_locked = false;

import { CLEANING_ROLE, MANAGER_ROLE } from './config.js';
import fs from 'fs';

let bot;

export function lock_leave() {
  db.leave_locked = !db.leave_locked;
  return db.leave_locked;
} 

export function run_migrations() {
  const applied = db.prepare('SELECT name FROM migrations').all().map(row => row.name);

  const migrationDirUrl = new URL('./migrations/', import.meta.url);
  const files = fs
    .readdirSync(migrationDirUrl, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith('.sql'))
    .map((d) => d.name)
    .sort();

  for (const file of files) {
    if (applied.includes(file)) continue;

    const sql = fs.readFileSync(new URL(file, migrationDirUrl), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO migrations (name) VALUES (?)').run(file);
    console.log(`Applied migration: ${file}`);
  }
}

export function init(bot_instance) {
  bot = bot_instance;

  db.prepare(`CREATE TABLE IF NOT EXISTS migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`).run();

  run_migrations();

  db.leave_locked = false;
}

export async function sync_users(guild) {
  await guild.fetchAllMembers();
  const members = await guild.members;
  const eligible_members = members.filter(m => !m.user.bot);

  let updated_user_count = 0;

  const sync_transaction = db.transaction((member_list) => {
    for (const member of member_list) {
      let id = member.id;
      let nick = member.nick ? member.nick : member.user.username;
      let has_role = member.roles.includes(CLEANING_ROLE) ? 1 : 0;

      // Could be optimized. This prepares every statement.
      let info = add_update_user_logged({
        discord_id: id,
        name: nick,
        has_role: has_role
      });

      if (info.changes) {
        updated_user_count++;
      }
    }
  });

  sync_transaction(eligible_members);
  console.log(`Synced ${updated_user_count} users.`);
}

// -- Add functions
const _create_cleaning = ({template_id, date_start, date_end, discord_thread_id}) => {
  const overlap_stmt = db.prepare(`
    SELECT COUNT(*) AS count FROM cleaning
    WHERE template_rel = ?
      AND NOT (date_end < ? OR date_start > ?)
  `);
  const overlap = overlap_stmt.get(template_id, date_start, date_end);

  if (overlap.count > 0) {
    throw new Error('Cleaning with this template overlaps with an existing cleaning.');
  }

  const stmt = db.prepare(`
    INSERT INTO cleaning 
    (finished, started, date_start, date_end, discord_thread_id, template_rel) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const info = stmt.run(0, 0, date_start, date_end, discord_thread_id, template_id);
  return info;
}


/**
 * Creates cleaning entries based on a template and a list of date ranges.
 *
 * @param {Object} input - The destructured input object.
 * @param {Array<[string, string, string, string]>} input.cleaning_list - [{template_id, start_date, end_date, discord_thread_id}], date YYYY-MM-DD.
 */
const _create_cleanings = ({cleaning_list}) => {
  const sync_transaction = db.transaction((cleaning_list) => {
    for (const c of cleaning_list) {
      create_cleaning_logged({template_id: c.template_id, date_start: c.date_start, 
                              date_end: c.date_end, discord_thread_id: c.discord_thread_id});
    }
  });

  sync_transaction(cleaning_list);
}

const _create_cleaning_template = ({max_users, place, name, instructions}) => {
  const stmt = db.prepare(`
    INSERT INTO template_cleaning 
    (max_users, place, name, instructions) VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(max_users, place, name, instructions);
  return info;
};

const _update_cleaning_template = ({id, max_users, place, name, instructions}) => {
  // TODO(Sigull): Handle when theoretically unable. e.g. More current users than max_users.
  const stmt = db.prepare(`
    UPDATE template_cleaning
    SET max_users = ?, place = ?, name = ?, instructions = ?
    WHERE id = ?
  `);

  const info = stmt.run(max_users, place, name, instructions, id);
  return info;
}

const _start_cleaning = ({cleaning_id}) => {
  const stmt = db.prepare(`
    UPDATE cleaning
    SET started = 1
    WHERE id = ?
  `);

  const info = stmt.run(cleaning_id);
  return info;
}

const _finish_cleaning = ({member_id, cleaning_id}) => {
  // Check if member is a participant in the cleaning
  const user = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(member_id);
  if (!user) {
    throw new Error(`User with discord_id ${member_id} not found.`);
  }
  const participant = db.prepare(`
    SELECT 1 FROM cleaning_participants WHERE cleaning_id = ? AND user_id = ?
  `).get(cleaning_id, user.id);
  if (!participant) {
    throw new Error(`User with discord_id ${member_id} is not a participant in cleaning ${cleaning_id}.`);
  }
  const stmt = db.prepare(`
    UPDATE cleaning
    SET finished = 1
    WHERE id = ?
  `);
  const info = stmt.run(cleaning_id);
  return info;
}

const _add_update_user = ({discord_id, name, has_role}) => {
  const stmt = db.prepare(`
    INSERT INTO users (discord_id, has_role, name)
    VALUES (?, ?, ?)
    ON CONFLICT(discord_id) DO UPDATE SET
      name = EXCLUDED.name,
      has_role = EXCLUDED.has_role
    WHERE name IS NOT EXCLUDED.name 
      OR has_role IS NOT EXCLUDED.has_role;
  `);

  const info = stmt.run(discord_id, has_role ? 1 : 0, name);
  return info;
}

const _user_join_cleaning = ({discord_id, cleaning_id}) => {
  const user = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discord_id);
  const cleaning = get_cleaning_by_id(cleaning_id);
  const now = new Date();

  if (!user) {
    throw new Error(`User with discord_id: ${discord_id} not found.`);
  }
  if (!cleaning) {
    throw new Error(`Cleaning with id: ${cleaning_id} not found.`);
  }
  if (cleaning.finished) {
    throw new Error(`Can't join finished cleaning with id: ${cleaning_id}`);
  }
  if (cleaning.users.find(u => u.discord_id === discord_id)) {
    throw new Error(`Can't join cleaning you are already a part of.`);
  }
  if (cleaning.users.length >= cleaning.template.max_users) {
    throw new Error(`Can't join full cleaning with id: ${cleaning_id}.`);
  }
  if (cleaning.date_end < now.toISOString().split('T')[0]) {
    throw new Error(`Can't join cleaning which ended in the past.`);
  }
  if (cleaning.started) {
    bot.send_imp_log(`User ${user.name} joined a cleaning ${cleaning.id} which has already started.`);
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO cleaning_participants (cleaning_id, user_id)
    VALUES (?, ?)
  `);

  const info = stmt.run(cleaning_id, user.id);
  return info;
};

const _user_leave_cleaning = ({discord_id, cleaning_id}) => {
  const user = db.prepare('SELECT id FROM users WHERE discord_id = ?').get(discord_id);
  const cleaning = get_cleaning_by_id(cleaning_id);

  if (!user) {
    throw new Error(`User with discord_id ${discord_id} not found.`);
  }
  if (!cleaning) {
    throw new Error(`Cleaning with id ${discord_id} doesn't exist.`);
  }
  if (!cleaning.users.some(user => user.discord_id == discord_id)) {
    throw new Error(`You cannot leave a cleaning you are not a part of.`)
  }
  if (cleaning.finished) {
    throw new Error(`Why would you want to leave a finished cleaning.`);
  }
  if (cleaning.started && db.leave_locked) {
    throw new Error(`You can't leave a cleaning that has already started. Write to <@${MANAGER_ROLE}>.`);
  }

  const stmt = db.prepare(`
    DELETE FROM cleaning_participants 
    WHERE cleaning_id = ? AND user_id = ?
  `);

  const info = stmt.run(cleaning_id, user.id);
  return info;
};

// -- Log functions to combine with add functions
async function send_log(message) {
  await bot.send_log(message);
}

async function send_imp_log(message) {
  await bot.send_imp_log(message);
}

const _log_cleaning_created = (prev_ret, {template_id, date_start, date_end}) => {
  let log_message = `Created cleaning with template ${template_id} \n`
  log_message += `From ${date_start} to ${date_end}`;

  send_log(log_message)
}

const _log_cleanings_created = (prev_ret, {cleanings}) => {
  let log_message = `Finished create group of cleanings.`;

  send_log(log_message);
}

const _log_template_created = (prev_ret, { name }) => {
  let log_message = `Created template ${name}`; 
  send_log(log_message);
};

const _log_template_updated = (prev_ret, { id, max_users, place, name, instructions }) => {
  if (prev_ret.changes > 0) {
    let log_message = `Edited cleaning with id ${id}`;
    send_log(log_message);
  }
}

const _log_start_cleaning = (prev_ret, { cleaning_id }) => {
  let log_message = `Started cleaning ${cleaning_id}`;
  send_log(log_message);
}

const _log_finish_cleaning = (prev_ret, { cleaning_id }) => {
  let log_message = `Finished cleaning with id ${cleaning_id}`;
  send_log(log_message);
};

const _log_add_update_user = (prev_ret, { discord_id, name, has_role }) => {
  // New user was added
  if (prev_ret.changes > 0 && prev_ret.lastInsertRowid > 0) {
    let log_message = `User ${name} now has to clean`;
    send_log(log_message);

  // Just nickname change
  } else if (prev_ret.changes > 0) {
    console.log(`${discord_id} changed their nickname`);
  }
}

const _log_user_join_cleaning = (prev_ret, { discord_id, cleaning_id }) => {
  if (prev_ret.changes > 0) {
    send_log(`User <@${discord_id}> joined cleaning #${cleaning_id}`);
  }
};

const _log_user_leave_cleaning = (prev_ret, { discord_id, cleaning_id }) => {
  if (prev_ret.changes > 0) {
    send_imp_log(`User <@${discord_id}> left cleaning #${cleaning_id}`);
  }
};

// -- Combined functions
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

export const create_cleaning_logged     = with_logging(_create_cleaning, _log_cleaning_created);
export const create_cleanings_logged    = with_logging(_create_cleanings, _log_cleanings_created);
export const create_template_logged     = with_logging(_create_cleaning_template, _log_template_created);
export const update_template_logged     = with_logging(_update_cleaning_template, _log_template_updated);
export const start_cleaning_logged      = with_logging(_start_cleaning, _log_start_cleaning);
export const finish_cleaning_logged     = with_logging(_finish_cleaning, _log_finish_cleaning);
export const add_update_user_logged     = with_logging(_add_update_user, _log_add_update_user);
export const user_join_cleaning_logged  = with_logging(_user_join_cleaning, _log_user_join_cleaning);
export const user_leave_cleaning_logged = with_logging(_user_leave_cleaning, _log_user_leave_cleaning);

/**
 * Fetches all registered users from the database.
 * @returns {Array<{id: number, discord_id: string, name: string}>}
 */
export function get_users() {
  try {
    const stmt = db.prepare('SELECT id, discord_id, has_role, name FROM users');
    return stmt.all();
  } catch (err) {
    console.error("get_users error:", err);
    return [];
  }
}

// Get functions
export function get_cleanings(start_date, end_date) {
  try {
    let sql = `
      SELECT 
          c.id, c.finished, c.started, c.date_start, c.date_end, c.discord_thread_id, c.template_rel, 
          t.max_users, t.place, t.name, t.instructions,
          -- This creates a JSON array of objects: [{"id": "123", "n": "Alice"}, {"id": "456", "n": "Bob"}]
          '[' || IFNULL(
              GROUP_CONCAT(
                  CASE WHEN u.id IS NOT NULL 
                  THEN JSON_OBJECT('discord_id', u.discord_id, 'name', u.name, 'has_role', u.has_role) 
                  ELSE NULL END
              ), 
              ''
          ) || ']' AS participants
      FROM cleaning c
      LEFT JOIN template_cleaning t ON c.template_rel = t.id
      LEFT JOIN cleaning_participants cp ON c.id = cp.cleaning_id
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.date_start >= ? AND c.date_end <= ?
      GROUP BY c.id;
    `;

    const stmt = db.prepare(sql);
    const rows = stmt.all(start_date, end_date);

    return rows.map(r => ({
      id: r.id,
      users: JSON.parse(r.participants || '[]'),
      finished: !!r.finished,
      started: !!r.started,
      date_start: r.date_start,
      date_end: r.date_end,
      discord_thread_id: r.discord_thread_id,
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

/**
 * Fetches a single cleaning record by its ID, including template info and participants.
 * @param {number|string} cleaning_id
 * @returns {Object|null} The cleaning object or null if not found.
 */
export function get_cleaning_by_id(cleaning_id) {
  try {
    const sql = `
      SELECT 
          c.id, c.finished, c.started, c.date_start, c.date_end, c.discord_thread_id, c.template_rel, 
          t.max_users, t.place, t.name, t.instructions,
          '[' || IFNULL(
              GROUP_CONCAT(
                  CASE WHEN u.id IS NOT NULL 
                  THEN JSON_OBJECT('discord_id', u.discord_id, 'name', u.name, 'has_role', u.has_role) 
                  ELSE NULL END
              ), 
              ''
          ) || ']' AS participants
      FROM cleaning c
      LEFT JOIN template_cleaning t ON c.template_rel = t.id
      LEFT JOIN cleaning_participants cp ON c.id = cp.cleaning_id
      LEFT JOIN users u ON cp.user_id = u.id
      WHERE c.id = ?
      GROUP BY c.id;
    `;

    const row = db.prepare(sql).get(cleaning_id);

    if (!row) return null;

    return {
      id: row.id,
      users: JSON.parse(row.participants || '[]'),
      finished: !!row.finished,
      started: !!row.started,
      date_start: row.date_start,
      date_end: row.date_end,
      discord_thread_id: row.discord_thread_id,
      template_rel: row.template_rel,
      template: {
        max_users: row.max_users,
        place: row.place,
        name: row.name,
        instructions: row.instructions
      }
    };
  } catch (err) {
    console.error(`get_cleaning_by_id error for ID ${cleaning_id}:`, err);
    return null;
  }
}

/**
 * Fetches all cleaning templates.
 * @returns {Array<{id: number, max_users: number, place: string, name: string, instructions: string}>}
 */
export function get_templates() {
  try {
    const stmt = db.prepare('SELECT * FROM template_cleaning');
    return stmt.all();
  } catch (err) {
    console.error("get_templates error:", err);
    return [];
  }
}

export function get_template_by_id(template_id) {
  const stmt = db.prepare(`
    SELECT * FROM template_cleaning t 
    WHERE t.id = ?
  `);
  return stmt.get(template_id);
}

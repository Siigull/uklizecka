// DB STUFF
const Database = require('better-sqlite3');
const db = new Database('uklidy.db');

function db_init() {
  db.prepare(`CREATE TABLE IF NOT EXISTS template_cleaning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    max_users INTEGER,
    place TEXT,
    name TEXT,
    instructions TEXT
  )`).run();

  db.prepare(`CREATE TABLE IF NOT EXISTS cleaning (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    users TEXT,
    finished INTEGER,
    date_start DATE,
    date_end DATE,
    template_rel INTEGER,
    FOREIGN KEY(template_rel) REFERENCES template_cleaning(id)
  )`).run();
}

function create_cleaning_template({ max_users, place, name, instructions }) {
  const stmt = db.prepare(`
    INSERT INTO template_cleaning 
    (max_users, place, name, instructions) VALUES (?, ?, ?, ?)
  `);
  const info = stmt.run(max_users, place, name, instructions);
  return info.lastInsertRowid;
}

function create_cleaning(template_id, { date_start, date_end }) {
  const stmt = db.prepare(`
    INSERT INTO cleaning 
    (users, finished, date_start, date_end, template_rel) VALUES (?, ?, ?, ?, ?)
  `);
  const info = stmt.run(null, 0, date_start, date_end, template_id);
  return info.lastInsertRowid;
}

function get_cleanings(start_date, end_date) {
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

// BOT
const cron = require('node-cron');
const Eris = require("eris");

const test_ch = "1470612014543011942"
const bot = new Eris.CommandClient(process.env.BOT_TOKEN, {}, {  
    description: "A test bot made with Eris",
    owner: "somebody",
    prefix: "!"
});

async function send_notification() {
  return bot.createMessage(test_ch, "dd", null).catch(err => {
    console.log("Unauthorized to send message: ", err);
  })
}

const formatDate = (date) => date.toISOString().split('T')[0];

// get all cleanings from previous, this, next weeks
function get_cleanings_notify() {
  const now = new Date();
  const currentDay = now.getDay(); 
  const diffToMon = currentDay === 0 ? -6 : 1 - currentDay;
  
  const startThisWeek = new Date(now);
  startThisWeek.setDate(now.getDate() + diffToMon);
  const endThisWeek = new Date(startThisWeek);
  endThisWeek.setDate(startThisWeek.getDate() + 6);

  const startPrevWeek = new Date(startThisWeek);
  startPrevWeek.setDate(startThisWeek.getDate() - 7);
  const endPrevWeek = new Date(startPrevWeek);
  endPrevWeek.setDate(startPrevWeek.getDate() + 6);

  const startNextWeek = new Date(startThisWeek);
  startNextWeek.setDate(startThisWeek.getDate() + 7);
  const endNextWeek = new Date(startNextWeek);
  endNextWeek.setDate(startNextWeek.getDate() + 6);

  // Fetch
  const previousWeekCleanings = get_cleanings(formatDate(startPrevWeek), formatDate(endPrevWeek));
  const thisWeekCleanings     = get_cleanings(formatDate(startThisWeek), formatDate(endThisWeek));
  const nextWeekCleanings     = get_cleanings(formatDate(startNextWeek), formatDate(endNextWeek));

  return {
    previous: previousWeekCleanings,
    current: thisWeekCleanings,
    next: nextWeekCleanings
  };
}

function seed_cleanings() {
  template_id = create_cleaning_template()
}

function get_check_cleanings_notify() {
  cleanings = get_cleanings_notify();

  for(let cleaning of cleanings["previous"]) {

  }
}

function schedule_send_notification_event() {
  cron.schedule('47 5 * * *', () => {
    cleanings = check_which_cleanings_notify();
    send_notification();
  
  }, {
    scheduled: true,
    timezone: "Europe/Prague"
  });
}

function startup_bot() {
  // TODO(Sigull): temp
  seed_cleanings();
  schedule_send_notification_event();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  db_init();
  
  bot.on("messageCreate", (msg) => {
    if(msg.content === "!ping") {
      bot.createMessage(msg.channel.id, "Pong!");
    }
  });

  bot.connect();

  bot.on("ready", () => {
    startup_bot();
  })
}

main()

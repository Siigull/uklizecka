// DB STUFF
const Database = require('better-sqlite3');
const db = new Database('uklidy.db');

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

function create_cleaning_template({ max_users, place, name, instructions }) {
  const stmt = db.prepare(`INSERT INTO template_cleaning (max_users, place, name, instructions) VALUES (?, ?, ?, ?)`);
  const info = stmt.run(max_users, place, name, instructions);
  return info.lastInsertRowid;
}

// BOT
const cron = require('node-cron');
const Eris = require("eris");

function get_current_cleanings() {
  time = time.now()
}

cron.schedule('0 16 7 * *', () => {
  cleanings = get_current_cleanings();
}, {
  scheduled: true,
  timezone: "Europe/Prague"
});

const bot = new Eris.CommandClient(process.env.BOT_TOKEN, {}, {  
    description: "A test bot made with Eris",
    owner: "somebody",
    prefix: "!"
});

bot.on("messageCreate", (msg) => {
  if(msg.content === "!ping") {
    bot.createMessage(msg.channel.id, "Pong!");
  }
});

bot.connect();

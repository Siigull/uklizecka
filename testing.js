import * as db from "./db.js";
import * as handler from "./handler.js";

let bot;

let modal;

export function seed_cleanings(bot_instance) {
  bot = bot_instance;

  // TODO(Sigull): Change these to handlers too.
  const bar_template_id = db.create_template_logged({
    max_users: 5,
    place: "Kachna",
    name: "Bar",
    instructions: "uklid to idk"
  }).lastInsertRowid;

  const nabytek_template_id = db.create_template_logged({
    max_users: 3,
    place: "Kachna",
    name: "Kachna",
    instructions: "utri to ig"
  }).lastInsertRowid;

  const satna_template_id = db.create_template_logged({
    max_users: 4,
    place: "Zadní zázemí",
    name: "Šatny dole a nahoře",
    instructions: "Vyluxovat a utřít prach"
  }).lastInsertRowid;

  // --- PREVIOUS WEEK ---
  db.create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-02", 
    date_end: "2026-02-08",
    discord_thread_id: null,
  });
  db.create_cleaning_logged({
    template_id: nabytek_template_id, 
    date_start: "2026-02-02", 
    date_end: "2026-02-08",
    discord_thread_id: null
  });

  // --- THIS WEEK ---
  db.create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });
  db.create_cleaning_logged({
    template_id: nabytek_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });
  db.create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });

  // --- NEXT WEEK ---
  let ret1 = db.create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-16", 
    date_end: "2026-02-22" ,
    discord_thread_id: null
  });
  db.create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-16",
    date_end: "2026-02-22" ,
    discord_thread_id: null
  });

  db.add_update_user_logged({discord_id: "1", name: "jedna", has_role: 0});
  db.add_update_user_logged({discord_id: "2", name: "dva",   has_role: 1});
  db.add_update_user_logged({discord_id: "3", name: "tri",   has_role: 1});

  db.user_join_cleaning_logged({discord_id: "1", cleaning_id: ret1.lastInsertRowid});

  console.log("Seeding complete.");
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

import { create_template_logged, create_cleaning_logged, add_update_user_logged, user_join_cleaning_logged } from "./db.js";

export function seed_cleanings() {
  const bar_template_id = create_template_logged({
    max_users: 5,
    place: "Kachna",
    name: "Bar",
    instructions: "uklid to idk"
  }).lastInsertRowid;

  const nabytek_template_id = create_template_logged({
    max_users: 3,
    place: "Kachna",
    name: "Kachna",
    instructions: "utri to ig"
  }).lastInsertRowid;

  const satna_template_id = create_template_logged({
    max_users: 4,
    place: "Zadní zázemí",
    name: "Šatny dole a nahoře",
    instructions: "Vyluxovat a utřít prach"
  }).lastInsertRowid;

  // --- PREVIOUS WEEK ---
  create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-02", 
    date_end: "2026-02-08",
    discord_thread_id: null,
  });
  create_cleaning_logged({
    template_id: nabytek_template_id, 
    date_start: "2026-02-02", 
    date_end: "2026-02-08",
    discord_thread_id: null
  });

  // --- THIS WEEK ---
  create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });
  create_cleaning_logged({
    template_id: nabytek_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });
  create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15",
    discord_thread_id: null
  });

  // --- NEXT WEEK ---
  let ret1 = create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-16", 
    date_end: "2026-02-22" ,
    discord_thread_id: null
  });
  create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-16",
    date_end: "2026-02-22" ,
    discord_thread_id: null
  });

  add_update_user_logged({discord_id: "1", name: "jedna", has_role: 0});
  add_update_user_logged({discord_id: "2", name: "dva",   has_role: 1});
  add_update_user_logged({discord_id: "3", name: "tri",   has_role: 1});

  user_join_cleaning_logged({discord_id: "1", cleaning_id: ret1.lastInsertRowid});

  console.log("Seeding complete.");
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

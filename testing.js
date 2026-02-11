import { create_template_logged, create_cleaning_logged } from "./db.js";

export function seed_cleanings() {
  const bar_template_id = create_template_logged({
    max_users: 5,
    place: "Kachna",
    name: "Bar",
    instructions: "uklid to idk"
  });

  const nabytek_template_id = create_template_logged({
    max_users: 3,
    place: "Kachna",
    name: "Kachna",
    instructions: "utri to ig"
  });

  const satna_template_id = create_template_logged({
    max_users: 4,
    place: "Zadní zázemí",
    name: "Šatny dole a nahoře",
    instructions: "Vyluxovat a utřít prach"
  });

  // --- PREVIOUS WEEK ---
  create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-02", 
    date_end: "2026-02-08" 
  });
  create_cleaning_logged({
    template_id: nabytek_template_id, 
    date_start: "2026-02-02", 
    date_end: "2026-02-08"
  });

  // --- THIS WEEK ---
  create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15"
  });
  create_cleaning_logged({
    template_id: nabytek_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15"
  });
  create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-9",
    date_end: "2026-02-15"
  });

  // --- NEXT WEEK ---
  create_cleaning_logged({
    template_id: bar_template_id,
    date_start: "2026-02-16", 
    date_end: "2026-02-22" 
  });
  create_cleaning_logged({
    template_id: satna_template_id,
    date_start: "2026-02-16",
    date_end: "2026-02-22" 
  });

  console.log("Seeding complete.");
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

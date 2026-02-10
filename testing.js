import * as db from "./db.js";
import * as handler from "./handler.js";

let bot;

function create_template_modal_stub (
 {max_users, place, name, instructions}
) 
{
  const modal = { data:{ components:[
    { component:{
      values: [ max_users ],
      custom_id: "max_users", 
    }},
    { component:{
      value: place,
      custom_id: "place", 
    }},
    { component:{
      value: name,
      custom_id: "name", 
    }},
    { component:{
      value: instructions,
      custom_id: "instructions", 
    }},
  ]}};

  modal.createMessage = (_) => {};

  return modal;
}

function create_cleaning_modal_stub (
 {template_id, date_start, date_end, repetitions}
)
{
  const modal = { data:{ components:[
    { component:{
      values: [ template_id ],
      custom_id: "template", 
    }},
    { component:{
      value: date_start,
      custom_id: "start_date", 
    }},
    { component:{
      value: date_end,
      custom_id: "end_date", 
    }},
    { component:{
      values: [ repetitions ],
      custom_id: "repetitions", 
    }},
  ]}};

  modal.defer = (_) => {};
  modal.createMessage = (_) => {};

  return modal;
}

function create_user_join_msg_stub(
  {member_id, cleaning_id}
) {
  let msg = { 
    member: {id: member_id},
    data: {options: [{value: cleaning_id}]},
  }

  msg.createMessage = (_) => {};

  return msg;
}

export async function seed_cleanings(bot_instance) {
  try {
    bot = bot_instance;
    
    let modal1 = create_template_modal_stub({
      max_users: 5,
      place: "Kachna",
      name: "Bar",
      instructions: "uklid to idk"
    });
    await handler.create_template_modal(modal1);

    let modal2 = create_template_modal_stub({
      max_users: 3,
      place: "Kachna",
      name: "Kachna",
      instructions: "utri to ig"
    });
    await handler.create_template_modal(modal2);

    let modal3 = create_template_modal_stub({
      max_users: 4,
      place: "Zadní zázemí",
      name: "Šatny dole a nahoře",
      instructions: "Vyluxovat a utřít prach"
    });
    await handler.create_template_modal(modal3);

    let modal4 = create_cleaning_modal_stub({
      template_id: 1,
      date_start: "2026-02-23", 
      date_end: "2026-03-01",
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal4);

    let modal5 = create_cleaning_modal_stub({
      template_id: 2, 
      date_start: "2026-02-23", 
      date_end: "2026-03-01",
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal5);

    let modal6 = create_cleaning_modal_stub({
      template_id: 1,
      date_start: "2026-02-09",
      date_end: "2026-02-15",
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal6);

    let modal7 = create_cleaning_modal_stub({
      template_id: 2,
      date_start: "2026-02-09",
      date_end: "2026-02-15",
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal7);

    let modal8 = create_cleaning_modal_stub({
      template_id: 3,
      date_start: "2026-02-09",
      date_end: "2026-02-15",
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal8);

    let modal9 = create_cleaning_modal_stub({
      template_id: 1,
      date_start: "2026-02-16", 
      date_end: "2026-02-22" ,
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal9);

    let modal10 = create_cleaning_modal_stub({
      template_id: 3,
      date_start: "2026-02-16",
      date_end: "2026-02-22" ,
      repetitions: 1,
    });
    await handler.create_cleaning_modal(modal10);

    db.add_update_user_logged({discord_id: "1", name: "jedna", has_role: 0});
    db.add_update_user_logged({discord_id: "2", name: "dva",   has_role: 1});
    db.add_update_user_logged({discord_id: "3", name: "tri",   has_role: 1});
    db.add_update_user_logged({discord_id: "4", name: "ctyri", has_role: 1});
    db.add_update_user_logged({discord_id: "5", name: "pet",   has_role: 1});
    db.add_update_user_logged({discord_id: "6", name: "sest",  has_role: 1});

    let msg1 = create_user_join_msg_stub({member_id: "1", cleaning_id: 1});
    await handler.join_command(msg1);
    let msg2 = create_user_join_msg_stub({member_id: "2", cleaning_id: 1});
    await handler.join_command(msg2);
    let msg3 = create_user_join_msg_stub({member_id: "3", cleaning_id: 1});
    await handler.join_command(msg3);
    let msg4 = create_user_join_msg_stub({member_id: "4", cleaning_id: 1});
    await handler.join_command(msg4);
    let msg5 = create_user_join_msg_stub({member_id: "5", cleaning_id: 7});
    await handler.join_command(msg5);
    let msg6 = create_user_join_msg_stub({member_id: "6", cleaning_id: 7});
    await handler.join_command(msg6);

    console.log("Seeding complete.");
    
  } catch (err) {
    console.log(`Seed error: ${err}.`);
  }
}

export function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

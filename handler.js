import * as db from './db.js';
import { generate_cleaning_report_image } from './helpers.js';
import { MAIN_CH, LOG_CH, GUILD_ID, CLEANING_ROLE, IMP_LOG_CH, MANAGER_ROLE } from './config.js'
import { generate_cleaning_modal, generate_template_modal, generate_template_modal_edit } from './modals.js';

let bot;
export let public_commands;
export let manager_commands;
export let manager_interactions;
export let button_commands;

class SkipReportError extends Error {
  constructor(message = "Skip report") {
    super(message);
    this.name = "SkipReportError";
  }
}

function md_report(func) {
  return async (arg) => {
    if(await func(arg) !== "skip_report") {
      await bot.send_report();
    }
  }
}

function md_err(func) {
  return async (arg) => {
    try {
      await func(arg);
      return false;

    } catch(err) {
      console.log("Handler error: " + err);
      await arg.createMessage({
        content: `${err}\n${err.stack}`,
        flags: 64,
      });

      return "skip_report";
    }
  }
}

// This is the important part
export function handlers_init(bot_instance) {
  bot = bot_instance;

  public_commands = [
    {
      name: "report",
      description: "Sends table of cleanings.",
      fullDescription: "Sends table of cleanings from this semester. The table is sent as a generated image.",
      type: 1,
      handler_function: md_report(md_err(report_command)),
    },
    {
      name: "join",
      description: "Join one cleaning of specified id.",
      type: 1,
      options: [{
        name: "target_id",
        description: "The id of cleaning to join.",
        type: 4,
        required: true
      }],
      handler_function: md_report(md_err(join_command)),
    },
    {
      name: "leave",
      description: "Leave one cleaning of specified id.",
      type: 1,
      options: [{
        name: "target_id",
        description: "The id of cleaning to leave.",
        type: 4,
        required: true
      }],
      handler_function: md_report(md_err(leave_command)),
    },
  ];

  manager_commands = [
    {
      name: "create-template",
      description: "Create template for cleaning.",
      fullDescription: "Create template for cleaning through discord modal functionality as a form.",
      type: 1,
      handler_function: md_err(create_template_command),
    },
    {
      name: "create-cleaning",
      description: "Create cleaning from template.",
      fullDescription: "Create cleaning through discord modal functionality as a form where template is selected.",
      type: 1,
      handler_function: md_err(create_cleaning_command),
    },
    {
      name: "edit-template",
      description: "Edit fields of existing template.",
      type: 1,
      options: [{
        name: "target_id",
        description: "The id of template to edit. Get by list-templates.",
        type: 4,
        required: true
      }],
      handler_function: md_err(edit_template_command),
    },
    {
      name: "lock-db",
      description: "Un/lock leaving cleanings, which are for the current week.",
      type: 1,
      handler_function: md_err(lock_command),
    },
    {
      name: "list-users",
      description: "List all members and number of cleanings.",
      type: 1,
      handler_function: md_err(list_users),
    },
    {
      name: "list-templates",
      description: "List all existing templates.",
      type: 1,
      handler_function: md_err(list_templates),
    },
    {
      name: "remove-cleaning",
      description: "Remove cleaning with id",
      type: 1,
      options: [{
        name: "target_id",
        description: "The id of template to edit. Get by list-templates.",
        type: 4,
        required: true
      }],
      handler_function: md_report(md_err(remove_cleaning)),
    }
  ];
    
  manager_interactions = [
    {
      name: "create-template-modal",
      handler_function: md_err(create_template_modal),
    },
    {
      name: "create-cleaning-modal",
      handler_function: md_report(md_err(create_cleaning_modal)),
    },
    {
      name: "edit-template-modal",
      handler_function: md_report(md_err(edit_template_modal)),
    }
  ];

  button_commands = [
    {
      name: "Byl úklid dokončen?",
      handler_function: md_report(md_err(finish_cleaning_buttons)),
    }
  ];
}

export async function lock_command(msg) {
  let locked = db.lock_leave();

  let message;

  if (locked) {
    message = "Users can't leave ongoing cleanings now.";
  } else {
    message = "Users can leave ongoing cleanings now.";
  }

  await msg.createMessage({content: message, flags: 64});
}

export async function report_command(msg) {
  try {
    const report = await generate_cleaning_report_image(
      bot.semester_start, bot.semester_end
    );
    
    await msg.createMessage({
      content: "📋 **Harmonogram**",
      flags: 64,
    }, report);
        
  } catch (err) {
    console.error(err);
    await msg.createMessage(
      { content: "Failed to generate report.", flags: 64 }
    );
    return;
  }
}

async function invite_to_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  await bot.createMessage(cleaning.discord_thread_id, `<@${member_id}> se připojil.`, null);
}

async function kick_from_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  await bot.createMessage(cleaning.discord_thread_id, `<@${member_id}> se odpojil.`, null);
  await bot.leaveThread(cleaning.discord_thread_id, member_id);
}

export async function join_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  db.user_join_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
  await invite_to_cleaning_thread(cleaning_id, member_id);

  await msg.createMessage({content: "Joined cleaning.", flags: 64 });
}

export async function leave_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  db.user_leave_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
  await kick_from_cleaning_thread(cleaning_id, member_id);

  await msg.createMessage({ content: "Left cleaning.", flags: 64 });
}

export async function create_template_command(msg) {
  await msg.createModal(generate_template_modal());
}

export async function create_template_modal(modal) {
  let res = modal.data.components;
  let max_users, place, name, instructions;

  for (const c of res) {
    switch(c.component.custom_id) {
      case "max_users":
        max_users = c.component.values[0];
        break;
      case "place":
        place = c.component.value;
        break;
      case "name":
        name = c.component.value;
        break;
      case "instructions":
        instructions = c.component.value;
        break;
    }
  }

  db.create_template_logged({
    max_users: max_users, place: place, name: name, instructions: instructions}
  );

  await modal.createMessage({ content: "Cleaning template created.", flags: 64 });
}

export async function create_cleaning_command(msg) {
  await msg.createModal(generate_cleaning_modal(db));
}

function increment_week(date_string) {
  const [year, month, day] = date_string.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  date.setUTCDate(date.getUTCDate() + 7);

  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function create_cleaning_modal(modal) {
  let res = modal.data.components;
  let template_id, date_start, date_end, repetitions;

  // Creating threads takes time.
  // This gives 15 minutes before command timeout.
  await modal.defer(64);

  for (const c of res) {
    switch(c.component.custom_id) {
      case "template":
        template_id = c.component.values[0];
        break;
      case "start_date":
        date_start = c.component.value;
        break;
      case "end_date":
        date_end = c.component.value;
        break;
      case "repetitions":
        repetitions = c.component.values[0];
        break;
    }
  }

  let template = db.get_template_by_id(template_id);

  let cleaning_list = []
  for (let i=0; i < repetitions; i++) {
    let day_start = date_start.slice(5).split('-')[1];
    let date_start_str = `${day_start}. ${date_start.slice(5).split('-')[0]}.`;
    
    let day_end = date_end.slice(5).split('-')[1];
    let date_end_str = `${day_end}. ${date_end.slice(5).split('-')[0]}.`;
     
    let thread_name = `${template.name} ${date_start_str} - ${date_end_str}`;
    // type 12 is private thread
    // -- Create discord thread for cleaning
    let thread_channel = await bot.createThread(
      MAIN_CH, {invitable: false, name: thread_name, type: 12}
    );
    // -- Send message with cleaning instructions
    let instruction_message = await bot.createMessage(thread_channel.id, template.instructions, null);

    // -- Create data to be sent later
    cleaning_list.push({template_id: template_id, date_start: date_start, 
                        date_end: date_end, discord_thread_id: thread_channel.id,
                        instruction_message: instruction_message.id});

    date_start = increment_week(date_start);
    date_end = increment_week(date_end);
  }

  // -- Put cleanings to db
  db.create_cleanings_logged({cleaning_list});

  await modal.createMessage({ content: "Cleaning/s created.", flags: 64});
}

export async function finish_cleaning_buttons(buttons) {
  // twice components because buttons are in action row
  let button_clicked = buttons.data.custom_id;
  let finish_button, cleaning_id;

  if(button_clicked.startsWith("finished")) {
    cleaning_id = button_clicked.split(" ")[1];
    finish_button = true;
  }

  if (!finish_button || !cleaning_id) {
    throw new Error("Buttons data malformed.");
  }

  let member_id = buttons.member.id;

  db.finish_cleaning_logged({member_id, cleaning_id});
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  await bot.archive_thread(cleaning.discord_thread_id);

  await buttons.createMessage({ content: "Cleaning finished." });
}

export async function list_users(msg) {
  const users = db.get_users();
  const cleanings = db.get_cleanings(bot.semester_start, bot.semester_end);

  const user_to_cleanings = {};
  for (const user of users) {
    user_to_cleanings[user.discord_id] = [];
  }

  for (const cleaning of cleanings) {
    for (const participant of cleaning.users) {
      if (user_to_cleanings[participant.discord_id]) {
        user_to_cleanings[participant.discord_id].push(cleaning.id);
      }
    }
  }

  let user_cleaning_info = users.map(user => {
    const cleaningList = user_to_cleanings[user.discord_id];
    return {
      count: cleaningList.length,
      name: user.name,
      discord_id: user.discord_id,
      cleanings: cleaningList,
      has_role: !!user.has_role,
    };
  });

  user_cleaning_info.sort((a, b) => {return a.count - b.count;});
  let with_role = user_cleaning_info.filter(user => user.has_role);
  let without_role = user_cleaning_info.filter(user => !user.has_role);

  const formatLine = (info) =>
    `${info.count} | ${info.name} (${info.discord_id}): ${info.cleanings.length > 0 ? info.cleanings.join(', ') : 'none'}`;

  const lines = [
    "All users and their assigned cleanings:",
    ...with_role.map(formatLine),
    "---------------- NO CLEANING ROLE ----------------",
    ...without_role.map(formatLine),
  ];

  await msg.createMessage({ content: "```" + lines.join("\n") + "```", flags: 64 });
}

export async function list_templates(msg) {
  const templates = db.get_templates();

  const lines = templates.map(t => {
    const instructions = (t.instructions ?? "").replace(/\s+/g, " ").trim();
    const shortInstructions = instructions.length > 80
      ? instructions.slice(0, 77) + "..."
      : instructions;

    return `${t.id} | ${t.name} | ${t.place} | max:${t.max_users} | ${shortInstructions || "no instructions"}`;
  });

  const message = "Cleaning templates:\n" + lines.join("\n");
  await msg.createMessage({ content: "```" + message + "```", flags: 64 });
}

export async function edit_template_command(msg) {
  let template_id = msg.data.options[0].value;
  let t = db.get_template_by_id(template_id);
  await msg.createModal(
    generate_template_modal_edit(template_id, t.max_users, t.place, t.name, t.instructions)
  );
}

export async function edit_template_modal(modal) {
  let res = modal.data.components;
  let id, max_users, place, name, instructions;

  for (const c of res) {
    switch(c.component.custom_id) {
      case "id":
        id = c.component.values[0];
        break;
      case "max_users":
        max_users = c.component.values[0];
        break;
      case "place":
        place = c.component.value;
        break;
      case "name":
        name = c.component.value;
        break;
      case "instructions":
        instructions = c.component.value;
        break;
    }
  }

  let old_t = db.get_template_by_id(id);

  db.update_template_logged(
    {id: id, max_users: max_users, place: place, name: name, instructions: instructions}
  );

  if (old_t.instructions != instructions) {
    let cleanings = db.get_cleanings_with_template(id);

    const promises = [];
    for (const cleaning of cleanings) {
      promises.push(
        bot.update_text_message(
          cleaning.discord_thread_id,
          cleaning.instruction_message_id,
          cleaning.template.instructions
        )
      );
    }
    await Promise.all(promises);
  }

  await modal.createMessage({ content: "Cleaning template updated.", flags: 64 });
}

export async function remove_cleaning(msg) {
  let cleaning_id = msg.data.options[0].value;
  let cleaning = db.get_cleaning_by_id(cleaning_id);

  db.remove_cleaning_logged({cleaning_id: cleaning_id});
  await bot.remove_thread(cleaning.discord_thread_id);

  await msg.createMessage({content: `Cleaning ${cleaning_id} removed`, flags: 64});
}

export async function kick_user_cleaning(msg) {
  // TODO(Sigull): This will probably break
  let cleaning_id     = msg.data.options[0].value;
  let user_discord_id = msg.data.options[0].value;

  db.kick_user_cleaning({cleaning_id, user_id});

  await kick_from_cleaning_thread(cleaning_id, user_discord_id);

  await msg.createMessage({content: `Member <@${user_discord_id}> kicked.`, flags: 64});
}

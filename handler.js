import * as db from './db.js';
import { generate_cleaning_report_image } from './helpers.js';
import { TEST_CH, LOG_CH, GUILD_ID, CLEANING_ROLE, IMP_LOG_CH, MANAGER_ROLE } from './config.js'

let bot;
export let public_commands;
export let manager_commands;
export let manager_interactions;
export let button_commands;

function md_report(func) {
  return async (arg) => {
    try {
      await func(arg);
      bot.send_report();

    } catch(err) {
      if (!err.message.startsWith("Don't send report.")) {
        throw err;
      }
    }
  }
}

function md_err(func) {
  return async (arg) => {
    try {
      await func(arg);
    } catch(err) {
      console.log("Handler error: " + err);
      await arg.createMessage({
        content: err,
        flags: 64,
      });
      throw new Error(`Don't send report.`);
    }
  }
}

export function handlers_init(bot_instance) {
  bot = bot_instance;

  public_commands = [
    {
      name: "report",
      description: "Sends table of cleanings.",
      fullDescription: "Sends table of cleanings from this semester. The table is sent as a generated image.",
      type: 1,
      handler_function: md_err(report_command),
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
      // TODO(Sigull): Also should have edit template command
      name: "create-template",
      description: "Create template for cleaning.",
      fullDescription: "Create template for cleaning through discord modal functionality as a form.",
      type: 1,
      handler_function: md_err(create_template_command),
    },
    {
      name: "create-cleaning",
      description: "Create cleaning from template",
      fullDescription: "Create cleaning through discord modal functionality as a form where template is selected.",
      type: 1,
      handler_function: md_err(create_cleaning_command),
    },
    {
      name: "lock-db",
      description: "Un/lock leaving cleanings, which are for the current week.",
      type: 1,
      handler_function: md_err(lock_command),
    },
    {
      name: "list-all",
      description: "List all members and number of cleanings.",
      type: 1,
      handler_function: md_err(list_all),
    },
  ];
    
  manager_interactions = [
    {
      name: "create-template-modal",
      handler_function: md_report(md_err(create_template_modal)),
    },
    {
      name: "create-cleaning-modal",
      handler_function: md_report(md_err(create_cleaning_modal)),
    },
  ];

  button_commands = [
    {
      name: "Byl úklid dokončen?",
      handler_function: md_report(md_err(finish_cleaning_buttons)),
    }
  ];
}

export async function lock_command(msg) {
  db.leave_locked != db.leave_locked;

  let message;

  if (db.leave_locked) {
    message = "Users can't leave ongoing cleanings now.";
  } else {
    message = "Users can leave ongoing cleanings now.";
  }

  await msg.createMessage({content: message, flags: 64});
}

export async function report_command(msg) {
  try {
    // TODO(Sigull): temp
    const report = await generate_cleaning_report_image(
      bot.semester_start, bot.semester_end
    );
    
    await msg.createMessage({
      content: "📋 **Cleaning Schedule Overview**",
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

function invite_to_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  bot.createMessage(cleaning.discord_thread_id, `<@${member_id}> se připojil.`, null);
}

async function kick_from_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  await bot.createMessage(cleaning.discord_thread_id, `<@${member_id}> se odpojil.`, null);
  bot.leaveThread(cleaning.discord_thread_id, member_id);
}

export async function join_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  db.user_join_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
  invite_to_cleaning_thread(cleaning_id, member_id);

  await msg.createMessage({content: "Joined cleaning.", flags: 64 });
}

export async function leave_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  db.user_leave_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
  kick_from_cleaning_thread(cleaning_id, member_id);

  await msg.createMessage({ content: "Left cleaning.", flags: 64 });
}

export async function create_template_command(msg) {
  await msg.createModal({
    "title": "Cleaning template",
    "custom_id": "create-template-modal",
    "components": [
      {
        "type": 18,
        "label": "Maximum number of people cleaning.",
        "component": {
          "type": 3,
          "custom_id": "max_users",
          "placeholder": "Select a number...",
          "options": [
            { "label": "1", "value": "1" },
            { "label": "2", "value": "2" },
            { "label": "3", "value": "3" },
            { "label": "4", "value": "4" },
            { "label": "5", "value": "5" },
            { "label": "6", "value": "6" }
          ]
        }
      },
      {
        "type": 18,
        "label": "Place of cleaning.",
        "component": {
          "type": 4,
          "custom_id": "place",
          "style": 1,
          "placeholder": "Ideálně něco jako R212 - Kachna"
        }
      },
      {
        "type": 18,
        "label": "Name of the template",
        "component": {
          "type": 4,
          "custom_id": "name",
          "style": 1,
          "placeholder": "Jméno úklidu"
        }
      },
      {
        "type": 18,
        "label": "Cleaning instructions",
        "component": {
          "type": 4,
          "custom_id": "instructions",
          "style": 2,
          "placeholder": "Paste Google Docs link here..."
        }
      }
    ]
  });
}

// TODO(Sigull): Validate data.
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

// TODO(Sigull): Add a way to show templates in a more whole way.
export async function create_cleaning_command(msg) {
  let templates = db.get_templates();
  let template_name_id_pairs = []

  for (const t of templates) {
    template_name_id_pairs.push({"label": t.name, "value": t.id});
  }

  await msg.createModal({
    "title": "Cleaning",
    "custom_id": "create-cleaning-modal",
    "components": [
      {
        "type": 18,
        "label": "Cleaning template.",
        "component": {
          "type": 3,
          "custom_id": "template",
          "placeholder": "Select a template...",
          "options": template_name_id_pairs,
        }
      },
      {
        "type": 18,
        "label": "Start date.",
        "component": {
          "type": 4,
          "custom_id": "start_date",
          "style": 1,
          "placeholder": "YYYY-MM-DD",
        }
      },
      {
        "type": 18,
        "label": "End date.",
        "component": {
          "type": 4,
          "custom_id": "end_date",
          "style": 1,
          "placeholder": "YYYY-MM-DD"
        }
      },
      {
        "type": 18,
        "label": "Number of repetitions.",
        "component": {
          "type": 3,
          "custom_id": "repetitions",
          "placeholder": "Select a number...",
          "options": [
            { "label": "1",  "value": 1  },
            { "label": "2",  "value": 2  },
            { "label": "3",  "value": 3  },
            { "label": "4",  "value": 4  },
            { "label": "5",  "value": 5  },
            { "label": "6",  "value": 6  },
            { "label": "7",  "value": 7  },
            { "label": "8",  "value": 8  },
            { "label": "9",  "value": 9  },
            { "label": "10", "value": 10 },
            { "label": "11", "value": 11 },
            { "label": "12", "value": 12 },
            { "label": "13", "value": 13 }
          ]
        }
      }
    ]
  });
}

function increment_week(date_string) {
  // format (YYYY-MM-DD)
  const date = new Date(date_string);
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

export async function create_cleaning_modal(modal) {
  let res = modal.data.components;
  let template_id, date_start, date_end, repetitions;

  // Creating threads takes time.
  // This gives 15 minutes before command timeout.
  await modal.defer(64);

  // TODO(Sigull): Maybe just use a map and check validity later.
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
    let thread_channel = await bot.createThread(
      TEST_CH, {invitable: false, name: thread_name, type: 12}
    );
    bot.createMessage(thread_channel.id, template.instructions, null);

    cleaning_list.push({template_id: template_id, date_start: date_start, 
                        date_end: date_end, discord_thread_id: thread_channel.id});

    date_start = increment_week(date_start);
    date_end = increment_week(date_end);
  }

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

  await buttons.createMessage({ content: "Cleaning finished." });
}

export async function list_all(msg) {
  const users = db.get_users();
  const cleanings = db.get_cleanings(bot.semester_start, bot.semester_end);

  const userToCleanings = {};
  for (const user of users) {
    userToCleanings[user.discord_id] = [];
  }
  for (const cleaning of cleanings) {
    for (const participant of cleaning.users) {
      if (userToCleanings[participant.discord_id]) {
        userToCleanings[participant.discord_id].push(cleaning.id);
      }
    }
  }

  let userCleaningInfo = users.map(user => {
    const cleaningList = userToCleanings[user.discord_id];
    return {
      count: cleaningList.length,
      name: user.name,
      discord_id: user.discord_id,
      cleanings: cleaningList
    };
  });

  userCleaningInfo.sort((a, b) => a.count - b.count);

  let lines = userCleaningInfo.map(info => {
    return `${info.count} | ${info.name} (${info.discord_id}): ${info.cleanings.length > 0 ? info.cleanings.join(', ') : 'none'}`;
  });
  const message = 'All users and their assigned cleanings:\n' + lines.join('\n');

  await msg.createMessage({ content: '```' + message + '```', flags: 64 });
}

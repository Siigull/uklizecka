import * as db from './db.js';
import { generate_cleaning_report_image } from './timetable_generate.js';
import { TEST_CH, LOG_CH, GUILD_ID, CLEANING_ROLE, IMP_LOG_CH, MANAGER_ROLE } from './config.js'

let bot;
export let public_commands;
export let manager_commands;

export function handlers_init(bot_instance) {
    bot = bot_instance;

    public_commands = [
        {
            name: "report",
            description: "Sends table of cleanings.",
            fullDescription: "Sends table of cleanings from this semester. The table is sent as a generated image.",
            type: 1,
            handler_function: report_command,
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
            handler_function: join_command,
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
            handler_function: leave_command,
        },
    ];

    manager_commands = [
        {
            // TODO(Sigull): Also should have edit template command
            name: "create-template",
            description: "Create template for cleaning.",
            fullDescription: "Create template for cleaning through discord modal functionality as a form.",
            type: 1,
            handler_function: create_template_command,
        },
        {
            name: "create-cleaning",
            description: "Create cleaning from template",
            fullDescription: "Create cleaning through discord modal functionality as a form where template is selected.",
            type: 1,
            handler_function: create_cleaning_command,
        },
    ];
}

export async function report_command(msg) {
  try {
    // TODO(Sigull): temp
    const report = await generate_cleaning_report_image('2026-01-11', '2026-03-18');
    
    await bot.createMessage(msg.channel.id, {
      content: "📋 **Cleaning Schedule Overview**"
    }, report);
    
  } catch (err) {
    console.error(err);
    bot.createMessage(msg.channel.id, "Failed to generate report.");
  }

  await msg.createMessage("Generated report.");
}

function invite_to_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  bot.createMessage(cleaning.id, `<@${member_id}> se připojil.`, null);
}

async function kick_from_cleaning_thread(cleaning_id, member_id) {
  let cleaning = db.get_cleaning_by_id(cleaning_id);
  await bot.createMessage(cleaning.id, `<@${member_id} se odpojil.`, null);
  bot.removeThreadMember(cleaning.discord_thread_id, member_id);
}

export async function join_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  try {
    db.user_join_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
    invite_to_cleaning_thread(cleaning_id, member_id);

  } catch (err) {
    console.log(err);
  }

  await msg.createMessage("Joined cleaning.")
}

export async function leave_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  try {
    db.user_leave_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});
    kick_from_cleaning_thread(cleaning_id, member_id);

  } catch (err) {
    console.log(err);
  }

  await msg.createMessage("Left cleaning.");
}

// TODO(Sigull): It is possible to send any/malformed modal with the same custom id.
//               Don't know if that is am issue.
export async function create_template_command(msg) {
  await msg.createModal({
    "title": "Cleaning template",
    "custom_id": "create_template",
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

  console.log(res);

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

  db.create_template_logged({max_users, place, name, instructions});

  await modal.createMessage("Cleaning template created.");
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
    "custom_id": "create_cleaning",
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

  console.log(res);

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

  // TODO(Sigull): Do this as transaction. If one fails all fail.
  // TODO(Sigull): Have a simple way to remove all at once.
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

  await modal.createMessage("Cleaning/s created.")
}

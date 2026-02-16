// BOT
import { get_cleanings, add_update_user_logged, create_cleaning_logged, get_templates,
  create_template_logged, db_init, sync_users, user_join_cleaning_logged, user_leave_cleaning_logged } from './db.js';
import { seed_cleanings } from './testing.js';

import { TEST_CH, LOG_CH, GUILD_ID, CLEANING_ROLE, IMP_LOG_CH, MANAGER_ROLE } from './config.js'

import { schedule } from 'node-cron';
import Eris, { CommandClient } from "eris";

const bot = new CommandClient(process.env.BOT_TOKEN, {
    intents: [
        "guilds",
        "guildMessages",
        "messageContent",
        "guildMembers"
    ]
}, {  
    description: "A test bot made with Eris",
    owner: "somebody",
    prefix: "!"
});

bot.createThread = async (channel_id) => {
  bot.createThread(channel_id, {
    name: "Cleaning",
    type: 12,
    autoArchiveDuration: 60
  }).then(thread => {
      thread.createMessage("Welcome to the new thread!");
  });
}

bot.send = async (channel, message) => {
  return bot.createMessage(channel, message, null);
}

bot.send_log = async (message) => {
  return bot.send(LOG_CH, message).catch(err => {
    console.log("Send log message error: ", err);
  })
}

bot.send_imp_log = async (message) => {
  return bot.send(IMP_LOG_CH, message).catch(err => {
    console.log("Send important log message error: ", err);
  })
}

bot.send_notification = async () => {
  return bot.send(TEST_CH, "ee").catch(err => {
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
  let previous_week_cleanings = get_cleanings(formatDate(startPrevWeek), formatDate(endPrevWeek));
  let this_week_cleanings     = get_cleanings(formatDate(startThisWeek), formatDate(endThisWeek));
  let next_week_cleanings     = get_cleanings(formatDate(startNextWeek), formatDate(endNextWeek));

  // Get only unfinished
  previous_week_cleanings = previous_week_cleanings.filter((element, index, _) => {
    return !element.finished;
  });
  this_week_cleanings = this_week_cleanings.filter((element, index, _) => {
    return !element.finished;
  });
  next_week_cleanings = next_week_cleanings.filter((element, index, _) => {
    return !element.finished;
  });

  return {
    previous: previous_week_cleanings,
    current: this_week_cleanings,
    next: next_week_cleanings
  };
}

function schedule_send_notification_event() {
  // TODO(Sigull): Change for prod
  schedule('47 5 * * *', () => {
    cleanings = check_which_cleanings_notify();
    bot.send_notification();
  
  }, {
    scheduled: true,
    timezone: "Europe/Prague"
  });
}

function startup_bot() {
  bot.guild_fetched = bot.guilds.get(GUILD_ID);
  schedule_send_notification_event();
  sync_users(bot.guild_fetched);
  // TODO(Sigull): temp
  seed_cleanings();
  get_cleanings_notify();
}

async function register_commands(commands) {
  try {
    await bot.bulkEditCommands(commands);
    console.log("Slash Commands Registered!");

  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

async function main() {
  db_init(bot);

  let public_commands = [
    {
      name: "report",
      description: "Sends table of cleanings.",
      fullDescription: "Sends table of cleanings from this semester. The table is sent as a generated image.",
      type: 1,
      handler_function: handle_report_command,
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
      handler_function: handle_join_command,
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
      handler_function: handle_leave_command,
    },
  ];

  let manager_commands = [
    {
      // TODO(Sigull): Also should have edit template command
      name: "create-template",
      description: "Create template for cleaning.",
      fullDescription: "Create template for cleaning through discord modal functionality as a form.",
      type: 1,
      handler_function: handle_create_template_command,
    },
    {
      name: "create-cleaning",
      description: "Create cleaning from template",
      fullDescription: "Create cleaning through discord modal functionality as a form where template is selected.",
      type: 1,
      handler_function: handle_create_cleaning_command,
    },
  ];
  
  bot.on("messageCreate", (msg) => {
    if(msg.content === "!ping") {
      bot.createMessage(msg.channel.id, "Pong!");
    }
  });

  // TODO(Sigull): Help command
  bot.on("ready", async () => {
    register_commands([...public_commands, ...manager_commands]);
    startup_bot();
  });

  bot.on("interactionCreate", async (interaction) => {
    if (interaction.data) {
      // TODO(Sigull): Give error to end user. 

      let public_command = public_commands.find(c => c.name === interaction.data.name);
      if (public_command && public_command.handler_function) {
        public_command.handler_function(interaction);
        return;
      }

      let manager_command = manager_commands.find(c => c.name === interaction.data.name);
      if (manager_command && manager_command.handler_function) {
        if (!interaction.member.roles.some(r => r === MANAGER_ROLE)) {
            await interaction.createMessage("[ERROR]: Must be cleaning manager to use this command.");
        } else {
          manager_command.handler_function(interaction);
        }
        return;
      }

      switch(interaction.data.custom_id) {
        case "create_template":
          handle_create_template_modal(interaction);
          return;

        case "create_cleaning":
          handle_create_cleaning_modal(interaction);
          return;
      }

      console.error(`Command ${interaction.data.name} not implemented.`);
    }
  });

  // TODO(Sigull): Maybe also when removal of roles.
  bot.on("guildMemberUpdate", (guild, member, oldMember) => {
    let has_cleaning_role = member.roles.includes(CLEANING_ROLE);
    if (oldMember.nick != member.nick) {
      add_update_user_logged({discord_id: member.discord_id, name: member.nick, has_role: has_cleaning_role});
    
    } else if (!oldMember.roles.includes(CLEANING_ROLE) && has_cleaning_role) {
      add_update_user_logged({discord_id: member.discord_id, name: member.nick, has_role: has_cleaning_role});
    }
  });

  bot.connect();
}

main()

async function handle_report_command(msg) {
  try {
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

async function handle_join_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  try {
    user_join_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});

  } catch (err) {
    console.log(err);
  }

  await msg.createMessage("Joined cleaning.")
}

async function handle_leave_command(msg) {
  let member_id = msg.member.id;
  let cleaning_id = msg.data.options[0].value;

  try {
    user_leave_cleaning_logged({discord_id: member_id, cleaning_id: cleaning_id});

  } catch (err) {
    console.log(err);
  }

  await msg.createMessage("Left cleaning.");
}

// TODO(Sigull): Add a way to show templates in a more whole way.
async function handle_create_cleaning_command(msg) {
  let templates = get_templates();
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
          "custom_id": "template_id",
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

async function handle_create_template_command(msg) {
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
async function handle_create_template_modal(modal) {
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

  create_template_logged({max_users, place, name, instructions});

  await modal.createMessage("Cleaning template created.");
}

function increment_week(date_string) {
  // format (YYYY-MM-DD)
  const date = new Date(date_string);
  date.setDate(date.getDate() + 7);
  return date.toISOString().split('T')[0];
}

async function handle_create_cleaning_modal(modal) {
  let res = modal.data.components;
  let template_id, date_start, date_end, repetitions;

  // TODO(Sigull): Maybe just use a map and check validity later.
  for (const c of res) {
    switch(c.component.custom_id) {
      case "template_id":
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

  // TODO(Sigull): Do this as transaction. If one fails all fail.
  // TODO(Sigull): Have a simple way to remove all at once.
  for (let i=0; i < repetitions; i++) {
    create_cleaning_logged({template_id, date_start, date_end});
    date_start = increment_week(date_start);
    date_end = increment_week(date_end);
  }

  await modal.createMessage("Cleaning/s created.")
}

import { createCanvas } from 'canvas';

/**
 * Generates a Gantt-style cleaning schedule
 * Toto bylo vibecodenute. Bojim se kouknout dovnitř
 * @param {string} start_str - Interval start (YYYY-MM-DD)
 * @param {string} end_str - Interval end (YYYY-MM-DD)
 */
export async function generate_cleaning_report_image(start_str, end_str) {
  const cleanings = get_cleanings(start_str, end_str);
  if (cleanings.length === 0) return null;

  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  };

  const firstDate = new Date(cleanings.reduce((min, c) => c.date_start < min ? c.date_start : min, cleanings[0].date_start));
  const lastDate = new Date(cleanings.reduce((max, c) => c.date_end > max ? c.date_end : max, cleanings[0].date_end));

  const weekStart = getMonday(firstDate);
  const totalWeeks = Math.ceil(((lastDate - weekStart) / (1000 * 60 * 60 * 24) + 1) / 7);

  const templatesMap = new Map();
  cleanings.forEach(c => {
    if (!templatesMap.has(c.template_rel)) {
      templatesMap.set(c.template_rel, { 
        name: c.template.name, 
        place: c.template.place, 
        max_users: c.template.max_users,
        instances: [] 
      });
    }
    templatesMap.get(c.template_rel).instances.push(c);
  });

  const templateIds = Array.from(templatesMap.keys());

  // Layout Constants
  const sidebarWidth = 350;
  const weekWidth = 750; 
  const rowHeight = 220; // Increased to fit status, capacity, and several names comfortably
  const headerHeight = 100;
  const padding = 60;

  const width = sidebarWidth + (totalWeeks * weekWidth) + padding;
  const height = headerHeight + (templateIds.length * rowHeight) + padding;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#23272a';
  ctx.fillRect(0, 0, width, height);

  const fillTextTruncated = (text, x, y, maxWidth) => {
    let currentText = String(text || "");
    if (ctx.measureText(currentText).width > maxWidth) {
      while (ctx.measureText(currentText + "...").width > maxWidth && currentText.length > 0) {
        currentText = currentText.slice(0, -1);
      }
      currentText += "...";
    }
    ctx.fillText(currentText, x, y);
  };

  // --- DRAW WEEKLY HEADERS ---
  for (let w = 0; w < totalWeeks; w++) {
    const weekX = sidebarWidth + (w * weekWidth);
    const currentWeekStart = new Date(weekStart);
    currentWeekStart.setDate(weekStart.getDate() + (w * 7));
    const currentWeekEnd = new Date(currentWeekStart);
    currentWeekEnd.setDate(currentWeekStart.getDate() + 6);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px sans-serif';
    const dateRange = `${currentWeekStart.getDate()}.${currentWeekStart.getMonth() + 1}. — ${currentWeekEnd.getDate()}.${currentWeekEnd.getMonth() + 1}.`;
    ctx.fillText(dateRange, weekX + 30, 65);

    ctx.strokeStyle = '#4f545c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(weekX, 0);
    ctx.lineTo(weekX, height);
    ctx.stroke();
  }

  // --- DRAW ROWS ---
  templateIds.forEach((tid, idx) => {
    const y = headerHeight + (idx * rowHeight);
    const template = templatesMap.get(tid);

    // Sidebar text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 30px sans-serif';
    fillTextTruncated(template.name, 40, y + 80, sidebarWidth - 60);
    
    ctx.font = '22px sans-serif';
    ctx.fillStyle = '#99aab5';
    fillTextTruncated(template.place, 40, y + 120, sidebarWidth - 60);

    ctx.save();
    ctx.beginPath();
    ctx.rect(sidebarWidth, 0, width - sidebarWidth, height);
    ctx.clip();

    template.instances.forEach(c => {
      const dayOffset = (new Date(c.date_start) - weekStart) / (1000 * 60 * 60 * 24);
      const dayDuration = ((new Date(c.date_end) - new Date(c.date_start)) / (1000 * 60 * 60 * 24)) + 1;

      const pixelsPerDay = weekWidth / 7;
      const blockX = sidebarWidth + (dayOffset * pixelsPerDay) + 15;
      const blockW = (dayDuration * pixelsPerDay) - 30;
      const blockY = y + 20;
      const blockH = rowHeight - 40;

      // Draw Pill
      ctx.fillStyle = c.finished ? '#43b581' : '#f04747';
      ctx.beginPath();
      ctx.roundRect(blockX, blockY, blockW, blockH, 20);
      ctx.fill();

      // Top Status Bar (DONE / ID + Count)
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px sans-serif';

      const statusText = c.finished ? 'DONE' : `#${c.id}`;
      ctx.fillText(statusText, blockX + 25, blockY + 45);
      
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`${c.users.length}/${template.max_users}`, blockX + blockW - 25, blockY + 45);
      ctx.textAlign = 'left';

      // Divider Line inside Pill
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(blockX + 20, blockY + 65);
      ctx.lineTo(blockX + blockW - 20, blockY + 65);
      ctx.stroke();

      // Participant Names
      ctx.font = '18px sans-serif';
      const maxDisplay = 4;
      const displayUsers = c.users.slice(0, maxDisplay);
      
      displayUsers.forEach((userObj, uIdx) => {
        const userName = userObj.name || "Unknown";
        fillTextTruncated(`• ${userName}`, blockX + 25, blockY + 95 + (uIdx * 25), blockW - 50);
      });

      if (c.users.length > maxDisplay) {
        ctx.font = 'italic 16px sans-serif';
        ctx.fillText(`+ ${c.users.length - maxDisplay} more...`, blockX + 25, blockY + 95 + (maxDisplay * 25));
      }
    });
    ctx.restore();
  });

  return {
    file: canvas.toBuffer('image/png'),
    name: 'cleaning_weekly_names.png'
  };
}

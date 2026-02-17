// BOT
import { get_cleanings, add_update_user_logged, create_cleaning_logged, get_templates,
  create_template_logged, db_init, sync_users, user_join_cleaning_logged, user_leave_cleaning_logged, 
  create_cleanings_logged} from './db.js';
import { seed_cleanings } from './testing.js';
import * as handler from './handler.js';

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
// TODO(Sigull): How to handle old cleanings which weren't done.
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

  console.log("Fetched cleanings from previous, this and next to notify.");

  return {
    previous: previous_week_cleanings,
    current: this_week_cleanings,
    next: next_week_cleanings
  };
}

function schedule_send_notification_event() {
  // TODO(Sigull): Change for prod
  let when = '47 5 * * *';
  schedule(when, () => {
    cleanings = check_which_cleanings_notify();
    bot.send_notification();
  
  }, {
    scheduled: true,
    timezone: "Europe/Prague"
  });

  console.log(`Scheduled notification cron for ${when}.`);
}

async function startup_bot() {
  bot.guild_fetched = bot.guilds.get(GUILD_ID);
  schedule_send_notification_event();
  await sync_users(bot.guild_fetched);
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

  handler.handlers_init(bot); 

  // TODO(Sigull): Help command
  bot.on("ready", async () => {
    await register_commands([...handler.public_commands, ...handler.manager_commands]);
    await startup_bot();
    console.log("Bot startup finished.");
  });

  // -- Slash commands
  bot.on("interactionCreate", async (interaction) => {
    if (interaction.data) {
      // TODO(Sigull): Give error to end user. 

      // -- Public commands
      let public_command = handler.public_commands.find(c => c.name === interaction.data.name);
      if (public_command && public_command.handler_function) {
        public_command.handler_function(interaction);
        return;
      }

      // -- Manager commands
      let manager_command = handler.manager_commands.find(c => c.name === interaction.data.name);
      if (manager_command && manager_command.handler_function) {
        if (!interaction.member.roles.some(r => r === MANAGER_ROLE)) {
            await interaction.createMessage("[ERROR]: Must be cleaning manager to use this command.");
        } else {
          manager_command.handler_function(interaction);
        }
        return;
      }

      // -- Return from modals
      switch(interaction.data.custom_id) {
        case "create_template":
          handler.create_template_modal(interaction);
          return;

        case "create_cleaning":
          handler.create_cleaning_modal(interaction);
          return;
      }

      console.error(`Command ${interaction.data.name} not implemented.`);
    }
  });

  // TODO(Sigull): Maybe also when removal of roles.
  // -- User syncing to database
  bot.on("guildMemberUpdate", (guild, member, oldMember) => {
    let has_cleaning_role = member.roles.includes(CLEANING_ROLE);
    // -- Nickname change
    if (oldMember.nick != member.nick) {
      add_update_user_logged({discord_id: member.discord_id, name: member.nick, has_role: has_cleaning_role});
    
    // -- User got 'access to club' role
    } else if (!oldMember.roles.includes(CLEANING_ROLE) && has_cleaning_role) {
      add_update_user_logged({discord_id: member.discord_id, name: member.nick, has_role: has_cleaning_role});
    }
  });

  bot.connect();
}

main()

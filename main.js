// BOT
import * as db from './db.js';
import { seed_cleanings } from './testing.js';
import * as handler from './handler.js';
import { generate_cleaning_report_image, get_current_semester_dates, get_nick } from './helpers.js';

import { MAIN_CH, LOG_CH, GUILD_ID, CLEANING_ROLE, IMP_LOG_CH, MANAGER_ROLE } from './config.js'

import { schedule } from 'node-cron';
import Eris, { CommandClient } from "eris";

let report_message_id;
let bot;

const formatDate = (date) => date.toISOString().split('T')[0];

// get all cleanings from previous, this, next weeks
// TODO(Sigull): How to handle old cleanings which weren't done.
function get_cleanings_notify() {
  const now = new Date();
  const currentDay = now.getDay(); 
  const diffToMon = currentDay === 0 ? -6 : 1 - currentDay;
  
  let startThisWeek = new Date(now);
  startThisWeek.setDate(now.getDate() + diffToMon);
  let endThisWeek = new Date(startThisWeek);
  endThisWeek.setDate(startThisWeek.getDate() + 6);

  let startPrevWeek = new Date(startThisWeek);
  startPrevWeek.setDate(startThisWeek.getDate() - 7);
  let endPrevWeek = new Date(startPrevWeek);
  endPrevWeek.setDate(startPrevWeek.getDate() + 6);

  let startNextWeek = new Date(startThisWeek);
  startNextWeek.setDate(startThisWeek.getDate() + 7);
  let endNextWeek = new Date(startNextWeek);
  endNextWeek.setDate(startNextWeek.getDate() + 6);

  // Fetch
  let previous_week = db.get_cleanings(formatDate(startPrevWeek), formatDate(endPrevWeek));
  let this_week     = db.get_cleanings(formatDate(startThisWeek), formatDate(endThisWeek));
  let next_week     = db.get_cleanings(formatDate(startNextWeek), formatDate(endNextWeek));

  // Get only unfinished
  previous_week = previous_week.filter((element, index, _) => {
    return !element.finished;
  });
  this_week = this_week.filter((element, index, _) => {
    return !element.finished;
  });
  next_week = next_week.filter((element, index, _) => {
    return !element.finished;
  });

  console.log("Fetched cleanings from previous, this and next to notify.");

  return {
    previous: previous_week,
    current: this_week,
    next: next_week,
  };
}

async function send_cleaning_notifications() {
  const cleanings = get_cleanings_notify();
  const tasks = [];

  const nextTasks = cleanings.next.flatMap(async (element) => {
    if (element.sent_next_week_message) return [];

    const members_ping = element.users.map(user => `<@${user.discord_id}>`).join('');
    db.send_next_week_logged(element.id);
    return [bot.createMessage(
      element.discord_thread_id, "Příští týden máte úklid " + members_ping
    )];
  });
  tasks.push(...nextTasks);

  const currentTasks = cleanings.current.map(async (element) => {
    if (!element.started) {
      return bot.start_cleaning(element.id);
    }
  });
  tasks.push(...currentTasks);

  const previousTasks = cleanings.previous.map(async (element) => {
    if (!element.started) {
      await bot.start_cleaning(element.id);
    }
    return bot.send_warning_unfinished(element.id);
  });
  tasks.push(...previousTasks);

  await Promise.all(tasks);
  console.log("All notifications and status updates sent.");
}

function schedule_refresh_report() {
  let when = '0 0 * * *';
  schedule(when, async () => {
    try {
      await bot.send_report();
    } catch (err) {
      console.error("send_report cron failed:", err);
      await bot.send_imp_log(`send_report cron failed: ${err?.stack || err}`);
    }
    
  }, {
    scheduled: true,
    timezone: "Europe/Prague"
  });

  console.log(`Scheduled report cron for ${when}.`);
}

function schedule_send_notification_event() {
  let when = '0 8 * * 1';
  schedule(when, async () => {
    try {
      await send_cleaning_notifications();
    } catch (err) {
      console.error("notification cron failed:", err);
      await bot.send_imp_log(`notification cron failed: ${err?.stack || err}`);
    }
  
  }, {
    scheduled: true,
    timezone: "Europe/Prague"
  });

  console.log(`Scheduled notification cron for ${when}.`);
}

async function startup_bot() {
  bot.guild_fetched = bot.guilds.get(GUILD_ID);
  schedule_send_notification_event();
  schedule_refresh_report();
  await db.sync_users(bot.guild_fetched);

  let when = await get_current_semester_dates();
  bot.semester_start = when.start_date;
  bot.semester_end = when.end_date;
  console.log(`Semester starts ${bot.semester_start} and ends in ${bot.semester_end}.`);
  await send_cleaning_notifications();

  await bot.send_report();
}

async function register_commands(commands) {
  try {
    await bot.bulkEditCommands(commands);
    console.log("Slash Commands Registered!");

  } catch (err) {
    console.error("Failed to register commands:", err);
  }
}

function bot_init() {
  bot = new CommandClient(process.env.BOT_TOKEN, {
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
    message = `[${new Date().toISOString()}]: ${message}`;
    return bot.send(LOG_CH, message).catch(err => {
      console.log("Send log message error: ", err);
    })
  }

  bot.send_imp_log = async (message) => {
    message = `[${new Date().toISOString()}]: ${message}`;
    return bot.send(IMP_LOG_CH, message).catch(err => {
      console.log("Send important log message error: ", err);
    })
  }

  bot.send_report = async () => {
    // Find old report message if it is not cached
    if (!report_message_id) {
      let messages = await bot.getMessages(MAIN_CH, { limit: 50 })
      const target = messages.find(m => m.content?.includes("**Harmonogram**"));
      if(target) {
        report_message_id = target.id; 
      }
    }

    const report = await generate_cleaning_report_image(bot.semester_start, bot.semester_end);

    const report_message = await bot.createMessage(
      MAIN_CH,
      {
        content:
          "- Pro přihlášení k úklidům použij `/join`.\n" +
          "- Pro odhlášení použij `/leave`.\n" +
          "- V týdnu tvého úklidu se v příslušném vlákně objeví zpráva s tlačítkem **Dokončen** pro potvrzení úklidu.\n" +
          `- S jakýmkoliv problémem/napádem napište <@&${MANAGER_ROLE}>\n` +
          "# 📋 **Harmonogram**"
      },
      report
    );

    // delete old report message
    if (report_message_id) {
      bot.deleteMessage(MAIN_CH, report_message_id, "Report refresh.");
    }

    console.log("Refreshed report.");
    report_message_id = report_message.id;
  }

  bot.start_cleaning = async (cleaning_id) => {
    let cleaning = db.get_cleaning_by_id(cleaning_id);
    db.start_cleaning_logged({cleaning_id});
    await bot.createMessage(cleaning.discord_thread_id,
      {
        content: "Byl úklid dokončen?",
        components: [
          {
            type: 1,
            custom_id: "confirm_cleaning",
            components: [
              {
                type: 2,
                label: "Dokončen",
                style: 3,
                custom_id: `finished ${cleaning.id}`,
              },
            ]
          }
        ]
      }
    );
  }

  bot.send_warning_unfinished = async (cleaning_id) => {
    let cleaning = db.get_cleaning_by_id(cleaning_id);
    let members_ping = "";
    for (const user of cleaning.users) {
      members_ping += `<@${user.discord_id}>`;
    }
    // TODO(Sigull): Reference message with confirm.
    await bot.createMessage(cleaning.discord_thread_id,
      "Připomínka: úklid není dokončen/potvrzen \n" + members_ping,
    );
  }

  bot.archive_thread = async (thread_id) => {
    let thread = bot.getChannel(thread_id);

    if (!thread) {
      throw new Error(`Thread to archive with id not defined`);
    }      
    
    await thread.edit({ archived: true, locked: true });

    await bot.send_log(`Thread ${thread_id} archived and locked.`);
  }

  bot.remove_thread = async (thread_id) => {
    let thread = bot.getChannel;

    if (!thread) {
      throw new Error(`Thread to archive with id not defined`);
    }

    await thread.delete();

    await bot.send_log(`Thread ${thread_id} deleted.`);
  }

  bot.update_text_message = async (channel_id, message_id, text) => {
    bot.editMessage(channel_id, message_id, text);
  }
}

async function leave_unauthorized_guilds() {
  bot.guilds.forEach(guild => {
    if (guild.id !== GUILD_ID) {
      console.log(`Leaving unauthorized guild: ${guild.name}`);
      guild.leave();
    }
  });
}

async function interaction_handler_switch(interaction) {
  try{
    if (interaction.data) {
      // TODO(Sigull): Move permissions into middleware.

      // -- Public commands
      let public_command = handler.public_commands.find(c => c.name === interaction.data.name);
      if (public_command && public_command.handler_function) {
        await public_command.handler_function(interaction);
        return;
      }

      // -- Manager commands
      let manager_command = handler.manager_commands.find(c => c.name === interaction.data.name);
      if (manager_command && manager_command.handler_function) {
        if (!interaction.member.roles.some(r => r === MANAGER_ROLE)) {
            await interaction.createMessage({
              content: "[ERROR]: Must be cleaning manager to use this command.",
              flags: 64,
            });
        } else {
          await manager_command.handler_function(interaction);
        }
        return;
      }

      // -- Manager interactions (modals)
      let manager_interaction = handler.manager_interactions.find(c => c.name === interaction.data.custom_id);
      if (manager_interaction && manager_interaction.handler_function) {
        if (!interaction.member.roles.some(r => r === MANAGER_ROLE)) {
            await interaction.createMessage({
              content: "[ERROR]: Must be cleaning manager to use this interaction.",
              flags: 64,
            });
        } else {
          await manager_interaction.handler_function(interaction);
        }
        return;
      }

      // -- Return from buttons
      // NOTE(Sigull): interaction.message.content is not the best way. 
      // But don't what to change it to.
      let button_command = handler.button_commands.find(c => c.name === interaction.message.content);
      if (button_command && button_command.handler_function) {
        await button_command.handler_function(interaction);
        return;
      }

      console.error(`Command ${interaction} not implemented.`);
    }
  } catch (err) {
      console.log(err);
      bot.send_imp_log(`Unhandled Interaction: ${err} \n ${interaction}`);
      await interaction.createMessage(
        {content: `Unhandled interaction error: ${err}`, flags: 64}
      );
  }
}

async function main() {
  bot_init();
  db.init(bot);

  handler.handlers_init(bot); 

  // TODO(Sigull): Help command
  bot.on("ready", async () => {
    await register_commands([...handler.public_commands, ...handler.manager_commands]);
    await startup_bot();
    await leave_unauthorized_guilds();
    console.log("Bot startup finished.");
  });

  // -- Slash commands
  bot.on("interactionCreate", async (interaction) => {
    await interaction_handler_switch(interaction);
  });

  bot.on("guildMemberAdd", (guild, member) => {
    let has_cleaning_role = member.roles.includes(CLEANING_ROLE) ? 1 : 0;
    let nick = get_nick(member);

    db.add_update_user_logged({discord_id: member.id, name: nick, has_role: has_cleaning_role});    
  });

  // TODO(Sigull): Maybe also when removal of roles.
  // -- User syncing to database
  bot.on("guildMemberUpdate", (guild, member, oldMember) => {
    let has_cleaning_role = member.roles.includes(CLEANING_ROLE) ? 1 : 0;
    let nick = get_nick(member);

    if (oldMember.nick != member.nick) {
      db.add_update_user_logged({discord_id: member.id, name: nick, has_role: has_cleaning_role});
    
    // -- User got 'access to club' role
    } else if (!oldMember.roles.includes(CLEANING_ROLE) && has_cleaning_role) {
      db.add_update_user_logged({discord_id: member.id, name: nick, has_role: has_cleaning_role});
    }
  });

  bot.on("guildCreate", (guild) => {
    if (guild.id !== GUILD_ID) {
        console.log(`Joined unauthorized guild ${guild.name}. Leaving...`);
        guild.leave();
    }
  });

  bot.on("error", (err) => {
    console.error("Caught Eris client error:", err.message);
    bot.send_imp_log(err.message);
  });

  bot.on("shardDisconnect", (err, id) => {
    console.log(`Shard ${id} disconnected:`, err?.message);
  });

  bot.connect();
}

main()

// Vibecodenuté věci
const fatal_exit = (() => {
  let exiting = false;

  return (err, source) => {
    if (exiting) return;
    exiting = true;
    console.error(`[fatal:${source}]`, err);
    setTimeout(() => process.exit(1), 100).unref();
  };
})();

process.on("uncaughtException", (err) => {
  (async () => {
    try {
      if (bot) await bot.send_imp_log(`uncaughtException: ${err?.stack || err}`);
    } finally {
      fatal_exit(err, "uncaughtException");
    }
  })();
});

process.on("unhandledRejection", (reason) => {
  (async () => {
    try {
      if (bot) await bot.send_imp_log(`unhandledRejection: ${reason}`);
    } catch {}
    console.error("[unhandledRejection]", reason);
  })();
});


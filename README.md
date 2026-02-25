# Uklidy Bot
## About
Bot for managing semestral (weekly) cleanings on su fit discord.

## Config
- ### MANAGER_ROLE
    - Access to edit/add cleanings commands
    - Správce úklidu

- ### CLEANING_ROLE 
    - People with role should clean 3x per semester
    - Člen s přístupem do klubu 

---

- ### MAIN_CH
    - Public read and use of slash commands. 
    - Regular users shouldn't be able to write.
    - Shows updated schedule. 

- ### LOG_CH
    - Only for manager, all logs

- ### IMP_LOG_CH 
    - Only for manager 
    - important logs such as leave cleaning or join after cleaning started.

- ### GUILD_ID
    - su fit discord
    - bot leaves all other servers than specified here.

## Running
- ### .env
    - Contains bot token
    - BOT_TOKEN="token"

- ### Locally testing
    - node --env-file=.env main.js

- ### Docker
    - docker build -t uklizecka .
    - docker run -d uklizecka

- ### Deployment
    - Ran with systemd/pm2 restart policy.

import DiscordJS, { Collection, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
dotenv.config();

//----------------------------------------------------
// Events and Interactions should not be here.
//

declare module "discord.js" {
    export interface Client {
        commands: Collection<unknown, any>
    }
}

const client = new DiscordJS.Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages
    ]
});

// Command Handling

client.commands = new Collection();
const commandsPath = path.join(__dirname, 'commands');
const commandsFiles = fs.readdirSync(commandsPath).filter((file: string) => file.endsWith('.ts'));

for (const file of commandsFiles)
{
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    client.commands.set(command.data.name, command);
}

// Event Handling

const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter((file: string) => file.endsWith('.ts'));

for (const file of eventFiles) {
    const filePath = path.join(eventsPath, file);
    const event = require(filePath);
    if (event.once)
        client.once(event.name, (...args) => event.execute(...args));
    else
        client.on(event.name, (...args) => event.execute(...args));
}

client.login(process.env.TOKEN);
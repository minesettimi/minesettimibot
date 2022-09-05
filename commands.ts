import { REST, Routes, SlashCommandBuilder } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
dotenv.config();

const commands : any[] = []
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((file : string) => file.endsWith('.ts'));

for (const file of commandFiles) 
{
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    commands.push(command.data.toJSON());
}

const rest = new REST({ version: '10'}).setToken(process.env.TOKEN as string);

rest.put(Routes.applicationGuildCommands(process.env.APP_ID as string, process.env.GUILD_ID as string), { body: commands})
    .then((data : any) => console.log(`Successfully registered ${data.length} application commands.`))
    .catch(console.error);

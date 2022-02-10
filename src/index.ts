import { Client } from "discord.js";
import config from "./config.json";
import { Bot } from "./lib/Bot";
import { Database } from "./lib/Database"

(async () => {	
	const client = new Client({ intents: ['DIRECT_MESSAGES', 'GUILD_MESSAGES', 'GUILDS', 'GUILD_MEMBERS'], partials: ['MESSAGE', 'CHANNEL'] });
	await client.login(config.token);

	let db = new Database();

	client.once('ready', () => {
		console.log("Logged in to Discord");
	})
	
	let bot = new Bot(client, db);	
	
})();


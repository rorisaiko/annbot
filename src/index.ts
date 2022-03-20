import { Client } from "discord.js";
import { Bot } from "./lib/Bot";
import { Database } from "./lib/Database"

const configSrc = (process.argv[2] === 'dev' ? "./config.dev.json" : "./config.json");
import(configSrc).then(async (config) => {

	const client = new Client({ intents: ['DIRECT_MESSAGES', 'GUILD_MESSAGES', 'GUILDS', 'GUILD_MEMBERS'], partials: ['MESSAGE', 'CHANNEL'] });
	await client.login(config.token);

	client.once('ready', () => {
		console.log("Logged in to Discord");
	})

	const db = new Database(config.db.host, config.db.user, config.db.pass, config.db.db);
	const bot = new Bot(client, db, config.discord.errorNotifyID);
});
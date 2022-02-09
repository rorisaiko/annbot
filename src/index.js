//@ts-check

const { Client, Intents, Channel, Guild, Message } = require('discord.js');
const config = require("../config.json");
const client = new Client({ intents: ['DIRECT_MESSAGES', 'GUILD_MESSAGES', 'GUILDS', 'GUILD_MEMBERS'], partials: ['MESSAGE', 'CHANNEL'] });
const codePattern = /^[A-Z0-9]{1,6}-[A-Z0-9-]{1,6}$/;

const mysql = require("mysql2");
var con;
con = mysql.createPool({
	host: config.db.host,
	user: config.db.user,
	password: config.db.pass,
	database: config.db.db
}).promise();


// Login the bot to Discord
client.login(config.token);

// [For debug]
client.once('ready', () => {
	console.log("Logged in to Discord");
})

// When the bot sees a message
client.on('messageCreate', async (message) => {

	// The bot only cares about the messages from real users (not bots), either in DM or mentioning the bot in any non-DM text channels
	// Care: not bot and (dm or mentioned)
	// Don't care: bot or (not dm and not mentioned)
	if (message.author.bot || (message.channel.type !== "DM" && !(message.content.startsWith(`<@!${client.user.id}>`)) && !(message.content.startsWith(`<@${client.user.id}>`)))) return;
	
	var cmd, msg, args = [];
	// Take away the mention from the msssage if the bot was mentioned
	if (message.content.startsWith(`<@`))
		msg = message.content.replace((/^<@[^>]*> /),"");
	else {
		msg = message.content;
	}
	
	// Exit if the message is empty apart from the mention
	if (!msg.trim()) {
		message.reply("Hey what's up?")
		return;
	}
	
	[cmd, ...args] = msg.trim().split(/[,\s]+/);

	try {
		switch (cmd.toLowerCase()) {
			case "help":
				showHelp(message);
			break;
			case "add":
				addRecords(message, args);
			break;
			case "remove":
			case "delete":
				removeRecords(message, args);
			break;
			case "listmine":
				listMine(message);
			break;
			case "whohas":
				whoHas(message, args);
			break;
			case "echo":
				message.reply("echo");
			break;
		}
		} catch (e) {
			var notifyUser = (await client.users.fetch(config.discord.errorNotifyID));
			notifyUser.send(`Error executing command "${msg}" entered by user ${message.author.tag}`);
			notifyUser.send(e);
	}
	
})

/**
 * Show the help message to the user
 * @param {Message} message - message object returned by the client listener
 */
function showHelp(message) {
	message.channel.send(`You can use the following commands:

add <Title ID> [<Title ID>...]
Add one or more Title IDs into the database. Multiple Title IDs should be separated with spaces or commas.
Example: add SKIB-049 CBSKY-046

remove <Title ID]> [<Title ID>...]
Remove a Title ID that you added to the database before. Multiple Title IDs should be separated with spaces or commas.
Example: remove SKIB-049 CBSKY-046

listmine
List all Title IDs that you added.

whohas <Title ID> [<Title ID>...]
Check the database and see if anyone who has tbe title ID(s). Multiple Title IDs should be separated with spaces or commas`);
}

/**
 * User command "add" - Add titles to the database
 * @param {Message} message - message object returned by the client listener
 * @param {string[]} args - Array of arguments in the user command
 * @returns void
 */
async function addRecords(message, args) {

	// Exit if there is no argument provided
	if (args.length == 0) {
		message.channel.send("Please tell me what title you would like to add");
		return;
	}

	// Change the title IDs to ALL CAPS
	const toAdd = processTitleIDs(args);
	const userID = message.author.id;
	const userTag = message.author.tag;	

	let titlesAdded = 0, newContributor = false, outputMsgs = [];
	if(toAdd.length > 0) {
		
		// Check if the user exists in the users table. If not, add it first - otherwise titles cannot be added due to foreign keys constriant
		let sql = 'SELECT userid FROM gnt_users WHERE userid = ?';
		var [rows, fields] = await con.execute(sql, [userID]);
		if (rows.length == 0) {
			sql = 'INSERT INTO gnt_users (userid, usertag) VALUES ?';
			const [rows, fields] = await con.query(sql, [[[userID, userTag]]]);
			newContributor = true;
		}

		// Remove the titles that already exist in the titles table from toAdd[]
		const toAddIntoDB = [], alreadyAdded = [];
		sql = 'SELECT titleid FROM gnt_titles WHERE userid = ? AND titleid IN (?) ORDER BY titleid';
		[rows, fields] = await con.query(sql, [userID, toAdd]);
		for (const iterator of rows) {
			toAdd.splice(toAdd.indexOf(iterator.titleid),1);
			alreadyAdded.push(iterator.titleid);			
		}
		if (alreadyAdded.length) outputMsgs.push(`You have already added ${alreadyAdded.join(", ")}`);

		// If there is still anything to add, add it to the database
		if(toAdd.length) {
			for (const iterator of toAdd) {
				toAddIntoDB.push([iterator, userID])
			}
			
			sql = `INSERT INTO gnt_titles (titleid, userid) VALUES ?`;
			[rows, fields] = await con.query(sql, [toAddIntoDB]);
			titlesAdded += parseInt(rows.affectedRows);
		}
		outputMsgs.push(`${titlesAdded} title ID${titlesAdded > 1 ? "s have" : " has"} been added to the database`);
		if (newContributor) outputMsgs.push("Thank you for your first contribution!");
	}
	else {
		outputMsgs.push("No title ID has been added")
	}

	message.reply(outputMsgs.join("\n"));
	
}

/**
 * "listmine" command - List the user's own titles
 * @param {Message} message - Message object returned by the client listener
 */
async function listMine(message) {
	const sql = `SELECT titleid FROM gnt_titles WHERE userid = ? ORDER BY titleid`;
	const [rows, fields] = await con.query(sql, [message.author.id]);

	const showResult = [];
	for (const eachResult of rows) {
		showResult.push(eachResult.titleid);
	}
	if(showResult.length == 0) {
		message.reply("You have not registered any videos yet")
	} else {
		message.reply(`You have registered the following ${showResult.length} Title ID${showResult.length > 1 ? "s" : ""}:\n` + showResult.join(", "));
	}

}

/**
 * "remove" command - Remove titles from the database
 * @param {Message} message - Message object returned by the client listener
 * @param {string[]} args - Array of arguments in the user command
 * @returns void
 */
async function removeRecords(message, args) {

	// Exit if there is no argument provided
	if (args.length == 0) {
		message.channel.send("Please tell me what video you would like to remove");
		return;
	}

	const toRemove = processTitleIDs(args);
	const inDB = [];

	if (toRemove.length > 0) {
		var sql = `SELECT id FROM gnt_titles WHERE userid = ? AND titleid in (?)`;
		var [rows, fields] = await con.query(sql, [message.author.id, toRemove]);
		
		for (const eachResult of rows) {
			inDB.push(eachResult.id);
		}
		if (inDB.length > 0) {
			sql = `DELETE FROM gnt_titles WHERE id IN (?)`;
			[rows, fields] = await con.query(sql,[inDB]);
		}
		message.reply(`${inDB.length} Title ID${inDB.length > 1 ? "s have" : " has"} been removed from the database`);
	}
	else {
		message.reply("No Title ID has been removed")
	}
	
}

/**
 * "whohas" command - Get the tags of the users who have the specified titles
 * @param {Message} message - Message object returned by the client listener
 * @param {string[]} args - Array of arguments in the user command
 * @returns void
 */
async function whoHas(message, args) {
	if (args.length == 0) {
		message.channel.send("Please tell me what title ID you would like to know about");
		return;
	}

	const toCheck = processTitleIDs(args);
	const outputMsgs = [];
	
	if (toCheck.length === 0) {
		message.channel.send("The title ID(s) you entered in invalid. Please try again.")
		return;
	}

	for (const titleID of toCheck) {
		
		// Get the userid of the users who have the titles requested
		var sql = `SELECT userid FROM gnt_titles WHERE titleid = ?`;
		var [rows, fields] = await con.query(sql, [titleID]);
		var userIDs = [];
		for (const iterator of rows) {
			userIDs.push(iterator.userid);
		}
		
		// Show the users who have the titles requested
		if (userIDs.length > 0) {
			if(userIDs.length > 1) {
				outputMsgs.push(`The following users have ${titleID}:\n<@!${userIDs.join(">, <@!")}>`);
			} else {
				outputMsgs.push(`<@${userIDs[0]}> has ${titleID}`);
			}
		}
		else {
			outputMsgs.push(`No one has ${titleID}`)
		}
	}
	message.reply({
		content: outputMsgs.join("\n"),
		allowedMentions: {parse: []}
	});
}

/**
 * Helper function to change title IDs in user command to uppercase and remove the hyphens
 * @param {string[]} args - Array of strings from the user command
 * @returns {string[]} resultArr
 */
function processTitleIDs(args) {
	const resultArr = [];
	for (var videoCode of args) {
		resultArr.push(videoCode.toUpperCase());
	}
	return resultArr;
}

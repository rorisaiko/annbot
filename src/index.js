//@ts-check

const { Client, Intents, Channel, Guild, Message } = require('discord.js');
const config = require("../config.json");
const client = new Client({ intents: ['DIRECT_MESSAGES', 'GUILD_MESSAGES', 'GUILDS'], partials: ['MESSAGE', 'CHANNEL'] });
const codePattern = /^[A-Z0-9]{1,6}-[A-Z0-9-]{1,6}$/;

const mysql = require("mysql2/promise");
var con;
async function preparesql() {
	con = await mysql.createConnection({
		host: config.db.host,
		user: config.db.user,
		password: config.db.pass,
		database: config.db.db
	});
	
}
preparesql();

// Login the bot to Discord
client.login(config.token);

// [For debug]
client.once('ready', () => {
	console.log("Logged in to Discord");
})

// When the bot sees a message
client.on('messageCreate', async (message) => {

	// The bot only cares about the message from real users (not bots) in the specified bot channel and DMs
	// Care: not bot and (dm or botchannel)
	// Don't care: bot or (not dm and not botchannel)
	if (message.author.bot || (message.channel.type !== "DM" && !(message.channel.type === "GUILD_TEXT" && message.channelId === config.discord.botChannel))) return;

	// Analyze command and arguments
	const [cmd, ...args] = message.content.trim().split(/[,\s]+/);
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

	// Filter the valid title IDs
	const toAdd = [], userID = message.author.id, userTag = message.author.tag;
	for (var titleID of args) {
		titleID = titleID.toUpperCase();
		if (codePattern.test(titleID)) {
			titleID = mysql.escape(titleID).replace(/'/g,"");
			toAdd.push(titleID);
		}			
	}

	let titlesAdded = 0, newContributor = false, outputMsgs = [];
	if(toAdd.length > 0) {
		
		// Check if the user exists in the users table. If not, add it first - otherwise titles cannot be added due to foreign keys constriant
		let sql = 'SELECT userid FROM users WHERE userid = ?';
		var [rows, fields] = await con.execute(sql, [userID]);
		if (rows.length == 0) {
			sql = 'INSERT INTO users (userid, usertag) VALUES ?';
			const [rows, fields] = await con.query(sql, [[[userID, userTag]]]);
			newContributor = true;
		}

		// Remove the titles that already exist in the titles table from toAdd[]
		const toAddIntoDB = [], alreadyAdded = [];
		sql = 'SELECT titleid FROM titles WHERE userid = ? AND titleid IN (?) ORDER BY titleid';
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
			
			sql = `INSERT INTO ${config.db.table} (titleid, userid) VALUES ?`;
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
	const sql = `SELECT titleid FROM ${config.db.table} WHERE userid = ?`;
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

	const toRemove = [], inDB = [];
	filterVideoCode(args, toRemove);

	if (toRemove.length > 0) {
		var sql = `SELECT id FROM ${config.db.table} WHERE userid = ? AND titleid in (?)`;
		var [rows, fields] = await con.query(sql, [message.author.id, toRemove]);
		
		for (const eachResult of rows) {
			inDB.push(eachResult.id);
		}
		if (inDB.length > 0) {
			sql = `DELETE FROM ${config.db.table} WHERE id IN (?)`;
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

	const toCheck = [], outputMsgs = [];
	filterVideoCode(args, toCheck);
	if (toCheck.length === 0) {
		message.channel.send("The title ID(s) you entered in invalid. Please try again.")
		return;
	}

	for (const titleID of toCheck) {
		
		// Get the userid of the users who have the titles requested
		var sql = `SELECT userid FROM ${config.db.table} WHERE titleid = ?`;
		var [rows, fields] = await con.query(sql, [titleID]);
		var userIDs = [];
		for (const iterator of rows) {
			userIDs.push(iterator.userid);
		}
		
		// Lookup the tags of the users who have the titles requested
		if (userIDs.length > 0) {
			var usertags = [];
			sql = `SELECT usertag FROM users WHERE userid in (?)`;
			[rows, fields] = await con.query(sql, [userIDs]);
			for (const iterator of rows) {
				usertags.push(iterator.usertag);
			}
			outputMsgs.push(`The following user${usertags.length > 1 ? "s have" : " has"} ${titleID}\n- ${usertags.join(", ")}`);
		}
		else {
			outputMsgs.push(`No one has ${titleID}`)
		}
	}
	message.reply(outputMsgs.join("\n"));
}

/**
 * Helper function to filter the valid title IDs in user command
 * @param {string[]} args - Array of strings from the user command
 * @param {string[]} targetArray - Array that the title IDs should be put in
 */
function filterVideoCode(args, targetArray) {
	for (var videocode of args) {
		videocode = videocode.toUpperCase();
		if (codePattern.test(videocode)) {
			videocode = mysql.escape(videocode).replace(/'/g,"");
			targetArray.push(videocode);
		}			
	}
}

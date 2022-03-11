import {Client, Message, MessageEmbed, MessageCollector} from 'discord.js';
import config from "../config.json";
import { processTitleIDs } from "./util"
import { Database } from './Database';
import { Idol, idolNameResult} from "./models";
import { Menu } from './Menu';

export class Bot {

	private activeMenus: Menu[] = [];
	private activeMenuUsers: string[] = [];

	constructor(private client: Client, private db: Database) {
		this.main();
		
	}

	private main (): void {
		this.client.on('messageCreate', async (message) => {
		
			// The bot only cares about the messages from real users (not bots), either in DM or mentioning the bot in any non-DM text channels
			// Care: not bot and (dm or mentioned)
			// Don't care: bot or (not dm and not mentioned)
			if (message.author.bot || (message.channel.type !== "DM" && !(message.content.startsWith(`<@!${this.client.user!.id}>`)) && !(message.content.startsWith(`<@${this.client.user!.id}>`)))) return;
			
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
			
			switch (cmd.toLowerCase()) {
				case "add":
					this.addRecords(message, args).catch(this.errorHandling.bind(this, message));
				break;
				case "remove":
				case "delete":
					this.removeRecords(message, args).catch(this.errorHandling.bind(this, message));
				break;
				case "listmine":
					this.listMine(message).catch(this.errorHandling.bind(this, message));
				break;
				case "whohas":
					this.whoHas(message, args).catch(this.errorHandling.bind(this, message));
				break;
				case "echo":
					message.reply("echo");
				break;
				case "info":
					const subCmd = args.shift();
					switch (subCmd) {
						case "idol":
							this.infoIdol(message, args).catch(this.errorHandling.bind(this, message));
						break;
						case "title":
							this.infoTitle(message, args).catch(this.errorHandling.bind(this, message));
						break;
						default:
							message.reply (`Sub-command "${subCmd}" not found`);
					}
				break;
			}
	
		});
	
	}

	private async errorHandling(message: Message, e:any) {
		var notifyUser = (await this.client.users.fetch(config.discord.errorNotifyID));
		notifyUser.send(`Error executing command "${message}" entered by user ${message.author.tag}`);
		if(typeof e === 'string') notifyUser.send(e);
		else if(e instanceof Error) notifyUser.send(e.message);
		console.log('----------------------------------');
		console.log(Date().toString());
		console.log(`Error executing command "${message}" entered by user ${message.author.tag}`)
		console.log(e);
		message.reply('Sorry, your command could not be executed successfully. The bot developer has been informed. Please try another command.')
}

	/**
	 * User command "add" - Add titles to the database
	 * @param {Message} message - message object returned by the client listener
	 * @param {string[]} args - Array of arguments in the user command
	 * @returns void
	 */
	private async addRecords(message: Message, args: string[]): Promise<void> {
		
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
			let rows = await this.db.dbSelect(sql, [userID]);
			if (rows.length == 0) {
				sql = 'INSERT INTO gnt_users (userid, usertag) VALUES ?';
				await this.db.dbInsDel(sql, [[[userID, userTag]]]);
				newContributor = true;
			}

			// Remove the titles that already exist in the titles table from toAdd[]
			const toAddIntoDB = [], alreadyAdded = [];
			sql = 'SELECT titleid FROM gnt_titles WHERE userid = ? AND titleid IN (?) ORDER BY titleid';
			rows = await this.db.dbSelect(sql, [userID, toAdd]);
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
				let result = await this.db.dbInsDel(sql, [toAddIntoDB]);
				titlesAdded += result.affectedRows;
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
	private async listMine(message: Message): Promise<void> {
		const sql = `SELECT titleid FROM gnt_titles WHERE userid = ? ORDER BY titleid`;
		const rows = await this.db.dbSelect(sql, [message.author.id]);

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
	private async removeRecords(message: Message, args: string[]): Promise<void> {

		// Exit if there is no argument provided
		if (args.length == 0) {
			message.channel.send("Please tell me what video you would like to remove");
			return;
		}

		const toRemove = processTitleIDs(args);
		const inDB = [];

		if (toRemove.length > 0) {
			var sql = `SELECT id FROM gnt_titles WHERE userid = ? AND titleid in (?)`;
			var rows = await this.db.dbSelect(sql, [message.author.id, toRemove]);
			
			for (const eachResult of rows) {
				inDB.push(eachResult.id);
			}
			if (inDB.length > 0) {
				sql = `DELETE FROM gnt_titles WHERE id IN (?)`;
				await this.db.dbInsDel(sql,[inDB]);
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
	private async whoHas(message: Message, args: string[]): Promise<void> {
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
			var rows = await this.db.dbSelect(sql, [titleID]);
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
	 * "info title" command - Show info of a title
	 * @param {Message} message - Message object returned by the client listener
	 * @param {string[]} args - Array of arguments in the user command
	 */
	async infoTitle(message: Message<boolean>, args: string[]): Promise<void> {

		const titleID = args.shift();

		// Retrieve the title
		let sql = 'SELECT jt.id, jtt.name titletype, jt.name, jt.releasedate, jt.dvdid, jt.bdid, jt.link_id, jt.coverurl, jt.producturl, jl.site, jl.coverurl as coverpath, jl.producturl as productpath '+
					'FROM ji_title AS jt ' +
						'JOIN ji_title_type jtt ON jt.type_id = jtt.id ' +
						'LEFT JOIN ji_link jl ON jl.id = jt.link_id '+
					'WHERE jt.id = ?';
		const titleRows = await this.db.dbSelect(sql, titleID);

		// Retrieve the idols in the title
		sql = 'SELECT jt.id, jn.kanji, jn.eng, jti.age, jti.age_notes, ji.code idolcode '+
				'FROM `ji_title` jt '+
					'JOIN `ji_titleidol` jti ON jt.id = jti.title_id '+
					'JOIN `ji_name` jn ON jn.id = jti.name_id '+
					'JOIN ji_idol ji ON ji.id = jti.idol_id '+
				'WHERE jt.id = ?';
		const idolRows = await this.db.dbSelect(sql, titleID)

		if(titleRows.length > 0) {
			const title = titleRows[0];
			const embedMsg = new MessageEmbed()
				.setColor('#3498DB')
				.setTitle(`${title.id} (${String(title.titletype).toUpperCase()})`)
				.addField(`Title`, title.name, true);

			if(title.link_id) {
				if(String(title.link_id).startsWith('http')) embedMsg.setURL(title.producturl);
				else embedMsg.setURL(title.productpath + title.producturl);
			}
			
			if(title.releasedate) embedMsg.addField(`Release Date`, title.releasedate, true);	
			
			let idolArr: string[] = [];
			for(let idolRow of idolRows) {
				idolArr.push(`${idolRow.eng} (${idolRow.kanji})` + (idolRow.age ? ` - Age: ${idolRow.age}` : ''));
			}
			embedMsg.addField((idolArr.length > 1 ? `Idols` : `Idol`), idolArr.join("\n"));

			if(title.coverurl) {
				if(String(title.coverurl).startsWith("http")) embedMsg.setImage(title.coverurl);
				else embedMsg.setImage(title.coverpath + title.coverurl);
			} else {
				embedMsg.addField('Cover', '(Sorry, no cover image yet)')
			}
			message.reply({embeds: [embedMsg]});
		} else {
			message.reply("Title not found");
		}
	}

	/**
	 * Show the information of one of more idols
	 * @param {Message} message - Message object returned by the message listener
	 * @param {string[]} args - Command arguments
	 */

	private async infoIdol(message: Message, args: string[]): Promise<void> {
		let idolName = '';
		const tempStr = [], outputMsgs = [];
		let retrieving = false;
		
		// Read the command arguments
		for (let element of args) {
			if (retrieving) {
				if (element.endsWith('"') || element.endsWith('”')) {
					retrieving = false;
					tempStr.push(element.slice(0,-1));
					idolName = tempStr.join(" ");
					break;
				} else {
					tempStr.push(element);
				}
			} else {
				if (element.startsWith('"') || element.startsWith('“')) {
					retrieving = true;
					tempStr.push(element.slice(1));
				} else {
					idolName = element;
					break;
				}
			}
		}

		// Get the idols with specified name
		const IDrows = await this.db.getIdolsByName(idolName);

		// Get the idol details of the idols retrived above
		const idolRows = await this.db.getIdolDetailsByIdol(IDrows);

		// Get 1 title per idol, if any, preferably with cover
		////// Stopped here

		
		if(!idolRows.length) {
			message.reply("Idol name not found");
			return;
		}

		// Populate the Idols[] array with the data retrieved from the database
		const Idols: Idol[] = [];
		let curIdol: Idol | undefined, curIdolID = '';
		for (let row of idolRows) {
			if(row.id !== curIdolID) {
				curIdolID = row.id;
				if(curIdol !== undefined) {
					curIdol.name.sort(Idol.idolNameStructCompare);
					Idols.push(curIdol);
				}
				curIdol = new Idol([]);
				if(!row.dob_u15.startsWith('0'))
					curIdol.dob = row.dob_u15;				
			}
			curIdol!.name.push({nameEng: row.eng, nameJpn: row.kanji, namePrimary: row.primaryname ? true : false});

		}
		curIdol!.name.sort(Idol.idolNameStructCompare);
		Idols.push(curIdol!);

		// Display the idols
		const embedMsg = new MessageEmbed().setColor('#3498DB');
		let names: string[] = [];
		if(Idols.length > 1) {	// More than 1 idol were found
			let idolOutput = '', DOBOutput = '';

			for (let i = 0; i < Idols.length; i++) {
				idolOutput += `${i+1}. `;
				for (const curName of Idols[i].name)
					names.push(`${curName.nameEng} (${curName.nameJpn})`);
				idolOutput += names.join(' / ') + '\n';
				if(Idols[i].dob)
					idolOutput += `DOB: ${Idols[i].dob}\n`;
				idolOutput += '\n';
			}

			idolOutput = idolOutput.slice(0, idolOutput.length-2) // Remove the last \n
			embedMsg.setTitle('More than 1 idol record found')
					.addField('Idols', idolOutput);
		} else {				// Only 1 idol was found (Already returned right after the DB query if no idol was found)
			let curIdol = Idols.shift() ?? new Idol([]); // There is no way that curIdol is undefined - just to stop TS from bitching about curIdol may be undefined
			embedMsg.setTitle(`${curIdol.name[0].nameEng} (${curIdol.name[0].nameJpn})`);
			for (const curName of curIdol.name)
				names.push(`${curName.nameEng} (${curName.nameJpn})`);
			embedMsg.addField('Name', names.join(' / '));
			if(curIdol.dob)
				embedMsg.addField('DOB', `${curIdol.dob}`);
		}
		const newMsg = await message.reply({embeds: [embedMsg]});

		// const curMenu = new Menu();
		// curMenu.generate(newMsg, {numbersUpTo: 5, hasNext: true});
	}
}

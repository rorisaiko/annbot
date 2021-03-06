import {Client, Message, MessageEmbed, TextChannel} from 'discord.js';
import { processTitleIDs } from "./util"
import { Database } from './Database';
import { CmdInfo, OptionPair, SharedItem } from './models';

export class Bot {

	constructor(private client: Client, private db: Database, private errorNotifyID: string) {
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
			
			[cmd, ...args] = msg.trim().split(/\s+/);
			let subCmd = '';

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
					if(!args.length) {
						message.reply("Missing sub-command for 'info'");
						return;	
					}
					subCmd = args.shift()!;					
					switch (subCmd) {
						case "title":
							this.infoTitle(message, args).catch(this.errorHandling.bind(this, message));
							break;
						default:
							message.reply (`Sub-command "${subCmd}" not found`);
					}
					break;
				case "share":
					if(!args.length) {
						this.shareAdd(message, args).catch(this.errorHandling.bind(this, message));
						message.reply("Missing sub-command for 'info'");
						return;
					}
					subCmd = args.shift()!;
					switch(subCmd) {
						case "add":
							this.shareAdd(message, args).catch(this.errorHandling.bind(this, message));
							break;
					}
					break;
				
			}
	
		});
	
	}

	private async errorHandling(message: Message, e:any) {
		var notifyUser = (await this.client.users.fetch(this.errorNotifyID));
		notifyUser.send(`Error executing command "${message}" entered by user ${message.author.tag}`);
		if(typeof e === 'string') notifyUser.send(e);
		else if(e instanceof Error) notifyUser.send(e.message);
		console.log('----------------------------------');
		console.log(Date().toString());
		console.log(`Error executing command "${message}" entered by user ${message.author.tag}`)
		console.log(e);
		message.reply('Sorry, your command could not be executed successfully. The bot developer has been informed. Please try another command.')
	}

	private parseCmd(args: string[]): CmdInfo {

		let inQuote = false, quoteText = '';
		let optionPairArr: OptionPair[] = [];
		let paramArr: string[] = [];
		let curOption = new OptionPair();
		const curCmdInfo = new CmdInfo();
		
		while(args.length > 0) {
			
			let curArg = args.shift()!;

			if(inQuote) {
				if(curArg.endsWith('"')) {
					quoteText += ` ${curArg.slice(0,-1)}`;
					if(curOption.option) {
						curOption.valueTooLong = quoteText.length > 255;
						curOption.value = quoteText.slice(0,255); // Only the first 255 characters are captured
						optionPairArr.push(curOption);
						curOption = new OptionPair();
					} else {
						paramArr.push(quoteText);
					}
					inQuote = false;
					quoteText = '';
				} else {
					quoteText += ` ${curArg}`;
				}
			} else {
				if(curArg.startsWith('"')) {
					if(curArg.endsWith('"')) {
						quoteText = `${curArg.slice(1,-1)}`;
						if(curOption.option) {
							curOption.valueTooLong = quoteText.length > 255;
							curOption.value = quoteText.slice(0,255); // Only the first 255 characters are captured
							optionPairArr.push(curOption);
							curOption = new OptionPair();
						} else {
							paramArr.push(quoteText);
						}
						quoteText = '';
					} else {
						inQuote = true;
						quoteText = curArg.slice(1);
					}
				} else if(curArg.startsWith('-')) {
					if(curOption.option) {
						optionPairArr.push(curOption);
						curOption = new OptionPair();
					}
					curOption.option = curArg.slice(1).toLowerCase();
				} else {
					if(curOption.option) {
						curOption.value = curArg;
						optionPairArr.push(curOption);
						curOption = new OptionPair();
					} else {
						paramArr.push(curArg);
					}
				}
			}	
		}

		if(inQuote) {
			curCmdInfo.errorMsg = 'Unterminated quoted-text detected. Please check your command and try again.';
			return curCmdInfo;
		}

		if(curOption.option)
			optionPairArr.push(curOption);

		curCmdInfo.params = paramArr;
		curCmdInfo.options = optionPairArr;
		return curCmdInfo;
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
			if (!await this.db.gntIfUserExists(userID)) {
				await this.db.gntAddUser(userID, userTag);				
				newContributor = true;
			}

			// Remove the titles that already exist in the titles table from toAdd[]
			const toAddIntoDB: [string, string][] = [], alreadyAdded: string[] = [];
			const rows = await this.db.gntGetTitleIDsByUserIDAndTitleIDs(userID, toAdd);
			for (const iterator of rows) {
				toAdd.splice(toAdd.indexOf(iterator.titleid),1);
				alreadyAdded.push(iterator.titleid);			
			}
			if (alreadyAdded.length) outputMsgs.push(`You have already added ${alreadyAdded.join(", ")}`);

			// If there is still anything to add, add it to the database
			if(toAdd.length) {
				const deduplicated = [...new Set(toAdd)];
				for (const iterator of deduplicated) {
					toAddIntoDB.push([iterator, userID])
				}
				
				let result = await this.db.gntAddTitles(toAddIntoDB);
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
		const rows = await this.db.gntGetTitleIDsByUserID(message.author.id);

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
			const rows = await this.db.gntGetIDsByUserIDAndTitleIDs(message.author.id, toRemove);
			
			for (const eachResult of rows) {
				inDB.push(eachResult.id);
			}
			if (inDB.length > 0) {
				await this.db.gntDelTitlesByID(inDB);
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
			var rows = await this.db.gntGetUserIDsbyTitleID(titleID);
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
	 * @param {TextChannel} shareChannel - TextChannel object. Only required if this function is called by the share function
	 * @returns {boolean} Whether a title is found
	 */
	async infoTitle(message: Message<boolean>, args: string[], shareChannel?: TextChannel): Promise<boolean> {

		const titleID = args.shift();

		if(!titleID) {
			message.reply('Please specify a title ID');
			return false;
		}

		// Retrieve the title
		const titleRows = await this.db.getTitleByTitleID(titleID);

		// Retrieve the idols in the title
		const idolRows = await this.db.getIdolsByTitleID(titleID);

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
			
			const idolArr: string[] = [];
			for(let idolRow of idolRows) {
				idolArr.push(`${idolRow.eng} (${idolRow.kanji})` + (idolRow.age ? ` - Age: ${idolRow.age}` : ''));
			}
			if(idolArr.length)
				embedMsg.addField((idolArr.length > 1 ? `Idols` : `Idol`), idolArr.join("\n"));

			if(title.coverurl) {
				if(String(title.coverurl).startsWith("http")) embedMsg.setImage(title.coverurl);
				else embedMsg.setImage(title.coverpath + title.coverurl);
			} else {
				embedMsg.addField('Cover', '(Sorry, no cover image yet)')
			}
			
			if(shareChannel) {
				shareChannel.send({embeds: [embedMsg]});
				return true;
			} else {
				message.reply({embeds: [embedMsg]});
				return true;
			}
		} else {
			if(!shareChannel)
				message.reply("Title not found");
			return false;
		}
	}

	/**
	 * "Share add" command for sharing a download link
	 * @param message - Message object returned by the client listener
	 * @param args - Array of the arguments in the user command
	 * @returns Nothing
	 */
	async shareAdd(message: Message<boolean>, args: string[]): Promise<void> {

		let inProgress = '', sharedItem = new SharedItem(), inQuote = false, quoteText = '';

		const cmdInfo = this.parseCmd(args);

		// Terminate if there is any error while parsing the command
		if(cmdInfo.errorMsg) {
			message.reply(cmdInfo.errorMsg);
			return;
		}

		// Terminate if the number of title ID does not equal to 1
		if(!cmdInfo.params.length) {
			message.reply('Please at least specify a title ID');
			return;
		} else if (cmdInfo.params.length > 1) {
			message.reply(`More than 1 title ID have been specified: ${cmdInfo.params.toString()}. Please only specify 1 title ID.`);
			return;
		}

		sharedItem.titleID = cmdInfo.params[0]!.toUpperCase();

		while(cmdInfo.options.length) {
			let curOption = cmdInfo.options.pop()!;
			switch(curOption.option) {
				case 'url':
					sharedItem.url = curOption.value.toLowerCase();
					break;
				case 'password':
					sharedItem.pwd = curOption.value;
					break;
				case 'bitrate':
					sharedItem.bitRate = curOption.value;
					break;
				case 'size':
					sharedItem.size = curOption.value;
					break;
				case 'length':
					sharedItem.length = curOption.value;
					break;
				case 'category':
					const category = curOption.value.toLowerCase();
					const resultArr = await this.db.getChannelIDByName(category);
					if(resultArr.length)
						sharedItem.channel = resultArr[0];
					else {
						message.reply(`Sorry, the category ${category} is invalid.`);
						return;
					}
					break;
				case 'comment':
				case 'comments':
					sharedItem.comments = curOption.value;
					break;
				default:
					message.reply(`Invalid parameter: ${curOption.option}`);
					return;
			}

		}

		// Check if URL is missing
		if(!sharedItem.url) {
			message.reply("URL is missing. Please check your command");
			return;
		}

		sharedItem.userID = message.author.id;

		// Check if the "category" parameter exists if it is a DM
		if(message.channel.type === 'DM' &&  !sharedItem.channel) {
			message.reply('Parameter "category" is missing. Please either run this command in an appropriate "video-downloads" channel, or include the "category" parameter.');
			return;
		}

		// Check if the command is executed in a correct channel if it is not a DM
		if(message.channel.type === 'GUILD_TEXT') {
			const correctChannels = await this.db.getAllChannelIDs();
			if(correctChannels.includes(message.channelId)) {
				sharedItem.channel = message.channelId;
			} else {
				message.reply('Please either run this command in a DM with the bot, or in any of the video-download channels');
				return;
			}
		}

		const msgChannel = this.client.channels.cache.get(sharedItem.channel) as TextChannel;
		const embedMsg = new MessageEmbed()
			.setColor('DARK_GREEN')
			.setTitle(`${sharedItem.titleID}`)
			.setURL(sharedItem.url)
			.addField('Size:', sharedItem.size ?? '-', true)
			.addField('Length:', sharedItem.length ?? '-', true)
			.addField('Bitrate:', sharedItem.bitRate ?? '-', true)
			.addField('Link:', sharedItem.url)
			.addField('Password:', sharedItem.pwd ?? '-', true)
			.addField('Shared by:', `<@${sharedItem.userID}>`, true);
		
		if(sharedItem.comments)
			embedMsg.addField('Comments:', sharedItem.comments);

		msgChannel.send({embeds: [embedMsg], allowedMentions: {parse: []}});

		// Check if the title is in gntTitle. If not, add it.
		const result = await this.db.gntGetTitleIDsByUserIDAndTitleIDs(sharedItem.userID, [sharedItem.titleID])
		if(!result.length) {
			await this.db.gntAddTitles([[sharedItem.titleID, sharedItem.userID]]);
		}

		// Post "title info" command to the download channel if title is found
		if(!await this.infoTitle(message, [sharedItem.titleID], msgChannel)) {
			message.reply('Thank you for sharing. This title is not found in the database yet. Please also submit additional info in the download info, e.g. idol name(s), age(s), cover, etc.')
		}

		// Write to database
		if(await this.db.getShareByTitleIDAndUserID(sharedItem.titleID, sharedItem.userID)) {
			await this.db.updateShare(sharedItem);
		}
		else {
			await this.db.addShare(sharedItem);
		}
	}

}
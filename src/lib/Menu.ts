import { Message } from "discord.js";
import { menuOptions } from "./models";

export class Menu {
	constructor() {
		
	}

	async generate(msg: Message, options: menuOptions): Promise<void> {
		const numbers = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
		if (options.hasPrevious) {
			await msg.react('◀')
		}
		for (let i = 0; i < Math.min(options.numbersUpTo,numbers.length); i++) {
			await msg.react(numbers[i]);
			console.log(`Reacting with ${i+1}`);
		}
		if (options.hasNext) {
			await msg.react('▶')
		}
	}


}
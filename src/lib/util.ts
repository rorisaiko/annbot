/**
 * Helper function to change title IDs in user command to uppercase and remove the hyphens
 * @param {string[]} args - Array of strings from the user command
 * @returns {string[]} resultArr
 */
export function processTitleIDs(args: string[]): string[] {
	const resultArr = [];
	for (var videoCode of args) {
		resultArr.push(videoCode.toUpperCase());
	}
	return resultArr;
}
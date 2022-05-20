class Idol {
	constructor (
		nameEng: string,
		nameJpn: string,
		dob?: string,
	) {}
}

class Title {
	idols: Idol[] = [];
	idolAgesU15: number[] = [];
	titlesIncluded: Title[] = [];
	cover = "";
	
	constructor (
		public id: string,
		public type: TitleType,
		public name: string,
		public releaseDate: string,
	) {}
}

export class SharedItem {
	titleID = '';
	url = '';
	pwd = '';
	bitRate = '';
	size = '';
	length = '';
	userID = '';
	date = new Date();
	channel = '';
	comments = '';
}

export class OptionPair {
	valueTooLong = false;
	constructor (
		public option = '',
		public value = '',
	 ) {}

}

export class CmdInfo {
	errorMsg = '';
	constructor (
		public params: string[] = [],
		public options: OptionPair[] = []
	) {}
}

export enum TitleType {
	'dvd',
	'bd',
	'dvd-box',
	'bd-box',
}

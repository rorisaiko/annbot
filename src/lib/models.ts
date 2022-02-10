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

export enum TitleType {
	'dvd',
	'bd',
	'dvd-box',
	'bd-box',
}

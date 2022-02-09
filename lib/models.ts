class Idol {
	constructor (
		nameEng: string,
		nameJpn: string,
		dob?: string,
	) {}
}

class Title {
	idols: Idol[];
	idolAgesU15: number[];
	titlesIncluded: Title[] = [];
	cover: string;
	
	constructor (
		id: string,
		type: TitleType,
		name: string,
		releaseDate: string,
	) {}
}

export enum TitleType {
	'dvd',
	'bd',
	'dvd-box',
	'bd-box',
}

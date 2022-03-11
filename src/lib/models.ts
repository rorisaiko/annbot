export class Idol {
	public namePrimary: boolean[] = [];
	public dob?: string;
	public titles?: Title[];

	constructor (
		public name: idolNameStruct[]
	) {}

	static idolNameStructCompare (ins1: idolNameStruct, ins2: idolNameStruct) {
		if(ins1.namePrimary && !ins2.namePrimary)
			return -1;
		else if(!ins1.namePrimary && ins2.namePrimary)
			return 1;
		else {
			if(ins1.nameEng > ins2.nameEng)
				return -1;
			else if(ins1.nameEng < ins2.nameEng)
				return 1;
			else
				return 0;
		}		
	}}

export interface idolNameStruct {
	nameEng: string,
	nameJpn: string,
	namePrimary: boolean,
}

export interface idolNameResult {
	id: string,
	dob_u15: string,
	eng: string,
	kanji: string,
	primaryname: string
}
export class Title {
	public type?: TitleType
	public idols?: Idol[];
	public idolAgesU15?: number[];
	public titlesIncluded?: Title[];
	public cover?: string;
	public name?: string;
	public releaseDate?: string;

	constructor (
		public id: string,
	) {}
}

export enum TitleType {
	'dvd',
	'bd',
	'dvd-box',
	'bd-box',
}

export interface menuOptions {
	numbersUpTo: number,
	hasPrevious?: boolean,
	hasNext?: boolean,
	hasStop?: boolean,
	hasRestart?: boolean
}

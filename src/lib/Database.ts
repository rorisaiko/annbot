import { idolNameResult } from './models';
import mysql, { RowDataPacket, OkPacket } from "mysql2";
import { Pool } from "mysql2/promise";
import config from "../config.json";

export class Database {
	
	private con!:Pool;

	constructor() {
		this.dbConnect();
	}

	dbConnect(): void {
		this.con = mysql.createPool({
			host: config.db.host,
			user: config.db.user,
			password: config.db.pass,
			database: config.db.db,
			dateStrings: true
		}).promise();
	}

	async dbSelect(sql: string, data: any): Promise<RowDataPacket[]> {
		let rows = (await this.con.query<RowDataPacket[]>(sql, data))[0];
		return rows;
	}

	async dbSelectArray(sql: string, data: any): Promise<RowDataPacket[][]> {
		let rows = (await this.con.query<RowDataPacket[][]>({sql: sql, rowsAsArray: true}, data))[0];
		return rows;
	}

	async dbInsDel(sql: string, data: any): Promise<OkPacket> {
		let result = (await this.con.query<OkPacket>(sql, data))[0];
		return result;
	}

	async getIdolsByName(idolName: string): Promise<number[]> {
		const sql = 'SELECT ji.id '+
					'FROM ji_idol ji '+
						'JOIN ji_idolname jin ON ji.id = jin.idol_id '+
						'JOIN ji_name jn ON jin.name_id = jn.id '+
					'WHERE jn.eng LIKE ? LIMIT 6';
		const result = await this.dbSelectArray(sql, `%${idolName}%`);
		return result.flat(1) as any[] as number[];
	}

	async getIdolDetailsByIdol(idolIDs: number | number[]): Promise<idolNameResult[]> {
		const sql = 'SELECT ji.id, ji.dob_u15, jn.eng, jn.kanji, jin.primaryname '+
					'FROM ji_idol ji '+
						'JOIN ji_idolname jin ON ji.id = jin.idol_id '+
						'JOIN ji_name jn ON jin.name_id = jn.id ' +
					'WHERE ji.id IN ?';
		if(typeof idolIDs === 'number')
			idolIDs = [idolIDs];
		return await this.dbSelect(sql, [[idolIDs]]) as idolNameResult[];
	}

	async getOneTitlePerIdol(idolIDs: number[]): Promise<RowDataPacket[]> {
		let result = new Map<string, string>();
		return [];
	}
}


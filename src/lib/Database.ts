import mysql, { RowDataPacket, OkPacket } from "mysql2";
import { Pool } from "mysql2/promise";
import config from "../config.json";

export class Database {
	
	private con!:Pool;

	constructor() {
		this.dbConnect();
	}

	async dbSelect(sql: string, data: any): Promise<RowDataPacket[]> {
		let rows = (await this.con.query<RowDataPacket[]>(sql, data))[0];
		return rows;
	}

	async dbInsDel(sql: string, data: any): Promise<OkPacket> {
		let result = (await this.con.query<OkPacket>(sql, data))[0];
		return result;
	}

	dbConnect(): void {
		this.con = mysql.createPool({
			host: config.db.host,
			user: config.db.user,
			password: config.db.pass,
			database: config.db.db
		}).promise();
	}

}


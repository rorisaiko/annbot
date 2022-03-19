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
	
	private async dbSelect(sql: string, data: any): Promise<RowDataPacket[]> {
		return (await this.con.query<RowDataPacket[]>(sql, data))[0];
	}

	private async dbSelectArray(sql: string, data: any): Promise<RowDataPacket[][]> {
		return (await this.con.query<RowDataPacket[][]>({sql: sql, rowsAsArray: true}, data))[0];
	}

	private async dbInsDel(sql: string, data: any): Promise<OkPacket> {
		return (await this.con.query<OkPacket>(sql, data))[0];
	}

	async gntDelTitlesByID(id: string[]): Promise<OkPacket> {
		const sql = `DELETE FROM gnt_titles WHERE id IN (?)`;
		return await this.dbInsDel(sql,[id]);
	}

	async gntIfUserExists(userID: string): Promise<boolean> {
		const sql = 'SELECT userid FROM gnt_users WHERE userid = ?';
		const rows = await this.dbSelect(sql, [userID]);
		return rows.length > 0;
	}

	async gntGetIDsByUserIDAndTitleIDs(userID: string, titleIDs: string[]):Promise<RowDataPacket[]> {
		const sql = `SELECT id FROM gnt_titles WHERE userid = ? AND titleid in (?)`;
		return await this.dbSelect(sql, [userID, titleIDs]);;
	}

	async gntGetTitleIDsByUserIDAndTitleIDs(userID: string, titleIDs: string[]): Promise<RowDataPacket[]> {
		const sql = 'SELECT titleid FROM gnt_titles WHERE userid = ? AND titleid IN (?) ORDER BY titleid';
		return await this.dbSelect(sql, [userID, titleIDs]);
	}

	async gntGetTitleIDsByUserID(userID: string): Promise<RowDataPacket[]> {
		const sql = `SELECT titleid FROM gnt_titles WHERE userid = ? ORDER BY titleid`;
		return await this.dbSelect(sql, [userID]);
	}

	async gntGetUserIDsbyTitleID(titleID: string): Promise<RowDataPacket[]> {
		const sql = `SELECT userid FROM gnt_titles WHERE titleid = ?`;
		return await this.dbSelect(sql, titleID);
	}

	async gntAddUser(userID: string, userTag: string): Promise<OkPacket> {
		const sql = 'INSERT INTO gnt_users (userid, usertag) VALUES ?';
		return await this.dbInsDel(sql, [[[userID, userTag]]]);
	}

	async gntAddTitles(toAdd: [string, string][]): Promise<OkPacket> {
		const sql = `INSERT INTO gnt_titles (titleid, userid) VALUES ?`;
		return await this.dbInsDel(sql, [toAdd]);
	}

	async getTitleByTitleID(titleID: string): Promise<mysql.RowDataPacket[]>{
		const sql = 'SELECT jt.id, jtt.name titletype, jt.name, jt.releasedate, jt.dvdid, jt.bdid, jt.link_id, jt.coverurl, jt.producturl, jl.site, jl.coverurl as coverpath, jl.producturl as productpath '+
					'FROM ji_title AS jt ' +
						'JOIN ji_title_type jtt ON jt.type_id = jtt.id ' +
						'LEFT JOIN ji_link jl ON jl.id = jt.link_id '+
					'WHERE jt.id = ?';
		return await this.dbSelect(sql, titleID);
	}

	async getIdolsByTitleID(titleID: string): Promise<mysql.RowDataPacket[]>{
		const sql = 'SELECT jt.id, jn.kanji, jn.eng, jti.age, jti.age_notes, ji.code idolcode '+
					'FROM `ji_title` jt '+
						'JOIN `ji_titleidol` jti ON jt.id = jti.title_id '+
						'JOIN `ji_name` jn ON jn.id = jti.name_id '+
						'JOIN ji_idol ji ON ji.id = jti.idol_id '+
					'WHERE jt.id = ?';
		return await this.dbSelect(sql, titleID)
	}


}


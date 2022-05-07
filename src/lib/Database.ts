import mysql, { RowDataPacket, OkPacket } from "mysql2";
import { Pool } from "mysql2/promise";
import { SharedItem } from "./models";

export class Database {
	
	private con!:Pool;

	constructor(private host: string, private user:string, private pass:string, private db: string) {
		this.dbConnect();
	}

	dbConnect(): void {
		this.con = mysql.createPool({
			host: this.host,
			user: this.user,
			password: this.pass,
			database: this.db,
			timezone: 'Z',
			dateStrings: true
		}).promise();
	}

	// Common functions ----------
	
	private async dbSelect(sql: string, data: any): Promise<RowDataPacket[]> {
		return (await this.con.query<RowDataPacket[]>(sql, data))[0];
	}

	private async dbSelectArray(sql: string, data: any): Promise<RowDataPacket[][]> {
		return (await this.con.query<RowDataPacket[][]>({sql: sql, rowsAsArray: true}, data))[0];
	}

	private async dbInsDel(sql: string, data: any): Promise<OkPacket> {
		return (await this.con.query<OkPacket>(sql, data))[0];
	}

	// GNT section ---------------

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

	// Data section --------------

	/**
	 * @returns [id, titletype, name, releasedate, dvdid, dbid, link_id, coverurl, producturl, site, coverpath, productpath]
	 */
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
		return await this.dbSelect(sql, titleID);
	}

	// Share section -------------

	async addShare(sharedItem: SharedItem): Promise<boolean> {
		const sql = 'INSERT INTO ji_share (titleid, url, pwd, bitrate, size, length, userid, date, channel, comments) VALUES ?'
		const okpResult = await this.dbInsDel(sql, [[[sharedItem.titleID, sharedItem.url, sharedItem.pwd, sharedItem.bitRate, sharedItem.size, sharedItem.length, sharedItem.userID, new Date(), sharedItem.channel, sharedItem.comments]]])
		return (okpResult.affectedRows > 0)
	}
	
	async getShareByTitleIDAndUserID(titleID: string, userID: string): Promise<SharedItem | undefined> {
		const sql = 'SELECT titleid, url, pwd, bitrate, size, length, userid, date, channel, comments ' +
					'FROM ji_share ' +
					'WHERE titleid = ? AND userid = ?';
		const rdpResult = await this.dbSelect(sql, [titleID, userID]);

		if(rdpResult.length > 0) {
			const sharedItem = new SharedItem();
			sharedItem.titleID = rdpResult[0].titleid;
			sharedItem.url = rdpResult[0].url;
			sharedItem.pwd = rdpResult[0].pwd;
			sharedItem.bitRate = rdpResult[0].bitrate;
			sharedItem.size = rdpResult[0].size;
			sharedItem.length = rdpResult[0].length;
			sharedItem.userID = rdpResult[0].userid;
			sharedItem.date = rdpResult[0].date;
			sharedItem.channel = (await this.getChannelIDByID(rdpResult[0].channel))[0];
			sharedItem.comments = rdpResult[0].comments;
			return sharedItem;
		}
		else
			return;
	}

	async updateShare(sharedItem: SharedItem): Promise<boolean> {
		const sql = 'UPDATE ji_share SET url = ?, pwd = ?, bitrate = ?, size = ?, length = ?, date = ?, channel = ?, comments = ? ' +
					'WHERE titleid = ? AND userid = ?';
		const okpResult = await this.dbInsDel(sql, [sharedItem.url, sharedItem.pwd, sharedItem.bitRate, sharedItem.size, sharedItem.length, new Date(), sharedItem.channel, sharedItem.comments, sharedItem.titleID, sharedItem.userID])
		return (okpResult.affectedRows > 0);
	}

	// Discord section -----------

	async getChannelIDByID(channelID: string): Promise<string[]> {
		const sql = 'SELECT jc.channelID ' +
					'FROM ji_channel jc ' +
					'WHERE jc.id = ?';
		const rdpResult = await this.dbSelectArray(sql, channelID);
		return rdpResult.flat() as any[] as string[];		
	}
	
	async getChannelIDByName(channelName: string): Promise<string[]> {
		const sql = 'SELECT jc.channelID ' +
					'FROM ji_channel jc ' +
					'WHERE jc.name = ?';
		const RDPResult = await this.dbSelectArray(sql, channelName);
		return RDPResult.flat() as any[] as string[];		
	}

	async getAllChannelIDs(): Promise<string[]> {
		const sql = 'SELECT DISTINCT channelID FROM `ji_channel`';
		const RDPResult = await this.dbSelectArray(sql, '');
		return RDPResult.flat() as any[] as string[];
	}

}


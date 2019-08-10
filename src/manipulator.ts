import { PacketData } from "./packet-stream";
import { Transform, Readable } from "readable-stream";
import Message from "./message";
import { PKT_TYPE, RPacket } from "./packet";
import { Result } from "./main";
import { DoneToken, Token, isColsMetaDataToken, isRowToken, isDoneToken } from "./types";
import { TOKEN_TYPE, TokenStreamParser } from "./token";
import { rowValueWriter } from "./row-value-writer";
import BufferList from "bl";

const SqlVariantType: any = require('tedious/lib/data-types/sql-variant');
const PreloginPayload: any = require('tedious/lib/prelogin-payload');


// One class for both direction (srv->client and client->srv) to potentially enable shared state
export class PacketManipulator{
	private _srv2clTS = new Transform({
		transform: this.transformSrv2Cl.bind(this),
		writableObjectMode: true
	});
	public get srv2clTS(){
		return this._srv2clTS;
	}
	private _cl2srvTS: Transform = new Transform({
		transform: this.transformCl2Srv.bind(this),
		writableObjectMode: true
	});
	public get cl2srvTS(){
		return this._cl2srvTS;
	}

	public pushBlToStr(bl: BufferList, r: Readable, end: ()=>void = ()=>{}){
		/*bl.pipe(new PassThrough({
			write: (chunk: any, enc: string, callback: (error?: Error)=>void)=>{
				r.push(chunk);
				callback();
			},
			final: (cb: (err?: Error)=>void)=>{end()}
		}));*/
		bl.on('data', d=>r.push(d));
		bl.on('end', end);
	}

	private curSrvMsg?: Message;
	private lastSrvPktd?: PacketData;
	public transformSrv2Cl(pktd: PacketData, encoding: any, callback: (err?: Error, data?: any)=>void): void{
		if(pktd.type != PKT_TYPE.TABULAR_RESULT || (this.lastClPktd && this.lastClPktd.type != PKT_TYPE.SQL_BATCH)){ // do not do any on non sql result packets
			this.lastSrvPktd = pktd;
			return this.pushBlToStr(pktd.buffers, this._srv2clTS, callback);
		}
		this.lastSrvPktd = pktd;
		const pkt = new RPacket(pktd.buffers);
		
        if(!this.curSrvMsg){
			this.curSrvMsg = new Message(pkt, false);
		}else{
			this.curSrvMsg.write(pkt.data());
		}
		if(pkt.isLast()){
			// Wait until the current message was fully processed before we
			// continue processing any remaining messages.
			this.curSrvMsg.end(undefined);
			this.handleSrv2ClMsg(this.curSrvMsg).then(()=>callback());
			this.curSrvMsg = undefined;
		}else{
			callback();
		}
	}

	public async rebuildResultSet(results: Result[], done: DoneToken): Promise<BufferList>{
		let bl = new BufferList();
		for(let res of results){
			// each per col (12b + size of name in UCS2 encoding) + 2b col count + 1b token type
			let columnsBuf = Buffer.alloc(res.columns.reduce((p,c)=>p+(c.colName.length*2+12), 0)+3, 0);
			let offs = 0;
			offs = columnsBuf.writeUInt8(TOKEN_TYPE.COLMETADATA, offs); // token type
			offs = columnsBuf.writeUInt16LE(res.columns.length, offs); // col count
			for(let c of res.columns){
				offs = columnsBuf.writeUInt32LE(c.userType, offs);
				offs = columnsBuf.writeUInt16LE(c.flags, offs);
				offs = columnsBuf.writeUInt8(c.type.id, offs);
				offs = columnsBuf.writeUInt32LE(c.dataLength||0, offs);
				offs = columnsBuf.writeUInt8(c.colName.length, offs);
				if(c.colName.length > 0)
				offs += columnsBuf.write(c.colName, offs, 'ucs2');
			}
			if(offs != columnsBuf.length)
				console.warn("miscalculated buffer len for columns!")
			bl.append(columnsBuf);

			for(let row of res.rows){
				bl.append(Buffer.alloc(1, TOKEN_TYPE.ROW)); // write row token type
				let colIndex = 0;
				for(let val of row.values){
					let buf = await rowValueWriter(res.columns[colIndex], row.metas[colIndex], val);
					bl.append(buf);
				}
			}
		}
		// write done token
		let doneBuf = Buffer.alloc(13, 0);
		doneBuf.writeUInt8(TOKEN_TYPE.DONE, 0); // done token ID
		let status = 0;
		if(done.more) status |= 0x1;
		if(done.sqlError) status |= 0x2;
		if(typeof done.rowCount == "number") status |= 0x10;
		if(done.attention) status |= 0x20;
		if(done.serverError) status |= 0x100;
		doneBuf.writeUInt16LE(status, 1); // final done message, row count is valid
		doneBuf.writeUInt16LE(done.curCmd, 3); // current cmd
		doneBuf.writeUInt32LE(done.rowCount, 5);
		bl.append(doneBuf);
		return bl;
	}

	private preLoginPl: any = null;
	private async handleSrv2ClMsg(msg: Message){
		let passThrough = true;
		if(this.lastClPktd){
			if(this.lastClPktd.type == PKT_TYPE.PRELOGIN && msg.type == PKT_TYPE.TABULAR_RESULT){ // client sent prelogin, srv answerting with options
				this.preLoginPl = new PreloginPayload(msg.slice(0));
				console.log(this.preLoginPl);
			}else if(this.lastClPktd.type == PKT_TYPE.SQL_BATCH && msg.type == PKT_TYPE.TABULAR_RESULT){ // answer to SQL query
				let tsp = new TokenStreamParser(undefined, {});
				msg.pipe(tsp.parser);
				let resIndex = -1;
				let results: Array<Result> = [];
				let doneToken: DoneToken;
				let changes = false;
				tsp.parser.on('data', (t: Token)=>{
					if(isColsMetaDataToken(t)){
						results[++resIndex] = {
							columns: t.columns as any,
							rows: []
						}
					}else if(isRowToken(t)){
						let values = t.columns.map(c=>c.value);
						let metas = t.columns.map(c=>c.metadata.valueMetaData!);
						let ind = results[resIndex].columns.findIndex(c=>c.type == SqlVariantType);
						if(ind > -1 && values[ind].match(/^14\.0\..+/)){
							console.log('replacing', values[ind], 'by', '13.0.4574.0');
							changes = true;
							values[ind] = '13.0.4574.0';
						}else if(ind > -1 && values[ind].match(/^Express Edition/)){
							console.log('replacing', values[ind], 'by', 'Developer Edition (64-bit)');
							changes = true;
							values[ind] = 'Developer Edition (64-bit)';
						}
						results[resIndex].rows.push({values, metas});
					}else if(isDoneToken(t)){
						doneToken = t;
					}
				});
				await new Promise((res,rej)=>{
					msg.once('end', ()=>{
						res();
					})
				});
				if(changes){
					passThrough = false;
					let bl = new BufferList();
					let res = await this.rebuildResultSet(results, doneToken!);
					let pktHdr = Buffer.alloc(8, 0);
					pktHdr.writeUInt8(msg.type, 0);
					pktHdr.writeUInt8(1, 1); // status for last (only) packet
					pktHdr.writeUInt16BE(res.length+8, 2); // len of whole pkt
					pktHdr.writeUInt16BE(msg.pkts[0].buffer.readInt16BE(4), 4); // channel no
					pktHdr.writeUInt8(1, 6); //pkt no
					pktHdr.writeUInt8(0, 7); //pkt window
					bl.append(pktHdr); // send pkt hdr
					bl.append(res);
					await new Promise((res,rej)=>{
						this.pushBlToStr(bl, this._srv2clTS, ()=>res());
					});
				}
			}
		}
		if(passThrough){
			for(let pkt of msg.pkts){
				await new Promise((res,rej)=>{
					this.pushBlToStr(pkt.buffer, this._srv2clTS, ()=>res());
				});
			}
		}
	}

	private lastClPktd?: PacketData;
	public transformCl2Srv(pktd: PacketData, encoding: any, callback: (err?: Error, data?: any)=>void){
		this.lastClPktd = pktd;
		if(pktd.isTLS) // do not do any handling on TLS pkts
			return this.pushBlToStr(pktd.buffers, this._cl2srvTS, callback);
		this.pushBlToStr(pktd.buffers, this._cl2srvTS, callback);
	}
}
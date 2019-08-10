import BufferList from "bl";
const {sprintf} = require('sprintf-js');

export const HEADER_LENGTH = 8;

export enum PKT_TYPE{
	SQL_BATCH = 0x01,
	RPC_REQUEST = 0x03,
	TABULAR_RESULT = 0x04,
	ATTENTION = 0x06,
	BULK_LOAD = 0x07,
	TRANSACTION_MANAGER = 0x0E,
	LOGIN7 = 0x10,
	NTLMAUTH_PKT = 0x11,
	PRELOGIN = 0x12,
	FEDAUTH_TOKEN = 0x08
};

const typeByValue: { [key: number]: string } = {};

for (const name in PKT_TYPE) {
	typeByValue[PKT_TYPE[name] as any] = name;
}

const STATUS: { [key: string]: number } = {
	NORMAL: 0x00,
	EOM: 0x01,
	IGNORE: 0x02,
	RESETCONNECTION: 0x08,
	RESETCONNECTIONSKIPTRAN: 0x10
};

export const OFFSET = {
	Type: 0,
	Status: 1,
	Length: 2,
	SPID: 4,
	PacketID: 6,
	Window: 7
};

const DEFAULT_SPID = 0;

const DEFAULT_PACKETID = 1;

const DEFAULT_WINDOW = 0;

const NL = '\n';

export class RPacket<T extends Buffer | BufferList = BufferList>{
	protected _buffer: T;

	constructor(bl: T) {
		this._buffer = bl;
	}

	length() {
		return this._buffer.readUInt16BE(OFFSET.Length);
	}
	get buffer(){
		return this._buffer;
	}
	data() {
		return this._buffer.slice(HEADER_LENGTH);
	}
	dataShallow(){
		if(this._buffer instanceof BufferList)
			return this._buffer.shallowSlice(HEADER_LENGTH);
		else 
			return this.data();
	}

	type() {
		return this._buffer.readUInt8(OFFSET.Type);
	}

	statusAsString() {
		const status = this._buffer.readUInt8(OFFSET.Status);
		const statuses = [];

		for (const name in STATUS) {
			const value = STATUS[name];

			if (status & value) {
				statuses.push(name);
			} else {
				statuses.push(undefined);
			}
		}

		return statuses.join(' ').trim();
	}

	headerToString(indent: string = '') {
		const text = sprintf('type:0x%02X(%s), status:0x%02X(%s), length:0x%04X, spid:0x%04X, packetId:0x%02X, window:0x%02X', this._buffer.readUInt8(OFFSET.Type), typeByValue[this._buffer.readUInt8(OFFSET.Type)], this._buffer.readUInt8(OFFSET.Status), this.statusAsString(), this._buffer.readUInt16BE(OFFSET.Length), this._buffer.readUInt16BE(OFFSET.SPID), this._buffer.readUInt8(OFFSET.PacketID), this._buffer.readUInt8(OFFSET.Window));
		return indent + text;
	}

	dataToString(indent: string = '') {
		const BYTES_PER_GROUP = 0x04;
		const CHARS_PER_GROUP = 0x08;
		const BYTES_PER_LINE = 0x20;
		const data = this.data();

		let dataDump = '';
		let chars = '';


		for (let offset = 0; offset < data.length; offset++) {
			if (offset % BYTES_PER_LINE === 0) {
				dataDump += indent;
				dataDump += sprintf('%04X  ', offset);
			}

			if (data[offset] < 0x20 || data[offset] > 0x7E) {
				chars += '.';
				if (((offset + 1) % CHARS_PER_GROUP === 0) && !((offset + 1) % BYTES_PER_LINE === 0)) {
					chars += ' ';
				}
			} else {
				chars += String.fromCharCode(data[offset]);
			}

			if (data[offset] != null) {
				dataDump += sprintf('%02X', data[offset]);
			}

			if (((offset + 1) % BYTES_PER_GROUP === 0) && !((offset + 1) % BYTES_PER_LINE === 0)) {
				dataDump += ' ';
			}

			if ((offset + 1) % BYTES_PER_LINE === 0) {
				dataDump += '  ' + chars;
				chars = '';
				if (offset < data.length - 1) {
					dataDump += NL;
				}
			}
		}

		if (chars.length) {
			dataDump += '  ' + chars;
		}

		return dataDump;
	}

	toString(indent: string = '') {
		return this.headerToString(indent) + '\n' + this.dataToString(indent + indent);
	}

	payloadString() {
		return '';
	}

	isLast() {
		return !!(this._buffer.readUInt8(OFFSET.Status) & STATUS.EOM);
	}
}


export class WPacket extends RPacket<Buffer>{
	constructor(type: number){
		super(Buffer.alloc(HEADER_LENGTH, 0))
		this._buffer.writeUInt8(type, OFFSET.Type);
		this._buffer.writeUInt8(STATUS.NORMAL, OFFSET.Status);
		this._buffer.writeUInt16BE(DEFAULT_SPID, OFFSET.SPID);
		this._buffer.writeUInt8(DEFAULT_PACKETID, OFFSET.PacketID);
		this._buffer.writeUInt8(DEFAULT_WINDOW, OFFSET.Window);
		this.setLength();
	}

	setLength() {
		this._buffer.writeUInt16BE(this._buffer.length, OFFSET.Length);
	}



	resetConnection(reset: boolean) {
		let status = this._buffer.readUInt8(OFFSET.Status);
		if (reset) {
			status |= STATUS.RESETCONNECTION;
		} else {
			status &= 0xFF - STATUS.RESETCONNECTION;
		}
		this._buffer.writeUInt8(status, OFFSET.Status);
	}

	last(last?: boolean) {
		let status = this._buffer.readUInt8(OFFSET.Status);
		if (arguments.length > 0) {
			if (last) {
				status |= STATUS.EOM;
			} else {
				status &= 0xFF - STATUS.EOM;
			}
			this._buffer.writeUInt8(status, OFFSET.Status);
		}
		return this.isLast();
	}

	ignore(last: boolean) {
		let status = this._buffer.readUInt8(OFFSET.Status);
		if (last) {
			status |= STATUS.IGNORE;
		} else {
			status &= 0xFF - STATUS.IGNORE;
		}
		this._buffer.writeUInt8(status, OFFSET.Status);
	}

	packetId(packetId?: number) {
		if (packetId) {
			this._buffer.writeUInt8(packetId % 256, OFFSET.PacketID);
		}
		return this._buffer.readUInt8(OFFSET.PacketID);
	}

	addData(data: Buffer) {
		this._buffer = Buffer.concat([this._buffer, data]);
		this.setLength();
		return this;
	}
}

export function isPacketComplete(potentialPacketBuffer: Buffer) {
	if (potentialPacketBuffer.length < HEADER_LENGTH) {
		return false;
	} else {
		return potentialPacketBuffer.length >= potentialPacketBuffer.readUInt16BE(OFFSET.Length);
	}
}

export function packetLength(potentialPacketBuffer: Buffer) {
	return potentialPacketBuffer.readUInt16BE(OFFSET.Length);
}

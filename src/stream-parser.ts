import { Transform } from 'readable-stream';
import { tokenParsers, TOKEN_TYPE } from './token';
import BufferList from 'bl';
import { ColumnMetaData } from 'tedious';
import { isColsMetaDataToken, Token } from './types';


export default class Parser extends Transform{
	
	private static endOfMessageMarker = Symbol('endOfMessage');
	private buffers = new BufferList();
	private suspended = false;
	private next?: (err?: Error)=>void;

	public get length(){
		return this.buffers.length;
	}

	constructor(private colsMetadata: ColumnMetaData[]|undefined, private options: any) {
		super({ objectMode: true });
	}

	public addEndOfMessageMarker(){
		this.write(Parser.endOfMessageMarker);
	}

	_transform(input: Buffer|BufferList|typeof Parser.endOfMessageMarker, encoding: any, done: (err?: Error, token?: Token)=>void) {
		if (input === Parser.endOfMessageMarker) {
			done(undefined, { // generate endOfMessage pseudo token
				name: 'EOM',
				event: 'endOfMessage'
			});
			return;
		}
		const buffer = input as Buffer|BufferList;
		this.buffers.append(buffer);

		if (this.suspended) {
			// Unsuspend and continue from where ever we left off.
			this.suspended = false;
			this.next && this.next.call(undefined);
		}

		// If we're no longer suspended, parse new tokens
		if (!this.suspended) {
			// Start the parser
			this.parseTokens();
		}

		done();
	}

	parseTokens() {
		const doneParsing = (token: Token) => {
			if (token) {
				if(isColsMetaDataToken(token))
					this.colsMetadata = token.columns;
				this.push(token);
			}
		};

		while (!this.suspended && this.buffers.length) {
			const type = this.buffers.readUInt8(0) as TOKEN_TYPE;
			this.buffers.consume(1);
			if (tokenParsers[type]) {
				tokenParsers[type](this, this.colsMetadata, this.options, doneParsing);
			} else {
				this.emit('error', new Error('Unknown type: ' + type));
			}
		}
	}

	suspend(next: (err?: Error)=>void) {
		this.suspended = true;
		this.next = next;
	}

	awaitData(length: number, callback: ()=>void) {
		if (this.buffers.length >= length){
			callback();
		} else {
			this.suspend(() => {
				this.awaitData(length, callback);
			});
		}
	}

	readInt8(callback: (data: number)=>void) {
		this.awaitData(1, () => {
			const data = this.buffers.readInt8(0);
			this.buffers.consume(1);
			callback(data);
		});
	}

	readUInt8(callback: (data: number)=>void) {
		this.awaitData(1, () => {
			const data = this.buffers.readUInt8(0);
			this.buffers.consume(1);
			callback(data);
		});
	}

	readInt16LE(callback: (data: number)=>void) {
		this.awaitData(2, () => {
			const data = this.buffers.readInt16LE(0);
			this.buffers.consume(2);
			callback(data);
		});
	}

	readInt16BE(callback: (data: number)=>void) {
		this.awaitData(2, () => {
			const data = this.buffers.readInt16BE(0);
			this.buffers.consume(2);
			callback(data);
		});
	}

	readUInt16LE(callback: (data: number)=>void) {
		this.awaitData(2, () => {
			const data = this.buffers.readUInt16LE(0);
			this.buffers.consume(2);
			callback(data);
		});
	}

	readUInt16BE(callback: (data: number)=>void) {
		this.awaitData(2, () => {
			const data = this.buffers.readUInt16BE(0);
			this.buffers.consume(2);
			callback(data);
		});
	}

	readInt32LE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readInt32LE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readInt32BE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readInt32BE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readUInt32LE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readUInt32LE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readUInt32BE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readUInt32BE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readInt64LE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = Math.pow(2, 32) * this.buffers.readInt32LE(4) + ((this.buffers.readUInt8(4) & 0x80) === 0x80 ? 1 : -1) * this.buffers.readUInt32LE(0);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readInt64BE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = Math.pow(2, 32) * this.buffers.readInt32BE(0) + ((this.buffers.readUInt8(0) & 0x80) === 0x80 ? 1 : -1) * this.buffers.readUInt32BE(4);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readUInt64LE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = Math.pow(2, 32) * this.buffers.readUInt32LE(4) + this.buffers.readUInt32LE(0);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readUInt64BE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = Math.pow(2, 32) * this.buffers.readUInt32BE(0) + this.buffers.readUInt32BE(4);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readFloatLE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readFloatLE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readFloatBE(callback: (data: number)=>void) {
		this.awaitData(4, () => {
			const data = this.buffers.readFloatBE(0);
			this.buffers.consume(4);
			callback(data);
		});
	}

	readDoubleLE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = this.buffers.readDoubleLE(0);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readDoubleBE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const data = this.buffers.readDoubleBE(0);
			this.buffers.consume(8);
			callback(data);
		});
	}

	readUInt24LE(callback: (data: number)=>void) {
		this.awaitData(3, () => {
			const low = this.buffers.readUInt16LE(0);
			const high = this.buffers.readUInt8(2);
			this.buffers.consume(3);
			callback(low | (high << 16));
		});
	}

	readUInt40LE(callback: (data: number)=>void) {
		this.awaitData(5, () => {
			const low = this.buffers.readUInt32LE(0);
			const high = this.buffers.readUInt8(4);
			this.buffers.consume(5);
			callback((0x100000000 * high) + low);
		});
	}

	readUNumeric64LE(callback: (data: number)=>void) {
		this.awaitData(8, () => {
			const low = this.buffers.readUInt32LE(0);
			const high = this.buffers.readUInt32LE(4);
			this.buffers.consume(8);
			callback((0x100000000 * high) + low);
		});
	}

	readUNumeric96LE(callback: (data: number)=>void) {
		this.awaitData(12, () => {
			const dword1 = this.buffers.readUInt32LE(0);
			const dword2 = this.buffers.readUInt32LE(4);
			const dword3 = this.buffers.readUInt32LE(8);
			this.buffers.consume(12);
			callback(dword1 + (0x100000000 * dword2) + (0x100000000 * 0x100000000 * dword3));
		});
	}

	readUNumeric128LE(callback: (data: number)=>void) {
		this.awaitData(16, () => {
			const dword1 = this.buffers.readUInt32LE(0);
			const dword2 = this.buffers.readUInt32LE(4);
			const dword3 = this.buffers.readUInt32LE(8);
			const dword4 = this.buffers.readUInt32LE(12);
			this.buffers.consume(16);
			callback(dword1 + (0x100000000 * dword2) + (0x100000000 * 0x100000000 * dword3) + (0x100000000 * 0x100000000 * 0x100000000 * dword4));
		});
	}

	// Variable length data
	readBuffer(length: number, callback: (buf: Buffer)=>void) {
		this.awaitData(length, () => {
			const data = this.buffers.slice(0, length);
			this.buffers.consume(length);
			callback(data);
		});
	}

	// Read a Unicode String (BVARCHAR)
	readBVarChar(callback: (str: string)=>void) {
		this.readUInt8((length) => {
			this.readBuffer(length * 2, (data) => {
				callback(data.toString('ucs2'));
			});
		});
	}

	// Read a Unicode String (USVARCHAR)
	readUsVarChar(callback: (str: string)=>void) {
		this.readUInt16LE((length) => {
			this.readBuffer(length * 2, (data) => {
				callback(data.toString('ucs2'));
			});
		});
	}

	// Read binary data (BVARBYTE)
	readBVarByte(callback: (data: Buffer)=>void) {
		this.readUInt8((length) => {
			this.readBuffer(length, callback);
		});
	}

	// Read binary data (USVARBYTE)
	readUsVarByte(callback: (data: Buffer)=>void) {
		this.readUInt16LE((length) => {
			this.readBuffer(length, callback);
		});
	}
};

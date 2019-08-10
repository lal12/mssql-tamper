import BufferList from "bl";
import { Transform } from "readable-stream";

const PKT_HDR_LEN = 8;

export interface PacketData{
	type: number,
	isTLS: boolean,
	buffers: BufferList
}

export class PacketStream extends Transform{
	private buffers: BufferList = new BufferList();

	constructor(){
		super({
			readableObjectMode: true
		});
	}

	public handleCurBuffer(){
		while(this.buffers.length > PKT_HDR_LEN){ 
			const isTLS = this.buffers.readUInt8(0) == 0x17; //TODO compare more bytes
			const pktLen = isTLS ? this.buffers.readUInt16BE(3) + 5 : this.buffers.readUInt16BE(2);
			if(this.buffers.length < pktLen)
				break;
			const d = this.buffers.shallowSlice(0, pktLen); //TODO: check if copy (.slice) is neccessary, but shallowSlice should have better performance
			this.buffers.consume(pktLen);
			if(isTLS){
				let pkt: PacketData = {
					type: -1,
					isTLS: true,
					buffers: d
				};
				this.push(pkt);
			}else{
				let pkt = {
					type: d.readUInt8(0),
					isTLS: false,
					buffers: d,
				};
				this.push(pkt);
			}
		}
	}

	public _transform(chunk: Buffer, encoding: string, next: (error?: Error) => void) {
		this.buffers.append(chunk);
		try{
			this.handleCurBuffer();
		}catch(e){
			return next(e);
		}
		return next();
	}
}
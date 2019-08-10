import BufferList from "bl";
import { RPacket } from './packet';

class Message extends BufferList{
	ignore: boolean = false;
	pkts: RPacket[] = [];

	public get type(){
		return this.pkts[0].type();
	}

	constructor(firstPkt: RPacket, private resetConnection: boolean = false) {
		super();
		this.ignore = false;
		this.addPkt(firstPkt);
	}

	addPkt(pkt: RPacket){
		this.pkts.push(pkt);
		this.append(pkt.data());
	}
}

export default Message;
module.exports = Message;
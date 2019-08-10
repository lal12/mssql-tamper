import * as Util from "util";
import * as Net from "net";
import { Duplex } from "readable-stream";
import { PacketStream, PacketData } from "./packet-stream";



interface ProxyOptions{
	srvhost: string;
	srvport: number;
	srv2cl?: Duplex;
	cl2srv?: Duplex;
}

export class Proxy{
	private srvsock!: Net.Socket;

	private cl2srv: PacketStream;
	private srv2cl: PacketStream;

	constructor(private clsock: Net.Socket, opts: ProxyOptions){
		console.log("New con: ", this.clsock.remoteAddress, this.clsock.remotePort);
		this.srv2cl = new PacketStream();
		this.cl2srv = new PacketStream();
		this.srvsock = Net.createConnection(opts.srvport, opts.srvhost, ()=>{
			if(!opts.srv2cl){
				this.srv2cl.on('data', (pkt: PacketData)=>{
					pkt.buffers.pipe(this.clsock, {end: false});
				});
			}else{
				this.srv2cl.pipe(opts.srv2cl);
				opts.srv2cl.pipe(this.clsock);
			}
		
			if(!opts.cl2srv){
				this.cl2srv.on('data', (pkt: PacketData)=>{
					console.log('cl pkt', Util.inspect(pkt, false, 0));
					pkt.buffers.pipe(this.srvsock, {end: false});
				});
			}else{
				this.cl2srv.pipe(opts.cl2srv);
				opts.cl2srv.pipe(this.srvsock);
			}

			this.clsock.pipe(this.cl2srv);
			this.srvsock.pipe(this.srv2cl);
		});
	}

}
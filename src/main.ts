import * as Net from "net";

import { ExtendedColumnMetaData, ValueMetaData } from "./types";
import { PacketManipulator } from "./manipulator";
import { Proxy } from "./proxy";

export interface Result{
	columns: ExtendedColumnMetaData[];
	rows: Array<{values: any[], metas: ValueMetaData[]}>;
}


function start(LISTENPORT: number, SRVHOST: string, SRVPORT: number){
	let clientListener = Net.createServer();
	clientListener.on("connection", client=>{
		let pm = new PacketManipulator();
		let p = new Proxy(client, {srvhost: SRVHOST, srvport: SRVPORT, srv2cl: pm.srv2clTS, cl2srv: pm.cl2srvTS});
	});
	clientListener.listen(LISTENPORT);
} 

start(1433, "172.16.16.71", 1433);

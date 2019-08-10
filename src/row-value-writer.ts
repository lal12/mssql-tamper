const WritableTrackingBuffer = require("tedious/lib/tracking-buffer/writable-tracking-buffer");
import { ValueMetaData, ExtendedColumnMetaData, ColTypes, Collation } from './types';

interface Param{
	value: any,
	length?: number
}

interface DataType{
	id: number,
	type: string,
	name: string,
	hasCollection?: boolean,
	dataLengthLength: number,
	maximumLength?: number,
	declaration: (param: Param)=>string,
	resolveLength?: (param: Param)=>number,
	writeTypeInfo?: (buffer: Buffer, parameter: Param)=>void,
	writeParameterData: (buffer: Buffer, parameter: Param, options: any, cb: ()=>void)=>void,
	validate: (value: any)=>null|string
}

const DataTypes = require('tedious/lib/data-type').TYPE as {
	[id: number]: DataType
}

async function varData(col: ExtendedColumnMetaData, meta: ValueMetaData|undefined, v: any){
	let dt = DataTypes[meta!.type.id];
	if(!dt || !dt.writeParameterData || !dt.resolveLength)
		throw new Error("Missing dt or writeParameterDataresolveLength");
	let data = new WritableTrackingBuffer(dt.maximumLength || 1000);
	let param: Param = {value: v};
	param.length = dt.resolveLength!(param);
	await new Promise((res,rej)=>dt.writeParameterData(data as any, param, {}, res));
	data = data.data;
	let variantProp: Buffer = Buffer.alloc(0);
	switch (meta!.type.id) {
		case ColTypes.Time:
		case ColTypes.DateTime2:
			variantProp = Buffer.alloc(1, meta!.scale);
		break;
		case ColTypes.VarBinary:
		case ColTypes.Binary:
			variantProp = Buffer.alloc(2, 0); // TODO: write max length
		break;
		case ColTypes.NumericN:
		case ColTypes.DecimalN:
			variantProp = Buffer.from([meta!.precision!, meta!.scale!]);
		break;
		case ColTypes.VarChar:
		case ColTypes.Char:
		case ColTypes.NVarChar:
		case ColTypes.NChar:
			let bytes = [0,0,0,0];
			variantProp = Buffer.alloc(7);
			bytes[0] = meta!.collation.lcid & 0xFF;
			bytes[1] = (meta!.collation.lcid >> 8) & 0xFF;
			bytes[2] = ((meta!.collation.lcid >> 16) & 0x0F) | (meta!.collation.flags & 0xF0);
			bytes[3] = ((meta!.collation.flags << 4) & 0xF0) | (meta!.collation.version & 0xF)
			Buffer.from(bytes).copy(variantProp, 0);
			variantProp.writeUInt8(meta!.collation.sortId, 4);
			variantProp.writeUInt16LE(0x100, 5); //TODO: write correct maxLen
			data = data.slice(2); // Remove first two bytes
		break;
	}

	// 4b compl len + 1b realtype + 1b prop byte + variantProp + data; 
	let buf = Buffer.alloc(4+1+1+variantProp.length+data.length, 0);
	let offs = 0;
	offs = buf.writeUInt32LE(data.length + variantProp.length + 2, offs);
	offs = buf.writeUInt8(meta!.type.id, offs); // sub id
	offs = buf.writeUInt8(variantProp.length, offs);
	offs += variantProp.copy(buf, offs);
	offs += data.copy(buf, offs);
	return buf;
}

export async function rowValueWriter(col: ExtendedColumnMetaData, meta: ValueMetaData|undefined, value: any): Promise<Buffer> {
	if(col.type.id == ColTypes.Variant){
		return await varData(col, meta, value);
	}else{
		let dt = DataTypes[col.type.id];

		let writeParameterData = dt.writeParameterData;
		if(!writeParameterData){
			if(col.type.id == 0x26){ // NInt, missing implementation in tedious
				dt.writeParameterData = (buffer: any, parameter: Param, options, cb)=>{
					if (parameter !== null && parameter.value != null) {
						buffer.writeUInt8(col.dataLength);
						buffer.writeInt32LE(parseInt(parameter.value));
					} else {
						buffer.writeUInt8(0);
					}
					cb();
				};
				dt.resolveLength = (param: Param)=>(param !== null && param.value !== null) ? (col.dataLength as number)+1 : 1;
			}else{
				throw new Error("Missing writeParameterData");
			}
		}
		let len = 0;
		if(dt.resolveLength)
			len = dt.resolveLength(value);
		else if(value == null)
			len = 0;
		else
			len = col.dataLength!;
		if(len == undefined)
			throw new Error('Could not get Len!');
		let buf = Buffer.alloc(len, 0);
		await new Promise((res,rej)=>dt.writeParameterData(buf, value, {}, res));
		return buf;
	}
}
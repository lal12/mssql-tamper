import { ColumnMetaData, ColumnType } from "tedious";

export interface Token{
	name: string,
	event: string
}
export interface ColsMetaDataToken extends Token{
	name: 'COLMETADATA',
	event: 'columnMetadata',
	columns: ColumnMetaData[]
}
export interface Collation{
	codepage: string;
	flags: number;
	lcid: number;
	sortId: number;
	version: number;
}
export interface ValueMetaData{
	collation: Collation;
	dataLength: number;
	isVariantValue: boolean;
	precision?: number;
	scale?: number;
	type: ColType;
}
export interface RowToken extends Token{
	name: 'ROW',
	event: 'row',
	columns: Array<{
		metadata: ColumnMetaData & {
			valueMetaData?: ValueMetaData}, value: any}>
}
export interface DoneToken extends Token{
	name: 'DONE',
	event: 'done',
	more: boolean,
	sqlError: boolean,
	attention: boolean,
	serverError: boolean,
	curCmd: number,
	rowCount: number,
}
export function isColsMetaDataToken(t: Token): t is ColsMetaDataToken{
	return t.name == 'COLMETADATA';
}
export function isRowToken(t: Token): t is RowToken{
	return t.name == 'ROW';
}
export function isDoneToken(t: Token): t is DoneToken{
	return t.name == 'DONE';
}
export interface ColType extends ColumnType{
	id: number,
	type: string,
	name: string,
	declaration: (p:any)=>any,
	dataLengthLength: number
}
export interface ExtendedColumnMetaData extends ColumnMetaData{
	userType: number;
	collation?: any;
	flags: number;
	tableName?: string;
	type: ColType;
	udtInfo?: any;
}
export enum ColTypes{
	BigInt = 0x7f,
	Binary = 0xad,
	Bit = 0x32,
	BitN = 0x68,
	Char = 0xaf,
	Date = 0x28,
	DateTime = 0x3d,
	DateTime2 = 0x2a,
	DateTimeN = 0x6f,
	DateTimeOffset = 0x2b,
	Decimal = 0x37,
	DecimalN = 0x6a,
	Float = 0x3e,
	FloatN = 0x6d,
	Image = 0x22,
	Int = 0x38,
	IntN = 0x26,
	Money = 0x3c,
	MoneyN = 0x6e,
	NChar = 0xef,
	NText = 0x63,
	Null = 0x1f,
	Numeric = 0x3f,
	NumericN = 0x6c,
	NVarChar = 0xe7,
	Real = 0x3b,
	SmallDateTime = 0x3a,
	SmallInt = 0x34,
	SmallMoney = 0x7a,
	Variant = 0x62,
	Text = 0x23,
	Time = 0x29,
	TinyInt = 0x30,
	TVP = 0xf3,
	UDT = 0xf0,
	UniqueIdentifier = 0x24,
	VarBinary = 0xa5,
	VarChar = 0xa7,
	Xml = 0xf1
}

export enum DONE_STATUS{
	FINAL = 0x00,
	MORE = 0x1,
	ERROR = 0x2,
	INXACT = 0x4,
	COUNT = 0x10,
	ATTN = 0x20,
	SRVERROR = 0x100
};

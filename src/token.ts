export enum TOKEN_TYPE{
	ALTMETADATA = 0x88,
	ALTROW = 0xD3,
	COLMETADATA = 0x81,
	COLINFO = 0xA5,
	DONE = 0xFD,
	DONEPROC = 0xFE,
	DONEINPROC = 0xFF,
	ENVCHANGE = 0xE3,
	ERROR = 0xAA,
	FEATUREEXTACK = 0xAE,
	FEDAUTHINFO = 0xEE,
	INFO = 0xAB,
	LOGINACK = 0xAD,
	NBCROW = 0xD2,
	OFFSET = 0x78,
	ORDER = 0xA9,
	RETURNSTATUS = 0x79,
	RETURNVALUE = 0xAC,
	ROW = 0xD1,
	SSPI = 0xED,
	TABNAME = 0xA4
};

export const tokenParsers: {[type: number]: any} = {
	[TOKEN_TYPE.COLMETADATA]: require('tedious/lib/token/colmetadata-token-parser'),
	[TOKEN_TYPE.DONE]: require('tedious/lib/token/done-token-parser').doneParser,
	[TOKEN_TYPE.DONEINPROC]: require('tedious/lib/token/done-token-parser').doneInProcParser,
	[TOKEN_TYPE.DONEPROC]: require('tedious/lib/token/done-token-parser').doneProcParser,
	[TOKEN_TYPE.ENVCHANGE]: require('tedious/lib/token/env-change-token-parser'),
	[TOKEN_TYPE.ERROR]: require('tedious/lib/token/infoerror-token-parser').errorParser,
	[TOKEN_TYPE.FEDAUTHINFO]: require('tedious/lib/token/fedauth-info-parser'),
	[TOKEN_TYPE.FEATUREEXTACK]: require('tedious/lib/token/feature-ext-ack-parser'),
	[TOKEN_TYPE.INFO]: require('tedious/lib/token/infoerror-token-parser').infoParser,
	[TOKEN_TYPE.LOGINACK]: require('tedious/lib/token/loginack-token-parser'),
	[TOKEN_TYPE.ORDER]: require('tedious/lib/token/order-token-parser'),
	[TOKEN_TYPE.RETURNSTATUS]: require('tedious/lib/token/returnstatus-token-parser'),
	[TOKEN_TYPE.RETURNVALUE]: require('tedious/lib/token/returnvalue-token-parser'),
	[TOKEN_TYPE.ROW]: require('tedious/lib/token/row-token-parser'),
	[TOKEN_TYPE.NBCROW]: require('tedious/lib/token/nbcrow-token-parser'),
	[TOKEN_TYPE.SSPI]: require('tedious/lib/token/sspi-token-parser')
}

export {Parser as TokenStreamParser} from './token-stream-parser';

  
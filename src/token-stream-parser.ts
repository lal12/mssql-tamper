import { EventEmitter } from 'events';
import StreamParser from './stream-parser';
import BufferList from "bl";
import { ColumnMetaData } from 'tedious';


/*
  Buffers are thrown at the parser (by calling addBuffer).
  Tokens are parsed from the buffer until there are no more tokens in
  the buffer, or there is just a partial token left.
  If there is a partial token left over, then it is kept until another
  buffer is added, which should contain the remainder of the partial
  token, along with (perhaps) more tokens.
  The partial token and the new buffer are concatenated, and the token
  parsing resumes.
 */
export class Parser extends EventEmitter {
	private _parser: StreamParser;
	public get parser(){return this._parser}
	constructor(private colsMetadata: ColumnMetaData[]|undefined, private options: any) {
		super();
		this._parser = new StreamParser(this.colsMetadata, this.options);
		this._parser.on('data', (token) => {
			if (token.event) {
				this.emit(token.event, token);
			}
		});
		this._parser.on('drain', () => {
			this.emit('drain');
		});
	}

	// Returns false to apply backpressure.
	addBuffer(buffer: Buffer|BufferList) {
		return this._parser.write(buffer);
	}

	// Writes an end-of-message (EOM) marker into the parser transform input
	// queue. StreamParser will emit a 'data' event with an 'endOfMessage'
	// pseudo token when the EOM marker has passed through the transform stream.
	// Returns false to apply backpressure.
	addEndOfMessageMarker() {
		return this._parser.addEndOfMessageMarker();
	}

	isEnd() {
		return this._parser.length == 0;
	}

	// Temporarily suspends the token stream parser transform from emitting events.
	pause() {
		this._parser.pause();
	}

	// Resumes the token stream parser transform.
	resume() {
		this._parser.resume();
	}
}

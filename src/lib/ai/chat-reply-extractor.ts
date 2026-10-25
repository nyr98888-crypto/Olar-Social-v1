/**
 * Incrementally decode the JSON string value of `"chat_reply"` from a
 * growing OpenRouter stream buffer so the UI can paint tokens live.
 */
export class ChatReplyJsonExtractor {
  private raw = "";
  private reply = "";
  private emitted = 0;
  private state:
    | "seek_key"
    | "seek_colon"
    | "seek_quote"
    | "in_string"
    | "done" = "seek_key";
  private escape = false;
  private unicodeLeft = 0;
  private unicodeHex = "";
  private cursor = 0;

  /** Append a raw model chunk; returns newly decoded Hebrew/text to show. */
  push(chunk: string): string {
    if (!chunk || this.state === "done") return "";
    this.raw += chunk;
    this.advance();
    const delta = this.reply.slice(this.emitted);
    this.emitted = this.reply.length;
    return delta;
  }

  get fullReply(): string {
    return this.reply;
  }

  get buffer(): string {
    return this.raw;
  }

  private advance(): void {
    while (this.cursor < this.raw.length && this.state !== "done") {
      const ch = this.raw[this.cursor];

      if (this.state === "seek_key") {
        const keyIdx = this.raw.indexOf('"chat_reply"', this.cursor);
        if (keyIdx === -1) {
          // Keep a short tail in case the key is split across chunks
          this.cursor = Math.max(this.cursor, this.raw.length - 12);
          return;
        }
        this.cursor = keyIdx + '"chat_reply"'.length;
        this.state = "seek_colon";
        continue;
      }

      if (this.state === "seek_colon") {
        if (/\s/.test(ch)) {
          this.cursor++;
          continue;
        }
        if (ch === ":") {
          this.cursor++;
          this.state = "seek_quote";
          continue;
        }
        // Unexpected — reset seek
        this.state = "seek_key";
        continue;
      }

      if (this.state === "seek_quote") {
        if (/\s/.test(ch)) {
          this.cursor++;
          continue;
        }
        if (ch === '"') {
          this.cursor++;
          this.state = "in_string";
          continue;
        }
        this.state = "seek_key";
        continue;
      }

      if (this.state === "in_string") {
        if (this.unicodeLeft > 0) {
          this.unicodeHex += ch;
          this.unicodeLeft--;
          this.cursor++;
          if (this.unicodeLeft === 0) {
            const code = parseInt(this.unicodeHex, 16);
            if (!Number.isNaN(code)) {
              this.reply += String.fromCharCode(code);
            }
            this.unicodeHex = "";
          }
          continue;
        }

        if (this.escape) {
          this.escape = false;
          this.cursor++;
          switch (ch) {
            case "n":
              this.reply += "\n";
              break;
            case "r":
              this.reply += "\r";
              break;
            case "t":
              this.reply += "\t";
              break;
            case '"':
            case "\\":
            case "/":
              this.reply += ch;
              break;
            case "u":
              this.unicodeLeft = 4;
              this.unicodeHex = "";
              break;
            default:
              this.reply += ch;
          }
          continue;
        }

        if (ch === "\\") {
          this.escape = true;
          this.cursor++;
          continue;
        }

        if (ch === '"') {
          this.cursor++;
          this.state = "done";
          return;
        }

        this.reply += ch;
        this.cursor++;
      }
    }
  }
}

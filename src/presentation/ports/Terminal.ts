export interface Terminal {
  readLines(): AsyncIterable<string>;
  writeLine(text: string): void;
  writeError(text: string): void;
  prompt(text: string): void;
  close(): void;
}

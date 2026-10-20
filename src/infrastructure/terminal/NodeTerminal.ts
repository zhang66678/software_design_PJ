import { stdin, stdout, stderr } from "node:process";
import { createInterface } from "node:readline";
import type { Interface } from "node:readline";
import type { Readable, Writable } from "node:stream";
import type { Terminal } from "../../presentation/ports/Terminal.js";

export class NodeTerminal implements Terminal {
  readonly #reader: Interface;
  readonly #output: Writable;
  readonly #error: Writable;
  readonly #interactive: boolean;

  public constructor(input: Readable = stdin, output: Writable = stdout, error: Writable = stderr) {
    this.#output = output;
    this.#error = error;
    this.#interactive = "isTTY" in input && input.isTTY === true &&
      "isTTY" in output && output.isTTY === true;
    this.#reader = createInterface({ input, output, terminal: this.#interactive, crlfDelay: Infinity });
  }

  public readLines(): AsyncIterable<string> {
    return this.#reader;
  }

  public writeLine(text: string): void {
    this.#output.write(`${text}\n`);
  }

  public writeError(text: string): void {
    this.#error.write(`${text}\n`);
  }

  public prompt(text: string): void {
    if (this.#interactive) {
      this.#reader.setPrompt(text);
      this.#reader.prompt();
    }
  }

  public close(): void {
    this.#reader.close();
  }
}

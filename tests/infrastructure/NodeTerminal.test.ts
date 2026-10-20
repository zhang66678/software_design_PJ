import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import { describe, it } from "node:test";
import { NodeTerminal } from "../../src/infrastructure/terminal/NodeTerminal.js";

describe("NodeTerminal", () => {
  it("reads CRLF, blank lines and the final line without a newline in order", async () => {
    const input = new PassThrough();
    const terminal = new NodeTerminal(input, new PassThrough(), new PassThrough());
    const lines: string[] = [];
    const reader = terminal.readLines()[Symbol.asyncIterator]();
    input.end("init\r\n\r\nhelp");
    for await (const line of { [Symbol.asyncIterator]: () => reader }) {
      lines.push(line);
    }
    terminal.close();

    assert.deepEqual(lines, ["init", "", "help"]);
  });

  it("separates output and errors and suppresses prompts in pipes", () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const error = new PassThrough();
    const terminal = new NodeTerminal(input, output, error);

    terminal.writeLine("canvas 800x600 created");
    terminal.writeError("error: no such shape: r9");
    terminal.prompt("svg> ");
    terminal.close();

    assert.equal(String(output.read()), "canvas 800x600 created\n");
    assert.equal(String(error.read()), "error: no such shape: r9\n");
  });

  it("shows the prompt for interactive input and output", () => {
    const input = Object.assign(new PassThrough(), { isTTY: true });
    const output = Object.assign(new PassThrough(), { isTTY: true });
    const terminal = new NodeTerminal(input, output, new PassThrough());

    terminal.prompt("svg> ");
    terminal.close();

    assert.match(String(output.read()), /svg> /u);
  });
});

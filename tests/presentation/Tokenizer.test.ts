import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Tokenizer } from "../../src/presentation/cli/Tokenizer.js";

describe("Tokenizer", () => {
  const tokenizer = new Tokenizer();

  for (const line of ["", "  \t ", '# ignored "unfinished', "  # comment"]) {
    it(`ignores blank or comment line ${JSON.stringify(line)}`, () => {
      assert.deepEqual(tokenizer.tokenize(line), []);
    });
  }

  it("splits whitespace and preserves a hex color", () => {
    assert.deepEqual(tokenizer.tokenize("  create\trect r1 10 20 100 50 #4a90d9  "),
      ["create", "rect", "r1", "10", "20", "100", "50", "#4a90d9"]);
  });

  it("preserves spaces and Chinese text in quoted arguments", () => {
    assert.deepEqual(tokenizer.tokenize('create text t1 10 20 "开始 流程"'),
      ["create", "text", "t1", "10", "20", "开始 流程"]);
  });

  it("preserves an explicitly empty quoted argument", () => {
    assert.deepEqual(tokenizer.tokenize('set t1 text ""'), ["set", "t1", "text", ""]);
  });

  it("keeps backslashes in quoted Windows paths", () => {
    assert.deepEqual(tokenizer.tokenize(String.raw`read "D:\课 程\demo.svg"`),
      ["read", String.raw`D:\课 程\demo.svg`]);
  });

  it("keeps backslashes in unquoted Windows paths", () => {
    assert.deepEqual(tokenizer.tokenize(String.raw`read D:\tmp\demo.svg`),
      ["read", String.raw`D:\tmp\demo.svg`]);
  });

  it("unescapes quoted double quotes and backslashes", () => {
    assert.deepEqual(tokenizer.tokenize(String.raw`set t1 text "say \"hello\" and \\ keep \q"`),
      ["set", "t1", "text", String.raw`say "hello" and \ keep \q`]);
  });

  it("treats a hash after a command as a literal argument", () => {
    assert.deepEqual(tokenizer.tokenize("help # literal"), ["help", "#", "literal"]);
  });

  it("rejects an unterminated quote and accepts the next line independently", () => {
    assert.throws(() => tokenizer.tokenize('show "r1'), {
      name: "PresentationError", message: "unterminated double quote",
    });
    assert.deepEqual(tokenizer.tokenize("show r1"), ["show", "r1"]);
  });
});

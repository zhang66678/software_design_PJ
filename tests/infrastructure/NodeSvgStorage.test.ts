import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Text } from "../../src/domain/shapes/Text.js";
import { NodeSvgStorage } from "../../src/infrastructure/storage/NodeSvgStorage.js";
import { SvgCodec } from "../../src/infrastructure/svg/SvgCodec.js";

describe("NodeSvgStorage", () => {
  let directory: string;
  const storage = new NodeSvgStorage();

  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), "svg-storage-"));
  });

  afterEach(() => {
    assert.equal(dirname(directory), resolve(tmpdir()));
    assert.ok(basename(directory).startsWith("svg-storage-"));
    rmSync(directory, { recursive: true, force: true });
  });

  it("creates and replaces a UTF-8 SVG file without leaving temporary files", () => {
    const filePath = join(directory, "图 表.svg");
    const document = new SvgDocument(400, 200);
    document.add(new Text("title", 10, 40, "开始 & 结束"));
    storage.save(document, filePath);
    assert.equal(readFileSync(filePath, "utf8"), new SvgCodec().encode(document));
    const resized = document.withSize(640, 300);
    storage.save(resized, filePath);

    assert.equal(readFileSync(filePath, "utf8"), new SvgCodec().encode(resized));
    assert.deepEqual(readdirSync(directory), ["图 表.svg"]);
  });

  it("reports failed writes and renames and cleans its owned temporary files", () => {
    const blocked = join(directory, "blocked");
    mkdirSync(blocked);
    const document = new SvgDocument();
    for (const filePath of [join(directory, "missing", "out.svg"), blocked]) {
      assert.throws(() => storage.save(document, filePath), { message: `cannot write file: ${filePath}` });
    }
    assert.deepEqual(readdirSync(directory), ["blocked"]);
    assert.deepEqual(readdirSync(blocked), []);
  });

  it("preserves an existing file when serialization fails before writing", () => {
    const filePath = join(directory, "original.svg");
    writeFileSync(filePath, "original content", "utf8");
    const document = new SvgDocument();
    document.add(new Text("broken", 0, 0, "bad\u0000"));

    assert.throws(() => storage.save(document, filePath), { message: "invalid XML character" });
    assert.equal(readFileSync(filePath, "utf8"), "original content");
    assert.deepEqual(readdirSync(directory), ["original.svg"]);
  });
});

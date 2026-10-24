import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execPath } from "node:process";
import { describe, it, type TestContext } from "node:test";
import { fileURLToPath } from "node:url";
import { SvgCodec } from "../../src/infrastructure/svg/SvgCodec.js";

describe("Course examples through the CLI", () => {
  const entry = fileURLToPath(new URL("../../src/bootstrap/Main.js", import.meta.url));
  const examples = fileURLToPath(new URL("../../../examples/", import.meta.url));
  const codec = new SvgCodec();

  const prepare = (context: TestContext): string => {
    const directory = mkdtempSync(join(tmpdir(), "svg-course-"));
    context.after(() => {
      assert.equal(dirname(directory), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith("svg-course-"));
      rmSync(directory, { recursive: true, force: true });
    });
    mkdirSync(join(directory, "examples", "output"), { recursive: true });
    copyFileSync(join(examples, "other.svg"), join(directory, "examples", "other.svg"));
    return directory;
  };

  const replay = (directory: string, name: string, extra: readonly string[] = []) => {
    const result = spawnSync(execPath, [entry], {
      cwd: directory,
      input: `${readFileSync(join(examples, name), "utf8")}\n${extra.join("\n")}`,
      encoding: "utf8",
      timeout: 10_000,
    });
    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    return result;
  };

  it("replays section 6 including rejected grouping, delete undo, save barrier and external SVG import", (context) => {
    const directory = prepare(context);
    const result = replay(directory, "typical-session.txt", [
      "save examples/output/imported.svg", "read examples/output/imported.svg", "save examples/output/imported-copy.svg",
    ]);
    assert.equal(result.stderr, [
      "error: cannot group a container into its own descendant: markers",
      "error: undo not allowed after io command", "",
    ].join("\n"));
    assert.ok(result.stdout.includes("saved to examples/output/demo.svg (5 elements)"));
    assert.ok(result.stdout.includes("warning: assigned id rect1 to unnamed <rect>\nread examples/other.svg (7 elements)"));
    assert.equal(result.stdout.split("warning:").length - 1, 1);
    const demo = codec.decode(readFileSync(join(directory, "examples/output/demo.svg"), "utf8")).document;
    assert.deepEqual(demo.getShapes().map((shape) => shape.id), ["bg", "title", "markers"]);
    assert.deepEqual(demo.getShape("markers").getChildren().map((shape) => shape.id), ["c1", "box"]);
    assert.deepEqual(demo.getShape("c1").describe().attributes, { cx: 130, cy: 100, r: 20, fill: "red" });
    assert.deepEqual(demo.getShape("box").describe().attributes, { x: 200, y: 80, width: 60, height: 60, fill: "#3366ff" });
    assert.equal(demo.getShape("title").describe().textContent, "My Diagram");
    const importedXml = readFileSync(join(directory, "examples/output/imported.svg"), "utf8");
    assert.equal(readFileSync(join(directory, "examples/output/imported-copy.svg"), "utf8"), importedXml);
    const imported = codec.decode(importedXml).document;
    assert.equal(imported.width, 400);
    assert.equal(imported.height, 300);
    assert.equal(imported.getParent("r2")?.id, "g1");
    assert.deepEqual(imported.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.id)),
      ["rect1", "t1", "c1", "g1", "r2", "c2", "e1"]);
    assert.equal(readFileSync(join(directory, "examples/other.svg"), "utf8"), readFileSync(join(examples, "other.svg"), "utf8"));
  });

  it("replays section 6.1 version A and round trips its eight-element flowchart", (context) => {
    const directory = prepare(context);
    const result = replay(directory, "flowchart.txt", [
      "undo", "read examples/output/flowchart.svg", "redo", "save examples/output/flowchart-copy.svg",
    ]);
    assert.equal(result.stderr, "error: undo not allowed after io command\nerror: undo not allowed after io command\n");
    assert.ok(result.stdout.includes("saved to examples/output/flowchart.svg (8 elements)"));
    assert.ok(result.stdout.includes("read examples/output/flowchart.svg (8 elements)"));
    const xml = readFileSync(join(directory, "examples/output/flowchart.svg"), "utf8");
    assert.equal(readFileSync(join(directory, "examples/output/flowchart-copy.svg"), "utf8"), xml);
    const document = codec.decode(xml).document;
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["flowchart"]);
    assert.deepEqual(document.getShape("flowchart").getChildren().map((shape) => shape.id), ["node1", "node2", "arrow1"]);
    assert.deepEqual(document.getShape("node2").getChildren().map((shape) => shape.id), ["process", "process-label"]);
    assert.deepEqual(document.getShape("start").describe().attributes,
      { x: 120, y: 100, width: 160, height: 60, fill: "#4a90d9" });
    assert.deepEqual(document.getShape("process").describe().attributes,
      { x: 520, y: 100, width: 160, height: 60, fill: "#f5a623" });
    assert.deepEqual(document.getShape("process-label").describe(),
      { id: "process-label", type: "text", attributes: { x: 545, y: 135 }, textContent: "处理数据 v2" });
    assert.deepEqual(document.getShape("arrow1").describe().attributes,
      { x1: 280, y1: 130, x2: 520, y2: 130, stroke: "black" });
    assert.equal(document.getParent("start-label")?.id, "node1");
  });

  it("retains redo through invalid edits and restores the saved tree after mixed structural edits", (context) => {
    const directory = prepare(context);
    const result = replay(directory, "flowchart.txt", [
      "move node2 0 25", "undo", "tree node2", "show process-label", "canvas", "help",
      'create box future 0 0 10 10 "后续阶段"',
      "group bad node2 process", "addto node2 flowchart", "create rect start 0 0 1 1",
      "ungroup flowchart", "create rect orphan 0 0 1 1 in missing", "scale node2 0",
      "redo", "show process", "show process-label", "undo",
      "ungroup node2", "undo", "addto node1 node2", "undo", "delete node2", "undo",
      "front node1", "undo", "back arrow1", "undo", "group selected start start-label", "undo",
      "scale flowchart 0.5", "undo", "set start fill red", "undo",
      "save examples/output/restored.svg", "read examples/output/restored.svg", "save examples/output/roundtrip.svg",
    ]);
    assert.equal(result.stderr, [
      "error: unknown shape type: box (is the plugin loaded?)",
      "error: cannot group a container into its own descendant: node2",
      "error: cannot add a shape into itself or its descendant: flowchart",
      "error: id already exists: start", "error: cannot ungroup top-level container: flowchart",
      "error: no such container: missing", "error: scale factor must be positive", "",
    ].join("\n"));
    assert.ok(result.stdout.includes("redone: g#node2 moved by (0,25)"));
    assert.ok(result.stdout.includes("rect#process  parent=g#node2\n  x=520 y=125 width=160 height=60"));
    assert.ok(result.stdout.includes('text#process-label  parent=g#node2\n  x=545 y=160\n  text="处理数据 v2"'));
    const original = readFileSync(join(directory, "examples/output/flowchart.svg"), "utf8");
    assert.equal(readFileSync(join(directory, "examples/output/restored.svg"), "utf8"), original);
    assert.equal(readFileSync(join(directory, "examples/output/roundtrip.svg"), "utf8"), original);
  });
});

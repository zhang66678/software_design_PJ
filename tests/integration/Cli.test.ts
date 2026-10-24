import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { execPath } from "node:process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { SvgCodec } from "../../src/infrastructure/svg/SvgCodec.js";

describe("CLI entry", () => {
  const entry = fileURLToPath(new URL("../../src/bootstrap/Main.js", import.meta.url));

  it("reads before init, preserves redo on invalid imports, and saves back to the read path", (context) => {
    const directory = mkdtempSync(join(tmpdir(), "svg-cli-read-"));
    context.after(() => {
      assert.equal(dirname(directory), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith("svg-cli-read-"));
      rmSync(directory, { recursive: true, force: true });
    });
    writeFileSync(join(directory, "图 表.svg"), '<svg width="400" height="300"><g id="g1"><rect x="10" width="20" height="30"/><text id="t1">开始 &amp; 结束</text></g></svg>', "utf8");
    writeFileSync(join(directory, "broken.svg"), '<svg width="1" height="1"><rect/></g></svg>', "utf8");
    writeFileSync(join(directory, "duplicate.svg"), '<svg width="1" height="1"><rect id="a"/><circle id="a"/></svg>', "utf8");
    const result = spawnSync(execPath, [entry], {
      cwd: directory,
      input: [
        'read "图 表.svg"', "tree", "undo",
        "move rect1 5 0", "undo", "read missing.svg", "read broken.svg", "read duplicate.svg", "redo",
        "save", 'read "图 表.svg"', "redo", "show rect1", "show t1", "save copy.svg",
        "init", "save",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    const errors = result.stderr.trim().split("\n");
    assert.equal(errors.length, 6);
    assert.equal(errors[0], "error: undo not allowed after io command");
    assert.equal(errors[1], "error: cannot read file: missing.svg");
    assert.match(errors[2] ?? "", /^error: invalid SVG XML:/u);
    assert.equal(errors[3], "error: id already exists: a");
    assert.equal(errors[4], "error: undo not allowed after io command");
    assert.equal(errors[5], "error: no file path. use 'save <file.svg>' first");
    assert.equal(result.stdout.split("warning: assigned id rect1 to unnamed <rect>").length - 1, 1);
    assert.equal(result.stdout.split("read 图 表.svg (3 elements)").length - 1, 2);
    assert.ok(result.stdout.includes("redone: rect#rect1 moved by (5,0)"));
    assert.ok(result.stdout.includes("rect#rect1  parent=g#g1\n  x=15 y=0 width=20 height=30"));
    assert.ok(result.stdout.includes('text="开始 & 结束"'));
    const original = readFileSync(join(directory, "图 表.svg"), "utf8");
    assert.equal(readFileSync(join(directory, "copy.svg"), "utf8"), original);
    const loaded = new SvgCodec().decode(original);
    assert.deepEqual(loaded.warnings, []);
    assert.equal(loaded.document.getShape("rect1").describe().attributes.x, 15);
  });

  it("saves real SVG files and retains the default path and redo only when appropriate", (context) => {
    const directory = mkdtempSync(join(tmpdir(), "svg-cli-save-"));
    context.after(() => {
      assert.equal(dirname(directory), resolve(tmpdir()));
      assert.ok(basename(directory).startsWith("svg-cli-save-"));
      rmSync(directory, { recursive: true, force: true });
    });
    const result = spawnSync(execPath, [entry], {
      cwd: directory,
      input: [
        "save before.svg", "init 400 200", "save",
        "create g scene",
        "create rect r1 10 20 30 40 red in scene",
        'create text title 10 40 "开始 & <结束>" in scene',
        'save "画 布.svg"', "undo",
        "move r1 5 0", "undo", "save missing/fail.svg", "redo",
        "canvas 640 300", "save", "init", "save",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: no document. use 'init' or 'read' first",
      "error: no file path. use 'save <file.svg>' first",
      "error: undo not allowed after io command",
      "error: cannot write file: missing/fail.svg",
      "error: no file path. use 'save <file.svg>' first",
      "",
    ].join("\n"));
    assert.equal(result.stdout.split("saved to 画 布.svg (3 elements)").length - 1, 2);
    assert.ok(result.stdout.includes("redone: rect#r1 moved by (5,0)"));
    const xml = readFileSync(join(directory, "画 布.svg"), "utf8");
    assert.ok(xml.includes('width="640" height="300" viewBox="0 0 640 300"'));
    assert.ok(xml.includes('<rect id="r1" fill="red" x="15" y="20" width="30" height="40"/>'));
    assert.ok(xml.includes('开始 &amp; &lt;结束&gt;</text>'));
    assert.deepEqual(readdirSync(directory), ["画 布.svg"]);
  });

  it("reorders siblings and applies the canvas query and resize history rules", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init 400 300",
        "create g scene",
        "create rect a 1 2 3 4 in scene",
        "create rect b 5 6 7 8 in scene",
        "front a", "tree scene", "undo", "canvas", "redo",
        "back a", "tree scene",
        "canvas 640", "undo", "redo",
        "front a", "canvas 0 100", "undo", "tree",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: undo not allowed after io command",
      "error: undo not allowed after io command",
      "error: canvas dimensions must be positive finite numbers",
      "",
    ].join("\n"));
    assert.ok(result.stdout.includes("g#scene\n├── rect#b  x=5 y=6 width=7 height=8\n└── rect#a  x=1 y=2 width=3 height=4"));
    assert.ok(result.stdout.includes("canvas 400x300\nredone: rect#a brought to front"));
    assert.ok(result.stdout.includes("canvas resized to 640x300"));
    assert.ok(result.stdout.endsWith([
      "svg (640x300)",
      "└── g#scene",
      "    ├── rect#a  x=1 y=2 width=3 height=4",
      "    └── rect#b  x=5 y=6 width=7 height=8",
      "",
    ].join("\n")));
  });

  it("groups and ungroups siblings while retaining redo across rejected selections", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init",
        "create g scene",
        "create rect before 0 0 1 1 in scene",
        "create rect r1 10 20 30 40 red in scene",
        'create text label 10 40 "开始" in scene',
        "create rect after 0 0 1 1 in scene",
        "group node label r1", "tree scene", "show r1",
        "ungroup node", "undo",
        "group bad r1 node", "ungroup scene", "ungroup r1",
        "redo", "show r1", "undo", "undo", "redo", "show label",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: cannot group a container into its own descendant: node",
      "error: cannot ungroup top-level container: scene",
      "error: not a container: r1",
      "",
    ].join("\n"));
    assert.ok(result.stdout.includes([
      "g#scene",
      "├── rect#before  x=0 y=0 width=1 height=1",
      "├── g#node",
      "│   ├── rect#r1  x=10 y=20 width=30 height=40  fill=red",
      '│   └── text#label  x=10 y=40  "开始"',
      "└── rect#after  x=0 y=0 width=1 height=1",
    ].join("\n")));
    for (const output of [
      "g#node created with 2 children",
      "rect#r1  parent=g#node",
      "redone: g#node ungrouped with 2 children",
      "rect#r1  parent=g#scene",
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
    assert.ok(result.stdout.endsWith('text#label  parent=g#node\n  x=10 y=40\n  text="开始"\n'));
  });

  it("moves and deletes complete subtrees while preserving history across errors", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init",
        "create g source",
        "create g node in source",
        "create rect r1 10 20 30 40 red in node",
        'create text label 10 40 "开始" in node',
        "create g target",
        "create rect existing 0 0 1 1 in target",
        "addto target node", "show node",
        "delete node", "tree target", "undo",
        "addto node target", "delete missing", "addto r1 node",
        "tree target", "redo", "undo", "undo", "show node",
        "redo", "show r1",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: cannot add a shape into itself or its descendant: target",
      "error: no such shape: missing",
      "error: not a container: r1",
      "",
    ].join("\n"));
    for (const output of [
      "g#node added to g#target",
      "g#node  parent=g#target",
      "g#node deleted",
      "g#target\n└── rect#existing  x=0 y=0 width=1 height=1",
      '    └── text#label  x=10 y=40  "开始"',
      "redone: g#node deleted",
      "g#node  parent=g#source",
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
    assert.ok(result.stdout.endsWith("rect#r1  parent=g#node\n  x=10 y=20 width=30 height=40\n  fill=red\n"));
  });

  it("builds the two-node flowchart and edits nested containers through the real CLI", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init 800 600",
        "create g flowchart",
        "create g node1 in flowchart",
        "create rect start 120 100 160 60 #4a90d9 in node1",
        'create text start-label 155 135 "开始" in node1',
        "create g node2 in flowchart",
        "create rect process 520 100 160 60 #f5a623 in node2",
        'create text process-label 545 135 "处理数据" in node2',
        "create line arrow1 280 130 520 130 black in flowchart",
        "tree flowchart",
        "move node2 0 100", "show process",
        "undo", "show process", "redo",
        "scale node2 0.5", "show process", "undo",
        'set process-label text "处理数据 v2"', "show process-label",
        "undo", "show process-label",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.ok(result.stdout.includes([
      "g#flowchart",
      "├── g#node1",
      "│   ├── rect#start  x=120 y=100 width=160 height=60  fill=#4a90d9",
      '│   └── text#start-label  x=155 y=135  "开始"',
      "├── g#node2",
      "│   ├── rect#process  x=520 y=100 width=160 height=60  fill=#f5a623",
      '│   └── text#process-label  x=545 y=135  "处理数据"',
      "└── line#arrow1  x1=280 y1=130 x2=520 y2=130  stroke=black",
    ].join("\n")));
    for (const output of [
      "g#node2 created in g#flowchart",
      "text#process-label created in g#node2",
      "rect#process  parent=g#node2\n  x=520 y=200 width=160 height=60",
      "rect#process  parent=g#node2\n  x=520 y=100 width=160 height=60",
      "rect#process  parent=g#node2\n  x=260 y=100 width=80 height=30",
      'text="处理数据 v2"',
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
    assert.ok(result.stdout.endsWith('text#process-label  parent=g#node2\n  x=545 y=235\n  text="处理数据"\n'));
  });

  it("runs the rectangle workflow through the real entry and exits at EOF", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init 800 600",
        "create rect r1 10 20 100 50 #4a90d9",
        "move r1 30 0",
        "tree",
        "undo",
        "show r1",
        "redo",
        "tree",
        "",
      ].join("\r\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, [
      "svg-editor 0.1.0 — type 'help' for commands",
      "canvas 800x600 created",
      "rect#r1 created",
      "rect#r1 moved by (30,0)",
      "svg (800x600)",
      "└── rect#r1  x=40 y=20 width=100 height=50  fill=#4a90d9",
      "undone: rect#r1 moved by (30,0)",
      "rect#r1  parent=svg",
      "  x=10 y=20 width=100 height=50",
      "  fill=#4a90d9",
      "redone: rect#r1 moved by (30,0)",
      "svg (800x600)",
      "└── rect#r1  x=40 y=20 width=100 height=50  fill=#4a90d9",
      "",
    ].join("\n"));
  });

  it("recovers from failed commands, comments and malformed quotes without losing redo", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "show r1",
        "init",
        "undo",
        "create rect r1 10 20 100 50 #fff",
        "move r1 30 0",
        "undo",
        "",
        '   # ignored "broken quote',
        "create rect r1 99 99 1 1",
        "move r9 1 2",
        "unknown",
        "move r1 bad 0",
        'show "r1',
        "tree r1",
        "show r1",
        "help",
        "redo",
        "show r1",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: no document. use 'init' or 'read' first",
      "error: undo not allowed after io command",
      "error: id already exists: r1",
      "error: no such shape: r9",
      "error: unknown command: unknown",
      "error: dx must be a finite number",
      "error: unterminated double quote",
      "",
    ].join("\n"));
    assert.match(result.stdout, /x=10 y=20/u);
    assert.match(result.stdout, /redone: rect#r1 moved by \(30,0\)/u);
    assert.ok(result.stdout.endsWith("rect#r1  parent=svg\n  x=40 y=20 width=100 height=50\n  fill=#fff\n"));
    assert.doesNotMatch(result.stdout, /svg> |error:/u);
  });

  it("handles empty stdin without waiting for another line", () => {
    const result = spawnSync(execPath, [entry], { input: "", encoding: "utf8", timeout: 10_000 });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.equal(result.stdout, "svg-editor 0.1.0 — type 'help' for commands\n");
  });

  it("preserves Chinese ids and quoted spaced style arguments", () => {
    const result = spawnSync(execPath, [entry], {
      input: 'init\ncreate rect "矩形一" 10 20 100 50 "rgb(255, 0, 0)"\nshow 矩形一',
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    assert.match(result.stdout, /rect#矩形一 created/u);
    assert.match(result.stdout, /fill="rgb\(255, 0, 0\)"/u);
  });

  it("processes buffered lines in sequence before EOF", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init", "create rect r1 10 20 100 50",
        ...Array.from({ length: 50 }, () => "move r1 1 0"),
        "show r1", "undo", "show r1", "redo", "show r1",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
    const positions = [...result.stdout.matchAll(/ {2}x=(\d+) y=20 width=100 height=50/gu)]
      .map((match) => Number(match[1]));
    assert.deepEqual(positions, [60, 59, 60]);
  });

  it("scales and sets geometry, styles and text with undo and redo", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init", "create rect r1 10 20 100 50",
        "scale r1 2", "show r1", "undo", "show r1", "redo",
        "set r1 fill #4a90d9", "set r1 stroke-width 2", "set r1 width 80",
        "show r1", "undo", "show r1", "redo",
        'create text title 20 40 "My Diagram"',
        'set title text "  新 标题  "', "show title", "undo", "show title", "redo",
        'set title text ""', "show title", "undo",
        "set r1 width -1", "scale r1 0", "set title font-size 16", 'set r1 x ""',
        "redo", "show title",
        "create line edge 1 2 3 4", "scale edge 0.5", "set edge stroke black", "show edge",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, [
      "error: rectangle dimensions must be non-negative",
      "error: scale factor must be positive",
      "error: unknown attribute: font-size",
      "error: x must be a finite number",
      "",
    ].join("\n"));
    for (const output of [
      "rect#r1  parent=svg\n  x=20 y=40 width=200 height=100\n",
      "rect#r1  parent=svg\n  x=10 y=20 width=100 height=50\n",
      "rect#r1  parent=svg\n  x=20 y=40 width=80 height=100\n  fill=#4a90d9 stroke-width=2\n",
      "rect#r1  parent=svg\n  x=20 y=40 width=200 height=100\n  fill=#4a90d9 stroke-width=2\n",
      'text#title  parent=svg\n  x=20 y=40\n  text="  新 标题  "\n',
      'text#title  parent=svg\n  x=20 y=40\n  text="My Diagram"\n',
      'text#title  parent=svg\n  x=20 y=40\n  text=""\n',
      'redone: text#title updated: text=""',
      "line#edge  parent=svg\n  x1=0.5 y1=1 x2=1.5 y2=2\n  stroke=black\n",
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
  });

  it("creates, displays, moves and restores lines and text", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init",
        "create line edge 10 20 50 60 black",
        "create line plain 0 0 0 0",
        'create text label 20 40 "  开始 流程  "',
        'create text empty 0 0 ""',
        "move edge 5 -2", "move label -5 3",
        "tree",
        "undo", "show label",
        "undo", "show edge",
        "redo", "redo", "undo",
        'create text bad 0 nope "invalid"',
        "redo", "show edge", "show label", "show plain", "show empty",
        "help",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "error: y must be a finite number\n");
    for (const output of [
      "line#edge  x1=15 y1=18 x2=55 y2=58  stroke=black",
      'text#label  x=15 y=43  "  开始 流程  "',
      'text#empty  x=0 y=0  ""',
      'text#label  parent=svg\n  x=20 y=40\n  text="  开始 流程  "\n',
      "line#edge  parent=svg\n  x1=10 y1=20 x2=50 y2=60\n  stroke=black\n",
      "line#edge  parent=svg\n  x1=15 y1=18 x2=55 y2=58\n  stroke=black\n",
      'text#label  parent=svg\n  x=15 y=43\n  text="  开始 流程  "\n',
      "line#plain  parent=svg\n  x1=0 y1=0 x2=0 y2=0\ntext#empty",
      'text#empty  parent=svg\n  x=0 y=0\n  text=""\n',
      "create line <id> <x1> <y1> <x2> <y2> [stroke]",
      'create text <id> <x> <y> "content"',
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
  });

  it("creates, displays, moves and restores circles and ellipses", () => {
    const result = spawnSync(execPath, [entry], {
      input: [
        "init",
        "create circle c1 10.5 20.25 8.5 red",
        "create ellipse e1 -5 7.25 30 12.5",
        "move c1 2 -0.25",
        "move e1 -0.5 3",
        "tree",
        "undo", "show e1",
        "undo", "show c1",
        "redo", "redo",
        "undo",
        "create circle bad 0 0 -1",
        "redo", "show c1", "show e1",
        "help",
      ].join("\n"),
      encoding: "utf8",
      timeout: 10_000,
    });

    assert.equal(result.error, undefined);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "error: circle radius must be non-negative\n");
    for (const output of [
      "circle#c1 created",
      "ellipse#e1 created",
      "├── circle#c1  cx=12.5 cy=20 r=8.5  fill=red",
      "└── ellipse#e1  cx=-5.5 cy=10.25 rx=30 ry=12.5",
      "circle#c1  parent=svg\n  cx=10.5 cy=20.25 r=8.5\n  fill=red\n",
      "ellipse#e1  parent=svg\n  cx=-5 cy=7.25 rx=30 ry=12.5\n",
      "circle#c1  parent=svg\n  cx=12.5 cy=20 r=8.5\n  fill=red\n",
      "ellipse#e1  parent=svg\n  cx=-5.5 cy=10.25 rx=30 ry=12.5\n",
      "create circle <id> <cx> <cy> <r> [fill]",
      "create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
    ]) {
      assert.ok(result.stdout.includes(output), output);
    }
  });
});

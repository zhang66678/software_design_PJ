import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { execPath } from "node:process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

describe("CLI entry", () => {
  const entry = fileURLToPath(new URL("../../src/bootstrap/Main.js", import.meta.url));

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

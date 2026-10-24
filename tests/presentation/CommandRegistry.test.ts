import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { ShapeFactory } from "../../src/application/factories/ShapeFactory.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { CommandRegistry } from "../../src/presentation/cli/CommandRegistry.js";
import { Tokenizer } from "../../src/presentation/cli/Tokenizer.js";
import { DocumentFormatter } from "../../src/presentation/formatters/DocumentFormatter.js";

describe("CommandRegistry", () => {
  let session: EditorSession;
  let registry: CommandRegistry;
  let run: (line: string) => string;

  beforeEach(() => {
    session = new EditorSession();
    const executor = new CommandExecutor(session);
    registry = new CommandRegistry(new ShapeFactory(), session, new DocumentFormatter());
    const tokenizer = new Tokenizer();
    run = (line) => registry.parse(tokenizer.tokenize(line)).execute(executor);
  });

  it("generates help from registered commands and works without a document", () => {
    assert.equal(run("help"), [
      "Commands:",
      "  init [w] [h]",
      "  canvas [w] [h]",
      "  create <type> <id> [params...] [in <containerId>]",
      "  delete <id>",
      "  addto <gid> <id>",
      "  group <newGid> <id1> <id2>...",
      "  ungroup <gid>",
      "  front <id>",
      "  back <id>",
      "  move <id> <dx> <dy>",
      "  scale <id> <factor>",
      "  set <id> <attr> <value>",
      "  tree [id]",
      "  show <id>",
      "  help",
      "  undo",
      "  redo",
      "",
      "Shape creation:",
      "  create rect <id> <x> <y> <w> <h> [fill]",
      "  create circle <id> <cx> <cy> <r> [fill]",
      "  create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "  create line <id> <x1> <y1> <x2> <y2> [stroke]",
      '  create text <id> <x> <y> "content"',
      "  create g <id>",
      "  All types support the suffix: in <containerId>",
    ].join("\n"));
  });

  it("initializes with only width and preserves the default height", () => {
    assert.equal(run("init 320"), "canvas 320x600 created");
    assert.equal(session.getDocument().width, 320);
  });

  for (const line of [
    "init 1 2 3", "create", "create rect", "move r1 1", "move r1 1 2 3",
    "scale r1", "set r1 fill",
    "delete", "delete r1 extra", "addto", "addto g1", "addto g1 r1 extra",
    "group", "group g1", "ungroup", "ungroup g1 extra",
    "front", "front r1 extra", "back", "back r1 extra", "canvas 1 2 3",
    "tree r1 r2", "show", "show r1 r2", "help extra", "undo extra", "redo extra",
  ]) {
    it(`rejects the wrong argument count in ${JSON.stringify(line)}`, () => {
      assert.throws(() => run(line), { name: "ApplicationError", message: /^usage: /u });
      assert.throws(() => session.getDocument(), { message: "no document. use 'init' or 'read' first" });
    });
  }

  it("reports unknown command names and handles empty dispatch input", () => {
    assert.throws(() => run("unknown"), { message: "unknown command: unknown" });
    assert.throws(() => registry.parse([]), { message: "empty command" });
  });

  it("requires a document for tree and show", () => {
    for (const line of ["tree", "show r1"]) {
      assert.throws(() => run(line), { message: "no document. use 'init' or 'read' first" });
    }
  });

  it("does not clear a history barrier through display commands", () => {
    run("init");
    assert.equal(run("tree"), "svg (800x600)");
    assert.equal(run("canvas"), "canvas 800x600");
    assert.throws(() => run("canvas 0 100"), { message: "canvas dimensions must be positive finite numbers" });
    run("help");
    assert.throws(() => run("show missing"), { message: "no such shape: missing" });
    assert.throws(() => run("undo"), { message: "undo not allowed after io command" });
    assert.throws(() => run("redo"), { message: "undo not allowed after io command" });
  });

  it("preserves redo across successful and failed display commands", () => {
    run("init");
    run("create rect r1 10 20 100 50 #4a90d9");
    run("move r1 30 0");
    run("undo");

    assert.match(run("tree"), /x=10 y=20/u);
    assert.match(run("tree r1"), /^rect#r1/u);
    assert.match(run("show r1"), /parent=svg/u);
    run("help");
    assert.throws(() => run("tree missing"), { message: "no such shape: missing" });
    assert.throws(() => run("show missing"), { message: "no such shape: missing" });

    run("redo");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });

  it("keeps redo after numeric or quoting errors", () => {
    run("init");
    run("create rect r1 10 20 100 50");
    run("move r1 30 0");
    run("undo");

    for (const line of ["init bad", "init 800 Infinity", "canvas bad", "canvas 800 Infinity", "move r1 invalid 0", 'show "r1']) {
      assert.throws(() => run(line));
    }

    run("redo");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });

  it("creates all six types in a container and restores creation as one undo unit", () => {
    run("init");
    assert.equal(run("create g scene"), "g#scene created");
    for (const { type, id, parameters } of [
      { type: "g", id: "node", parameters: "" },
      { type: "rect", id: "r1", parameters: "1 2 3 4 red" },
      { type: "circle", id: "c1", parameters: "1 2 3" },
      { type: "ellipse", id: "e1", parameters: "1 2 3 4" },
      { type: "line", id: "edge", parameters: "1 2 3 4 black" },
      { type: "text", id: "label", parameters: '1 2 "开始"' },
    ]) {
      assert.equal(run(`create ${type} ${id} ${parameters} in scene`), `${type}#${id} created in g#scene`);
      assert.equal(session.getDocument().getParent(id)?.id, "scene");
    }
    run("undo");
    assert.throws(() => session.getDocument().getShape("label"), { message: "no such shape: label" });
    run("redo");
    assert.deepEqual(session.getDocument().getShape("scene").getChildren().map((shape) => shape.id),
      ["node", "r1", "c1", "e1", "edge", "label"]);
  });

  it("preserves literal in text, empty text and a container named in", () => {
    run("init");
    run("create g in");
    run('create text root 1 2 "in"');
    run('create text nested 1 2 "in" in in');
    run('create text spaced 1 2 "in in" in in');
    run('create text empty 1 2 "" in in');

    const document = session.getDocument();
    assert.equal(document.getParent("root"), undefined);
    assert.equal(document.getShape("root").describe().textContent, "in");
    assert.equal(document.getShape("nested").describe().textContent, "in");
    assert.equal(document.getParent("nested")?.id, "in");
    assert.equal(document.getShape("spaced").describe().textContent, "in in");
    assert.equal(document.getShape("empty").describe().textContent, "");
  });

  it("keeps the complete tree and redo after invalid container creations", () => {
    run("init");
    run("create g scene");
    run("create rect r1 10 20 30 40 in scene");
    run("move r1 30 0");
    run("undo");
    const before = run("tree");

    for (const { line, message } of [
      { line: "create g bad in missing", message: "no such container: missing" },
      { line: "create g bad in r1", message: "not a container: r1" },
      { line: "create rect r1 0 0 1 1", message: "id already exists: r1" },
      { line: "create g scene in scene", message: "id already exists: scene" },
      { line: "create g bad extra in scene", message: "usage: create g <id>" },
      { line: "create g bad in", message: "usage: create g <id>" },
      { line: "create text bad 0 0 in scene", message: 'usage: create text <id> <x> <y> "content"' },
    ]) {
      assert.throws(() => run(line), { message });
      assert.equal(run("tree"), before);
    }
    run("redo");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });
});

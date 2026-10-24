import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { BackCommand } from "../../src/application/commands/BackCommand.js";
import { CanvasCommand } from "../../src/application/commands/CanvasCommand.js";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { FrontCommand } from "../../src/application/commands/FrontCommand.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

describe("Layout commands", () => {
  let session: EditorSession;
  let executor: CommandExecutor;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    const document = new SvgDocument(400, 300);
    document.add(new Rect("first", 1, 2, 3, 4));
    document.add(new Rect("second", 5, 6, 7, 8));
    document.add(new Group("node", [new Rect("nested", 10, 20, 30, 40)]));
    executor.replaceDocument(document);
  });

  it("undoes and redoes front and back as individual edits", () => {
    assert.equal(new FrontCommand("first").execute(executor), "rect#first brought to front");
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["second", "node", "first"]);
    executor.undo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["first", "second", "node"]);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.equal(new BackCommand("first").execute(executor), "rect#first sent to back");
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["first", "second", "node"]);
    executor.undo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["second", "node", "first"]);
  });

  it("queries canvas size without consuming redo", () => {
    new FrontCommand("first").execute(executor);
    executor.undo();

    assert.equal(new CanvasCommand(session).execute(executor), "canvas 400x300");
    executor.redo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["second", "node", "first"]);
  });

  it("preserves the tree on resize and starts later edit history at the new size", () => {
    new FrontCommand("first").execute(executor);
    executor.undo();
    const before = session.getDocument().getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe()));

    assert.equal(new CanvasCommand(session, 640, 480).execute(executor), "canvas resized to 640x480");
    let current = session.getDocument();
    assert.deepEqual(current.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())), before);
    assert.equal(current.getParent("nested")?.id, "node");
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    new FrontCommand("first").execute(executor);
    executor.undo();
    current = session.getDocument();
    assert.deepEqual([current.width, current.height], [640, 480]);
    assert.deepEqual(current.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())), before);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
  });

  it("retains current height with width only and creates a barrier even for the same size", () => {
    assert.equal(new CanvasCommand(session, 700).execute(executor), "canvas resized to 700x300");
    new FrontCommand("first").execute(executor);
    new CanvasCommand(session, 700).execute(executor);

    assert.deepEqual([session.getDocument().width, session.getDocument().height], [700, 300]);
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
  });

  it("preserves document and redo when a reorder or resize fails", () => {
    new FrontCommand("first").execute(executor);
    executor.undo();
    const before = session.getDocument().getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe()));
    for (const command of [
      new FrontCommand("missing"), new BackCommand("missing"),
      new CanvasCommand(session, 0, 300), new CanvasCommand(session, 400, -1),
      new CanvasCommand(session, NaN, 300), new CanvasCommand(session, 400, Infinity),
    ]) {
      assert.throws(() => command.execute(executor), { name: "DomainError" });
      const current = session.getDocument();
      assert.deepEqual([current.width, current.height], [400, 300]);
      assert.deepEqual(current.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())), before);
    }
    executor.redo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["second", "node", "first"]);
  });

  it("requires a document for all layout operations", () => {
    const emptySession = new EditorSession();
    const emptyExecutor = new CommandExecutor(emptySession);
    for (const command of [
      new FrontCommand("first"), new BackCommand("first"),
      new CanvasCommand(emptySession), new CanvasCommand(emptySession, 100, 200),
    ]) {
      assert.throws(() => command.execute(emptyExecutor), { message: "no document. use 'init' or 'read' first" });
    }
  });

  it("records an already-backmost reorder as a new successful edit", () => {
    new FrontCommand("first").execute(executor);
    executor.undo();
    new BackCommand("first").execute(executor);

    assert.throws(() => executor.redo(), { message: "nothing to redo" });
    executor.undo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["first", "second", "node"]);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
  });
});

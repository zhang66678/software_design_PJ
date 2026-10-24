import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { MoveCommand } from "../../src/application/commands/MoveCommand.js";
import { ReadCommand } from "../../src/application/commands/ReadCommand.js";
import { SaveCommand } from "../../src/application/commands/SaveCommand.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { TestSvgStorage } from "../support/TestSvgStorage.js";
import { UnclonableRect } from "../support/UnclonableRect.js";

describe("ReadCommand", () => {
  let session: EditorSession;
  let executor: CommandExecutor;
  let storage: TestSvgStorage;
  let imported: SvgDocument;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    storage = new TestSvgStorage();
    imported = new SvgDocument(400, 300);
    imported.add(new Group("scene", [new Rect("rect1", 10, 20, 30, 40)]));
    storage.reads.set("图 表.svg", { document: imported, warnings: ["warning: assigned id rect1 to unnamed <rect>"] });
  });

  it("initializes a session, reports warnings and element count, and supplies save's path", () => {
    assert.equal(new ReadCommand(storage, "图 表.svg").execute(executor),
      "warning: assigned id rect1 to unnamed <rect>\nread 图 表.svg (2 elements)");
    assert.equal(session.getDocument().width, 400);
    assert.equal(session.getDocument().getParent("rect1")?.id, "scene");
    assert.equal(session.filePath, "图 表.svg");
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    new MoveCommand("rect1", 5, 0).execute(executor);
    executor.undo();
    assert.equal(session.getDocument().getShape("rect1").describe().attributes.x, 10);
    executor.redo();
    new SaveCommand(session, storage).execute(executor);
    assert.equal(storage.writes[0]?.filePath, "图 表.svg");
    assert.equal(storage.writes[0]?.document.getShape("rect1").describe().attributes.x, 15);
    assert.equal(imported.getShape("rect1").describe().attributes.x, 10);
  });

  it("replaces an existing document and blocks access to its old undo and redo history", () => {
    const previous = new SvgDocument();
    previous.add(new Rect("old", 1, 2, 3, 4));
    executor.replaceDocument(previous, "previous.svg");
    new MoveCommand("old", 10, 0).execute(executor);
    executor.undo();
    new ReadCommand(storage, "图 表.svg").execute(executor);

    assert.throws(() => session.getDocument().getShape("old"), { message: "no such shape: old" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    new MoveCommand("rect1", 5, 0).execute(executor);
    executor.undo();
    assert.equal(session.getDocument().width, 400);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
  });

  it("preserves the document, path, redo and barrier when reading or snapshot creation fails", () => {
    executor.replaceDocument(imported, "previous.svg");
    new MoveCommand("rect1", 5, 0).execute(executor);
    executor.undo();
    const broken = new SvgDocument();
    broken.add(new UnclonableRect("broken", 0, 0, 1, 1));
    storage.reads.set("broken.svg", { document: broken, warnings: ["must not escape"] });
    for (const path of ["missing.svg", "", "   ", "broken.svg"]) {
      assert.throws(() => new ReadCommand(storage, path).execute(executor));
      assert.equal(session.filePath, "previous.svg");
      assert.equal(session.getDocument().getParent("rect1")?.id, "scene");
      assert.equal(session.getDocument().getShape("rect1").describe().attributes.x, 10);
    }
    executor.redo();
    assert.equal(session.getDocument().getShape("rect1").describe().attributes.x, 15);
    new ReadCommand(storage, "图 表.svg").execute(executor);
    assert.throws(() => new ReadCommand(storage, "missing.svg").execute(executor));
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
  });

  it("leaves a new session uninitialized after a failed read", () => {
    assert.throws(() => new ReadCommand(storage, "missing.svg").execute(executor),
      { message: "cannot read file: missing.svg" });
    assert.equal(session.filePath, undefined);
    assert.throws(() => session.getDocument(), { message: "no document. use 'init' or 'read' first" });
  });
});

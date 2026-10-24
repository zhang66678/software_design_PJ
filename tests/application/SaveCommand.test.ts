import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CanvasCommand } from "../../src/application/commands/CanvasCommand.js";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { InitCommand } from "../../src/application/commands/InitCommand.js";
import { MoveCommand } from "../../src/application/commands/MoveCommand.js";
import { SaveCommand } from "../../src/application/commands/SaveCommand.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Text } from "../../src/domain/shapes/Text.js";
import { TestSvgStorage } from "../support/TestSvgStorage.js";

describe("SaveCommand", () => {
  let session: EditorSession;
  let executor: CommandExecutor;
  let storage: TestSvgStorage;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    storage = new TestSvgStorage();
    const document = new SvgDocument(400, 300);
    document.add(new Group("scene", [new Rect("r1", 10, 20, 30, 40), new Text("label", 10, 40, "开始"), new Group("empty")]));
    document.add(new Circle("c1", 100, 100, 20));
    executor.replaceDocument(document);
  });

  it("saves the whole tree, counts containers and remembers a path only on success", () => {
    const before = session.getDocument();
    assert.equal(new SaveCommand(session, storage, "图 表.svg").execute(executor), "saved to 图 表.svg (5 elements)");

    assert.equal(session.filePath, "图 表.svg");
    assert.equal(storage.writes[0]?.filePath, "图 表.svg");
    assert.deepEqual(storage.writes[0]?.document.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())),
      before.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())));
    assert.equal(session.getDocument().getParent("label")?.id, "scene");
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
  });

  it("rejects absent and blank paths without consuming redo or writing anything", () => {
    assert.throws(() => new SaveCommand(session, storage).execute(executor), { name: "ApplicationError" });
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    new MoveCommand("r1", 5, 0).execute(executor);
    executor.undo();
    for (const filePath of [undefined, "", "   "]) {
      assert.throws(() => new SaveCommand(session, storage, filePath).execute(executor), { name: "ApplicationError" });
    }
    assert.equal(session.filePath, undefined);
    assert.equal(storage.writes.length, 0);
    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
  });

  it("preserves the old path, document and redo when storage fails", () => {
    new SaveCommand(session, storage, "original.svg").execute(executor);
    new MoveCommand("r1", 5, 0).execute(executor);
    executor.undo();
    storage.failWrites = true;

    assert.throws(() => new SaveCommand(session, storage, "other.svg").execute(executor), { message: "cannot write file: other.svg" });
    assert.equal(session.filePath, "original.svg");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    executor.redo();
    storage.failWrites = false;
    new SaveCommand(session, storage).execute(executor);
    assert.equal(storage.writes[1]?.filePath, "original.svg");
    assert.equal(storage.writes[1]?.document.getShape("r1").describe().attributes.x, 15);
  });

  it("retains the path through resize and edits, clears it on init, and preserves it on failed init", () => {
    new SaveCommand(session, storage, "original.svg").execute(executor);
    new CanvasCommand(session, 800, 600).execute(executor);
    assert.equal(session.filePath, "original.svg");
    new SaveCommand(session, storage).execute(executor);
    assert.equal(storage.writes[1]?.document.width, 800);
    assert.equal(storage.writes[1]?.document.height, 600);
    new MoveCommand("r1", 5, 0).execute(executor);
    executor.undo();
    assert.equal(session.filePath, "original.svg");
    assert.throws(() => new InitCommand(0, 600).execute(executor), { name: "DomainError" });
    assert.equal(session.filePath, "original.svg");
    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
    new InitCommand().execute(executor);
    assert.equal(session.filePath, undefined);
    assert.throws(() => new SaveCommand(session, storage).execute(executor), { message: "no file path. use 'save <file.svg>' first" });
  });

  it("requires an initialized document before saving", () => {
    const emptySession = new EditorSession();
    assert.throws(() => new SaveCommand(emptySession, storage, "out.svg").execute(new CommandExecutor(emptySession)),
      { message: "no document. use 'init' or 'read' first" });
    assert.equal(storage.writes.length, 0);
  });
});

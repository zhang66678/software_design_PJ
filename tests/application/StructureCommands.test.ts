import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { AddToCommand } from "../../src/application/commands/AddToCommand.js";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { DeleteCommand } from "../../src/application/commands/DeleteCommand.js";
import { GroupCommand } from "../../src/application/commands/GroupCommand.js";
import { UngroupCommand } from "../../src/application/commands/UngroupCommand.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";

describe("Structure commands", () => {
  let session: EditorSession;
  let executor: CommandExecutor;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    const document = new SvgDocument();
    document.add(new Rect("before", 0, 0, 1, 1));
    document.add(new Group("source", [
      new Rect("left", 0, 0, 1, 1),
      new Group("node", [
        new Rect("r1", 10, 20, 30, 40, new Style({ fill: "red" })),
        new Text("label", 10, 40, "开始"),
      ], new Style({ stroke: "black" })),
      new Rect("right", 0, 0, 1, 1),
    ]));
    document.add(new Group("target", [new Rect("existing", 0, 0, 1, 1)]));
    document.add(new Rect("after", 0, 0, 1, 1));
    executor.replaceDocument(document);
  });

  for (const id of ["r1", "source"]) {
    it(`deletes ${id} and restores its complete subtree and position as one undo unit`, () => {
      const before = session.getDocument();
      const removedIds = [...before.getShape(id).walk()].map((shape) => shape.id);
      assert.equal(new DeleteCommand(id).execute(executor), `${before.getShape(id).type}#${id} deleted`);
      for (const removedId of removedIds) {
        assert.throws(() => session.getDocument().getShape(removedId), { message: `no such shape: ${removedId}` });
      }

      executor.undo();
      const restored = session.getDocument();
      assert.deepEqual(restored.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())),
        before.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())));
      for (const removedId of removedIds) {
        assert.equal(restored.getParent(removedId)?.id, before.getParent(removedId)?.id);
      }
      assert.throws(() => executor.undo(), { message: "nothing to undo" });
      executor.redo();
      assert.throws(() => session.getDocument().getShape(id), { message: `no such shape: ${id}` });
    });
  }

  it("moves a styled subtree and restores the original parent and order with undo", () => {
    const expected = [...session.getDocument().getShape("node").walk()].map((shape) => shape.describe());
    assert.equal(new AddToCommand("target", "node").execute(executor), "g#node added to g#target");
    let current = session.getDocument();
    assert.deepEqual(current.getShape("source").getChildren().map((shape) => shape.id), ["left", "right"]);
    assert.deepEqual(current.getShape("target").getChildren().map((shape) => shape.id), ["existing", "node"]);
    assert.deepEqual([...current.getShape("node").walk()].map((shape) => shape.describe()), expected);

    executor.undo();
    current = session.getDocument();
    assert.deepEqual(current.getShape("source").getChildren().map((shape) => shape.id), ["left", "node", "right"]);
    assert.deepEqual(current.getShape("target").getChildren().map((shape) => shape.id), ["existing"]);
    assert.deepEqual([...current.getShape("node").walk()].map((shape) => shape.describe()), expected);
    executor.redo();
    assert.equal(session.getDocument().getParent("node")?.id, "target");
    assert.equal(session.getDocument().getParent("r1")?.id, "node");
  });

  it("requires an initialized document for structure commands", () => {
    const emptyExecutor = new CommandExecutor(new EditorSession());
    for (const command of [
      new DeleteCommand("missing"), new AddToCommand("target", "node"),
      new GroupCommand("bundle", ["node"]), new UngroupCommand("node"),
    ]) {
      assert.throws(() => command.execute(emptyExecutor), { message: "no document. use 'init' or 'read' first" });
    }
  });

  it("preserves redo after failed operations and clears it after a new successful edit", () => {
    new AddToCommand("target", "node").execute(executor);
    executor.undo();
    const before = session.getDocument().getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe()));
    for (const command of [
      new DeleteCommand("missing"),
      new AddToCommand("missing", "node"),
      new AddToCommand("r1", "node"),
      new AddToCommand("target", "missing"),
      new AddToCommand("node", "node"),
      new AddToCommand("node", "source"),
      new GroupCommand("bundle", ["r1", "node"]),
      new GroupCommand("source", ["node"]),
      new UngroupCommand("source"),
      new UngroupCommand("r1"),
      new UngroupCommand("missing"),
    ]) {
      assert.throws(() => command.execute(executor), { name: "DomainError" });
      assert.deepEqual(session.getDocument().getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())), before);
    }
    executor.redo();
    assert.equal(session.getDocument().getParent("node")?.id, "target");
    executor.undo();
    new DeleteCommand("node").execute(executor);
    assert.throws(() => executor.redo(), { message: "nothing to redo" });
    executor.undo();
    assert.equal(session.getDocument().getParent("node")?.id, "source");
  });

  it("keeps the history barrier when structure commands fail", () => {
    for (const command of [
      new DeleteCommand("missing"), new AddToCommand("node", "source"),
      new GroupCommand("source", ["node"]), new UngroupCommand("source"),
    ]) {
      assert.throws(() => command.execute(executor), { name: "DomainError" });
      assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
      assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    }
  });

  it("captures group arguments and restores selections from multiple parents in one undo", () => {
    const before = session.getDocument();
    const ids = ["existing", "node"];
    const command = new GroupCommand("bundle", ids);
    ids.length = 0;

    assert.equal(command.execute(executor), "g#bundle created with 2 children");
    const grouped = session.getDocument();
    assert.deepEqual(grouped.getShape("bundle").getChildren().map((shape) => shape.id), ["node", "existing"]);
    assert.deepEqual(grouped.getShape("source").getChildren().map((shape) => shape.id), ["left", "right"]);
    assert.deepEqual(grouped.getShape("target").getChildren(), []);
    executor.undo();
    const restored = session.getDocument();
    assert.deepEqual(restored.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())),
      before.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())));
    assert.equal(restored.getParent("node")?.id, "source");
    assert.equal(restored.getParent("existing")?.id, "target");
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.equal(session.getDocument().getParent("node")?.id, "bundle");
    assert.equal(session.getDocument().getShape("node").describe().attributes.stroke, "black");
  });

  it("undoes nested ungroup as a single edit including the removed group and its style", () => {
    assert.equal(new UngroupCommand("node").execute(executor), "g#node ungrouped with 2 children");
    assert.deepEqual(session.getDocument().getShape("source").getChildren().map((shape) => shape.id),
      ["left", "r1", "label", "right"]);
    assert.throws(() => session.getDocument().getShape("node"), { message: "no such shape: node" });
    executor.undo();
    const restored = session.getDocument();
    assert.deepEqual(restored.getShape("source").getChildren().map((shape) => shape.id), ["left", "node", "right"]);
    assert.equal(restored.getShape("node").describe().attributes.stroke, "black");
    assert.equal(restored.getParent("r1")?.id, "node");
    assert.equal(restored.getShape("r1").describe().attributes.fill, "red");
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.equal(session.getDocument().getParent("r1")?.id, "source");
  });
});

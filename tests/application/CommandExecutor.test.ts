import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { TestEditCommand } from "../support/TestEditCommand.js";
import { UnclonableRect } from "../support/UnclonableRect.js";

describe("CommandExecutor", () => {
  let session: EditorSession;
  let executor: CommandExecutor;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    const document = new SvgDocument(400, 300);
    document.add(new Rect("r1", 10, 20, 100, 50, new Style({ fill: "red" })));
    document.add(new Rect("r2", -5, 8, 20, 30));
    executor.replaceDocument(document);
  });

  it("rejects edits, undo, redo and barriers without a document", () => {
    const emptySession = new EditorSession();
    const emptyExecutor = new CommandExecutor(emptySession);
    let executed = false;
    const command = new TestEditCommand(() => {
      executed = true;
      return "unexpected edit";
    });

    for (const action of [
      () => emptyExecutor.execute(command),
      () => emptyExecutor.undo(),
      () => emptyExecutor.redo(),
      () => emptyExecutor.setHistoryBarrier(),
    ]) {
      assert.throws(action, {
        name: "ApplicationError",
        message: "no document. use 'init' or 'read' first",
      });
    }
    assert.equal(executed, false);
  });

  it("reports empty history without changing the document", () => {
    const emptyHistorySession = new EditorSession();
    emptyHistorySession.replaceDocument(new SvgDocument());
    const emptyHistoryExecutor = new CommandExecutor(emptyHistorySession);

    assert.throws(() => emptyHistoryExecutor.undo(), {
      name: "ApplicationError",
      message: "nothing to undo",
    });
    assert.throws(() => emptyHistoryExecutor.redo(), {
      name: "ApplicationError",
      message: "nothing to redo",
    });
    assert.equal(emptyHistorySession.getDocument().getShapes().length, 0);
  });

  it("returns feedback and restores geometry and style through undo and redo", () => {
    const result = executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, -5);
      return "rect#r1 moved to (40,15)";
    }));

    assert.equal(result, "rect#r1 moved to (40,15)");
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 40, y: 15, width: 100, height: 50, fill: "red",
    });
    assert.equal(executor.undo(), "undone: rect#r1 moved to (40,15)");
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 10, y: 20, width: 100, height: 50, fill: "red",
    });
    assert.equal(executor.redo(), "redone: rect#r1 moved to (40,15)");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.ok(session.getDocument().getShape("r1") instanceof Rect);
  });

  it("undoes and redoes multiple edits in the correct order", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "first move";
    }));
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r2").move(0, 12);
      return "second move";
    }));

    assert.equal(executor.undo(), "undone: second move");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.equal(session.getDocument().getShape("r2").describe().attributes.y, 8);
    assert.equal(executor.undo(), "undone: first move");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });

    assert.equal(executor.redo(), "redone: first move");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.equal(executor.redo(), "redone: second move");
    assert.equal(session.getDocument().getShape("r2").describe().attributes.y, 20);
    assert.throws(() => executor.redo(), { message: "nothing to redo" });
  });

  it("treats changes to several shapes and the root list as one undo unit", () => {
    const before = session.getDocument().getShapes().map((shape) => shape.describe());
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      document.getShape("r2").move(0, 12);
      document.add(new Rect("r3", 1, 2, 3, 4));
      return "batch edit";
    }));
    const after = session.getDocument().getShapes().map((shape) => shape.describe());

    executor.undo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.describe()), before);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.describe()), after);
  });

  it("discards earlier candidate mutations when a later operation fails", () => {
    const before = session.getDocument().getShapes().map((shape) => shape.describe());

    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      document.add(new Rect("r3", 0, 0, 10, 10));
      document.add(new Rect("r2", 99, 99, 1, 1));
      return "unreachable";
    })), { name: "DomainError", message: "id already exists: r2" });

    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.describe()), before);
    assert.deepEqual([session.getDocument().width, session.getDocument().height], [400, 300]);
  });

  it("preserves the document when an unexpected error follows a mutation", () => {
    const before = session.getDocument().getShapes().map((shape) => shape.describe());
    const failure = new Error("unexpected command failure");

    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      throw failure;
    })), (error: unknown) => error === failure);

    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.describe()), before);
  });

  it("does not add failed commands to undo history", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "successful edit";
    }));
    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r2").move(20, 0);
      document.getShape("missing");
      return "unreachable";
    })), { message: "no such shape: missing" });

    assert.equal(executor.undo(), "undone: successful edit");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(session.getDocument().getShape("r2").describe().attributes.x, -5);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
  });

  it("preserves redo after a failed edit has already changed its candidate", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "successful edit";
    }));
    executor.undo();

    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(99, 99);
      document.add(new Rect("r1", 0, 0, 1, 1));
      return "unreachable";
    })), { message: "id already exists: r1" });

    assert.equal(executor.redo(), "redone: successful edit");
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 40, y: 20, width: 100, height: 50, fill: "red",
    });
  });

  it("clears redo only after a new edit succeeds", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "old branch";
    }));
    executor.undo();
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(5, 0);
      return "new branch";
    }));

    assert.throws(() => executor.redo(), { message: "nothing to redo" });
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
    assert.equal(executor.undo(), "undone: new branch");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(executor.redo(), "redone: new branch");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
  });

  it("counts a successful zero-distance move as a new edit", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "old branch";
    }));
    executor.undo();
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(0, 0);
      return "zero-distance move";
    }));

    assert.throws(() => executor.redo(), { message: "nothing to redo" });
    assert.equal(executor.undo(), "undone: zero-distance move");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(executor.redo(), "redone: zero-distance move");
  });

  it("replays saved results without executing the same command object again", () => {
    let executions = 0;
    const command = new TestEditCommand((document) => {
      executions += 1;
      document.getShape("r1").move(executions, 0);
      return `move ${executions}`;
    });
    executor.execute(command);
    executor.execute(command);

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 13);
    assert.equal(executor.undo(), "undone: move 2");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 11);
    assert.equal(executor.undo(), "undone: move 1");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(executor.redo(), "redone: move 1");
    assert.equal(executor.redo(), "redone: move 2");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 13);
    assert.equal(executions, 2);
  });

  it("isolates committed state and history from references retained by a command", () => {
    const candidates: SvgDocument[] = [];
    executor.execute(new TestEditCommand((document) => {
      candidates.push(document);
      document.getShape("r1").move(30, 0);
      return "move";
    }));
    const retained = candidates[0];
    assert.ok(retained);

    retained.getShape("r1").move(99, 99);
    retained.add(new Rect("leaked", 0, 0, 1, 1));

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.equal(session.getDocument().getShapes().length, 2);
    executor.undo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.equal(session.getDocument().getShapes().length, 2);
  });

  it("keeps redo and history unchanged when reading or modifying read copies", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "move";
    }));
    executor.undo();

    const readCopy = session.getDocument();
    readCopy.getShape("r1").move(99, 99);
    readCopy.add(new Rect("local", 0, 0, 1, 1));

    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.equal(session.getDocument().getShapes().length, 2);
    executor.undo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
  });

  it("blocks undo and redo immediately after document replacement", () => {
    assert.throws(() => executor.undo(), {
      name: "ApplicationError", message: "undo not allowed after io command",
    });
    assert.throws(() => executor.redo(), {
      name: "ApplicationError", message: "undo not allowed after io command",
    });
  });

  it("does not lift a barrier through reads or failed edits", () => {
    session.getDocument().getShape("r1").describe();
    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      document.getShape("missing");
      return "unreachable";
    })), { message: "no such shape: missing" });

    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
  });

  it("clears both stacks at a barrier and starts new history from that document", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "first move";
    }));
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(20, 0);
      return "old redo";
    }));
    executor.undo();
    executor.setHistoryBarrier();

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });

    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(5, 0);
      return "new history";
    }));
    assert.throws(() => executor.redo(), { message: "nothing to redo" });
    executor.undo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 45);
  });

  it("discards old undo and redo records when replacing an edited document", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "old edit";
    }));
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r2").move(0, 12);
      return "old redo";
    }));
    executor.undo();
    executor.replaceDocument(new SvgDocument(900, 700));

    assert.throws(() => executor.undo(), { message: "undo not allowed after io command" });
    assert.throws(() => executor.redo(), { message: "undo not allowed after io command" });
    executor.execute(new TestEditCommand((document) => {
      document.add(new Rect("new", 1, 2, 3, 4));
      return "new document edit";
    }));
    executor.undo();

    const restored = session.getDocument();
    assert.deepEqual([restored.width, restored.height], [900, 700]);
    assert.equal(restored.getShapes().length, 0);
    assert.throws(() => executor.undo(), { message: "nothing to undo" });
    executor.redo();
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["new"]);
  });

  it("preserves the current document and redo if capturing an edit result fails", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "successful edit";
    }));
    executor.undo();

    assert.throws(() => executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(99, 0);
      document.add(new UnclonableRect("broken", 0, 0, 1, 1));
      return "cannot capture this result";
    })), { message: "cannot clone test rectangle" });

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(session.getDocument().getShapes().length, 2);
    executor.redo();
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });

  it("keeps the current document and redo when replacement cannot be captured", () => {
    executor.execute(new TestEditCommand((document) => {
      document.getShape("r1").move(30, 0);
      return "successful edit";
    }));
    executor.undo();
    const invalid = new SvgDocument(900, 700);
    invalid.add(new UnclonableRect("broken", 0, 0, 1, 1));

    assert.throws(() => executor.replaceDocument(invalid), { message: "cannot clone test rectangle" });

    const current = session.getDocument();
    assert.deepEqual([current.width, current.height], [400, 300]);
    assert.deepEqual(current.getShapes().map((shape) => shape.id), ["r1", "r2"]);
    assert.equal(current.getShape("r1").describe().attributes.x, 10);
    assert.equal(executor.redo(), "redone: successful edit");
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });
});

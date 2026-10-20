import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import type { Command } from "../../src/application/commands/Command.js";
import { CommandExecutor } from "../../src/application/commands/CommandExecutor.js";
import { CreateCommand } from "../../src/application/commands/CreateCommand.js";
import { InitCommand } from "../../src/application/commands/InitCommand.js";
import { MoveCommand } from "../../src/application/commands/MoveCommand.js";
import { RedoCommand } from "../../src/application/commands/RedoCommand.js";
import { UndoCommand } from "../../src/application/commands/UndoCommand.js";
import { ShapeFactory } from "../../src/application/factories/ShapeFactory.js";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

describe("Editing commands", () => {
  let session: EditorSession;
  let executor: CommandExecutor;
  let factory: ShapeFactory;

  beforeEach(() => {
    session = new EditorSession();
    executor = new CommandExecutor(session);
    factory = new ShapeFactory();
  });

  it("runs init, create, move, undo and redo through the common command interface", () => {
    const commands: readonly Command[] = [
      new InitCommand(800, 600),
      new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50", "#4a90d9"]),
      new MoveCommand("r1", 30, 0),
      new UndoCommand(),
      new RedoCommand(),
    ];
    const outputs: string[] = [];
    const positions: (string | number | undefined)[] = [];
    for (const command of commands) {
      outputs.push(command.execute(executor));
      positions.push(session.getDocument().getShapes()[0]?.describe().attributes.x);
    }

    assert.deepEqual(outputs, [
      "canvas 800x600 created",
      "rect#r1 created",
      "rect#r1 moved by (30,0)",
      "undone: rect#r1 moved by (30,0)",
      "redone: rect#r1 moved by (30,0)",
    ]);
    assert.deepEqual(positions, [undefined, 10, 40, 10, 40]);
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 40, y: 20, width: 100, height: 50, fill: "#4a90d9",
    });
  });

  for (const { command, width, height } of [
    { command: new InitCommand(), width: 800, height: 600 },
    { command: new InitCommand(320), width: 320, height: 600 },
    { command: new InitCommand(400.5, 300.25), width: 400.5, height: 300.25 },
  ]) {
    it(`initializes an empty ${width} by ${height} document with a history barrier`, () => {
      assert.equal(command.execute(executor), `canvas ${width}x${height} created`);

      const document = session.getDocument();
      assert.deepEqual([document.width, document.height], [width, height]);
      assert.deepEqual(document.getShapes(), []);
      assert.throws(() => new UndoCommand().execute(executor), {
        message: "undo not allowed after io command",
      });
      assert.throws(() => new RedoCommand().execute(executor), {
        message: "undo not allowed after io command",
      });
    });
  }

  it("reinitializes an edited document and discards both old history branches", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new CreateCommand(factory, "rect", "r2", ["0", "0", "20", "30"]).execute(executor);
    new UndoCommand().execute(executor);

    assert.equal(new InitCommand(400, 300).execute(executor), "canvas 400x300 created");
    assert.equal(session.getDocument().getShapes().length, 0);
    assert.throws(() => new UndoCommand().execute(executor), {
      message: "undo not allowed after io command",
    });
    assert.throws(() => new RedoCommand().execute(executor), {
      message: "undo not allowed after io command",
    });

    new CreateCommand(factory, "rect", "r1", ["1", "2", "3", "4"]).execute(executor);
    new UndoCommand().execute(executor);
    assert.deepEqual([session.getDocument().width, session.getDocument().height], [400, 300]);
    assert.equal(session.getDocument().getShapes().length, 0);
    assert.throws(() => new UndoCommand().execute(executor), { message: "nothing to undo" });
    new RedoCommand().execute(executor);
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 1, y: 2, width: 3, height: 4,
    });
  });

  for (const { width, height } of [
    { width: 0, height: 300 },
    { width: 400, height: -1 },
    { width: NaN, height: 300 },
  ]) {
    it(`preserves document and redo after invalid init (${width}, ${height})`, () => {
      new InitCommand(400, 300).execute(executor);
      new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
      new MoveCommand("r1", 30, 0).execute(executor);
      new UndoCommand().execute(executor);

      assert.throws(() => new InitCommand(width, height).execute(executor), {
        name: "DomainError",
        message: "canvas dimensions must be positive finite numbers",
      });

      assert.deepEqual([session.getDocument().width, session.getDocument().height], [400, 300]);
      assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
      new RedoCommand().execute(executor);
      assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    });
  }

  it("does not create a document when initial dimensions are invalid", () => {
    assert.throws(() => new InitCommand(-1, 600).execute(executor), { name: "DomainError" });
    assert.throws(() => session.getDocument(), {
      message: "no document. use 'init' or 'read' first",
    });
  });

  for (const kind of ["create", "move", "undo", "redo"] as const) {
    it(`rejects ${kind} before a document exists`, () => {
      const commands: Readonly<Record<typeof kind, Command>> = {
        create: new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]),
        move: new MoveCommand("r1", 30, 0),
        undo: new UndoCommand(),
        redo: new RedoCommand(),
      };

      assert.throws(() => commands[kind].execute(executor), {
        name: "ApplicationError",
        message: "no document. use 'init' or 'read' first",
      });
    });
  }

  it("captures create arguments and restores creation as a complete undo unit", () => {
    new InitCommand().execute(executor);
    const parameters = ["10", "20", "100", "50", "red"];
    const command = new CreateCommand(factory, "rect", "r1", parameters);
    parameters[0] = "999";
    parameters[4] = "blue";
    parameters.push("unexpected");

    assert.equal(command.execute(executor), "rect#r1 created");
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 10, y: 20, width: 100, height: 50, fill: "red",
    });
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShapes().length, 0);
    new RedoCommand().execute(executor);
    assert.ok(session.getDocument().getShape("r1") instanceof Rect);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.fill, "red");
  });

  it("preserves creation order and case-sensitive ids", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new CreateCommand(factory, "rect", "R1", ["30", "40", "20", "10"]).execute(executor);

    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1", "R1"]);
    new UndoCommand().execute(executor);
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1"]);
    new RedoCommand().execute(executor);
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1", "R1"]);
  });

  it("preserves the original rectangle and redo after duplicate-id creation fails", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50", "red"]).execute(executor);
    new MoveCommand("r1", 30, 0).execute(executor);
    new UndoCommand().execute(executor);

    assert.throws(() => new CreateCommand(
      factory, "rect", "r1", ["999", "999", "1", "1", "blue"],
    ).execute(executor), { name: "DomainError", message: "id already exists: r1" });

    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: 10, y: 20, width: 100, height: 50, fill: "red",
    });
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
    new UndoCommand().execute(executor);
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShapes().length, 0);
  });

  it("preserves redo after an unknown shape type fails", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new UndoCommand().execute(executor);

    assert.throws(() => new CreateCommand(factory, "box", "b1", []).execute(executor), {
      name: "ApplicationError",
      message: "unknown shape type: box (is the plugin loaded?)",
    });

    assert.equal(session.getDocument().getShapes().length, 0);
    new RedoCommand().execute(executor);
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1"]);
  });

  it("keeps the history barrier when creation fails validation", () => {
    new InitCommand().execute(executor);
    const invalidCommands = [
      new CreateCommand(factory, "rect", "r1", ["10", "20", "100"]),
      new CreateCommand(factory, "rect", "r1", ["", "20", "100", "50"]),
      new CreateCommand(factory, "rect", "r1", ["10", "20", "-1", "50"]),
      new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50", ""]),
      new CreateCommand(factory, "rect", "", ["10", "20", "100", "50"]),
      new CreateCommand(factory, "rect", "two words", ["10", "20", "100", "50"]),
    ];

    for (const command of invalidCommands) {
      assert.throws(() => command.execute(executor));
      assert.equal(session.getDocument().getShapes().length, 0);
      assert.throws(() => new UndoCommand().execute(executor), {
        message: "undo not allowed after io command",
      });
      assert.throws(() => new RedoCommand().execute(executor), {
        message: "undo not allowed after io command",
      });
    }

    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShapes().length, 0);
    assert.throws(() => new UndoCommand().execute(executor), { message: "nothing to undo" });
  });

  it("moves by fractional negative offsets without changing dimensions or styles", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50", "red"]).execute(executor);

    assert.equal(new MoveCommand("r1", -15.5, 0.25).execute(executor),
      "rect#r1 moved by (-15.5,0.25)");
    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: -5.5, y: 20.25, width: 100, height: 50, fill: "red",
    });
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, -5.5);
  });

  it("preserves redo after moving a missing shape fails", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new MoveCommand("r1", 30, 0).execute(executor);
    new UndoCommand().execute(executor);

    assert.throws(() => new MoveCommand("r9", 30, 0).execute(executor), {
      name: "DomainError", message: "no such shape: r9",
    });

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });

  it("preserves geometry and redo when move offsets are not finite", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new MoveCommand("r1", 30, 0).execute(executor);
    new UndoCommand().execute(executor);

    for (const { dx, dy } of [
      { dx: NaN, dy: 0 },
      { dx: Infinity, dy: 0 },
      { dx: 1, dy: -Infinity },
    ]) {
      assert.throws(() => new MoveCommand("r1", dx, dy).execute(executor), {
        name: "ApplicationError", message: "move offsets must be finite numbers",
      });
      assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
        x: 10, y: 20, width: 100, height: 50,
      });
    }

    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 40);
  });

  it("preserves both coordinates and redo when a finite move overflows", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", [String(Number.MAX_VALUE), "20", "100", "50"])
      .execute(executor);
    new MoveCommand("r1", -Number.MAX_VALUE, 0).execute(executor);
    new UndoCommand().execute(executor);

    assert.throws(() => new MoveCommand("r1", Number.MAX_VALUE, 1).execute(executor), {
      name: "DomainError", message: "rectangle geometry must be finite",
    });

    assert.deepEqual(session.getDocument().getShape("r1").describe().attributes, {
      x: Number.MAX_VALUE, y: 20, width: 100, height: 50,
    });
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 0);
  });

  it("reuses a create command after undo and clears the old redo branch", () => {
    new InitCommand().execute(executor);
    const command = new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]);
    command.execute(executor);
    new UndoCommand().execute(executor);

    command.execute(executor);

    assert.throws(() => new RedoCommand().execute(executor), { message: "nothing to redo" });
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1"]);
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShapes().length, 0);
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
  });

  it("starts a new move branch after undo while keeping earlier creation undoable", () => {
    new InitCommand().execute(executor);
    new CreateCommand(factory, "rect", "r1", ["10", "20", "100", "50"]).execute(executor);
    new MoveCommand("r1", 30, 0).execute(executor);
    new UndoCommand().execute(executor);

    new MoveCommand("r1", 5, 0).execute(executor);

    assert.throws(() => new RedoCommand().execute(executor), { message: "nothing to redo" });
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    new UndoCommand().execute(executor);
    assert.equal(session.getDocument().getShapes().length, 0);
    new RedoCommand().execute(executor);
    new RedoCommand().execute(executor);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 15);
  });
});

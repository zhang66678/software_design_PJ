import { CommandArguments } from "../../application/arguments/CommandArguments.js";
import { AddToCommand } from "../../application/commands/AddToCommand.js";
import { BackCommand } from "../../application/commands/BackCommand.js";
import { CanvasCommand } from "../../application/commands/CanvasCommand.js";
import type { Command } from "../../application/commands/Command.js";
import { CreateCommand } from "../../application/commands/CreateCommand.js";
import { DeleteCommand } from "../../application/commands/DeleteCommand.js";
import { FrontCommand } from "../../application/commands/FrontCommand.js";
import { GroupCommand } from "../../application/commands/GroupCommand.js";
import { InitCommand } from "../../application/commands/InitCommand.js";
import { MoveCommand } from "../../application/commands/MoveCommand.js";
import { ReadCommand } from "../../application/commands/ReadCommand.js";
import { RedoCommand } from "../../application/commands/RedoCommand.js";
import { ScaleCommand } from "../../application/commands/ScaleCommand.js";
import { SaveCommand } from "../../application/commands/SaveCommand.js";
import { SetCommand } from "../../application/commands/SetCommand.js";
import { UndoCommand } from "../../application/commands/UndoCommand.js";
import { UngroupCommand } from "../../application/commands/UngroupCommand.js";
import type { ShapeFactory } from "../../application/factories/ShapeFactory.js";
import type { SvgStorage } from "../../application/ports/SvgStorage.js";
import type { EditorSession } from "../../application/session/EditorSession.js";
import { HelpCommand } from "../commands/HelpCommand.js";
import { ShowCommand } from "../commands/ShowCommand.js";
import { TreeCommand } from "../commands/TreeCommand.js";
import { PresentationError } from "../errors/PresentationError.js";
import type { DocumentFormatter } from "../formatters/DocumentFormatter.js";

interface CommandDefinition {
  readonly syntax: string;
  readonly create: (args: CommandArguments, syntax: string) => Command;
}

export class CommandRegistry {
  // Refactoring point: command-name dispatch is confined to this registry.
  readonly #definitions: ReadonlyMap<string, CommandDefinition>;

  public constructor(
    factory: ShapeFactory,
    session: EditorSession,
    formatter: DocumentFormatter,
    storage: SvgStorage,
  ) {
    this.#definitions = new Map<string, CommandDefinition>([
      ["init", {
        syntax: "init [w] [h]",
        create: (args, syntax) => {
          args.expectCount(0, 2, syntax);
          const width = args.optionalAt(0) === undefined ? undefined : args.numberAt(0, "width");
          const height = args.optionalAt(1) === undefined ? undefined : args.numberAt(1, "height");
          return new InitCommand(width, height);
        },
      }],
      ["canvas", {
        syntax: "canvas [w] [h]",
        create: (args, syntax) => {
          args.expectCount(0, 2, syntax);
          const width = args.optionalAt(0) === undefined ? undefined : args.numberAt(0, "width");
          const height = args.optionalAt(1) === undefined ? undefined : args.numberAt(1, "height");
          return new CanvasCommand(session, width, height);
        },
      }],
      ["read", {
        syntax: "read <file.svg>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new ReadCommand(storage, args.stringAt(0, "file path"));
        },
      }],
      ["save", {
        syntax: "save [file.svg]",
        create: (args, syntax) => {
          args.expectCount(0, 1, syntax);
          return new SaveCommand(session, storage, args.optionalAt(0));
        },
      }],
      ["create", {
        syntax: "create <type> <id> [params...] [in <containerId>]",
        create: (args, syntax) => {
          args.expectCount(2, Infinity, syntax);
          let parameters = args.slice(2);
          let containerId: string | undefined;
          if (parameters.at(-2) === "in") {
            containerId = parameters.at(-1);
            parameters = parameters.slice(0, -2);
          }
          return new CreateCommand(factory, args.stringAt(0, "type"), args.stringAt(1, "id"), parameters, containerId);
        },
      }],
      ["delete", {
        syntax: "delete <id>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new DeleteCommand(args.stringAt(0, "id"));
        },
      }],
      ["addto", {
        syntax: "addto <gid> <id>",
        create: (args, syntax) => {
          args.expectCount(2, 2, syntax);
          return new AddToCommand(args.stringAt(0, "container id"), args.stringAt(1, "id"));
        },
      }],
      ["group", {
        syntax: "group <newGid> <id1> <id2>...",
        create: (args, syntax) => {
          args.expectCount(2, Infinity, syntax);
          return new GroupCommand(args.stringAt(0, "new group id"), args.slice(1));
        },
      }],
      ["ungroup", {
        syntax: "ungroup <gid>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new UngroupCommand(args.stringAt(0, "group id"));
        },
      }],
      ["front", {
        syntax: "front <id>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new FrontCommand(args.stringAt(0, "id"));
        },
      }],
      ["back", {
        syntax: "back <id>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new BackCommand(args.stringAt(0, "id"));
        },
      }],
      ["move", {
        syntax: "move <id> <dx> <dy>",
        create: (args, syntax) => {
          args.expectCount(3, 3, syntax);
          return new MoveCommand(args.stringAt(0, "id"), args.numberAt(1, "dx"), args.numberAt(2, "dy"));
        },
      }],
      ["scale", {
        syntax: "scale <id> <factor>",
        create: (args, syntax) => {
          args.expectCount(2, 2, syntax);
          return new ScaleCommand(args.stringAt(0, "id"), args.numberAt(1, "factor"));
        },
      }],
      ["set", {
        syntax: "set <id> <attr> <value>",
        create: (args, syntax) => {
          args.expectCount(3, 3, syntax);
          return new SetCommand(args.stringAt(0, "id"), args.stringAt(1, "attribute"), args.stringAt(2, "value"));
        },
      }],
      ["tree", {
        syntax: "tree [id]",
        create: (args, syntax) => {
          args.expectCount(0, 1, syntax);
          return new TreeCommand(session, formatter, args.optionalAt(0));
        },
      }],
      ["show", {
        syntax: "show <id>",
        create: (args, syntax) => {
          args.expectCount(1, 1, syntax);
          return new ShowCommand(session, formatter, args.stringAt(0, "id"));
        },
      }],
      ["help", {
        syntax: "help",
        create: (args, syntax) => {
          args.expectCount(0, 0, syntax);
          return new HelpCommand(this);
        },
      }],
      ["undo", {
        syntax: "undo",
        create: (args, syntax) => {
          args.expectCount(0, 0, syntax);
          return new UndoCommand();
        },
      }],
      ["redo", {
        syntax: "redo",
        create: (args, syntax) => {
          args.expectCount(0, 0, syntax);
          return new RedoCommand();
        },
      }],
    ]);
  }

  public parse(tokens: readonly string[]): Command {
    const name = tokens[0];
    if (name === undefined) {
      throw new PresentationError("empty command");
    }
    const definition = this.#definitions.get(name);
    if (definition === undefined) {
      throw new PresentationError(`unknown command: ${name}`);
    }

    return definition.create(new CommandArguments(tokens.slice(1)), definition.syntax);
  }

  public help(): string {
    return [
      "Commands:",
      ...[...this.#definitions.values()].map((definition) => `  ${definition.syntax}`),
      "",
      "Shape creation:",
      "  create rect <id> <x> <y> <w> <h> [fill]",
      "  create circle <id> <cx> <cy> <r> [fill]",
      "  create ellipse <id> <cx> <cy> <rx> <ry> [fill]",
      "  create line <id> <x1> <y1> <x2> <y2> [stroke]",
      '  create text <id> <x> <y> "content"',
      "  create g <id>",
      "  All types support the suffix: in <containerId>",
    ].join("\n");
  }
}

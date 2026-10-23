import { CommandArguments } from "../../application/arguments/CommandArguments.js";
import type { Command } from "../../application/commands/Command.js";
import { CreateCommand } from "../../application/commands/CreateCommand.js";
import { InitCommand } from "../../application/commands/InitCommand.js";
import { MoveCommand } from "../../application/commands/MoveCommand.js";
import { RedoCommand } from "../../application/commands/RedoCommand.js";
import { ScaleCommand } from "../../application/commands/ScaleCommand.js";
import { SetCommand } from "../../application/commands/SetCommand.js";
import { UndoCommand } from "../../application/commands/UndoCommand.js";
import type { ShapeFactory } from "../../application/factories/ShapeFactory.js";
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

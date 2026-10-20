import { Command } from "../../application/commands/Command.js";
import type { CommandRegistry } from "../cli/CommandRegistry.js";

export class HelpCommand extends Command {
  readonly #registry: CommandRegistry;

  public constructor(registry: CommandRegistry) {
    super();
    this.#registry = registry;
  }

  public override execute(): string {
    return this.#registry.help();
  }
}

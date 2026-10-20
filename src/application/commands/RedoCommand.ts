import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export class RedoCommand extends Command {
  public override execute(executor: CommandExecutor): string {
    return executor.redo();
  }
}

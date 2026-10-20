import type { CommandExecutor } from "./CommandExecutor.js";

export abstract class Command {
  public abstract execute(executor: CommandExecutor): string;
}

import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export abstract class EditCommand extends Command {
  public override execute(executor: CommandExecutor): string {
    return executor.execute(this);
  }

  public abstract apply(document: SvgDocument): string;
}

import { SvgDocument } from "../../domain/document/SvgDocument.js";
import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export class InitCommand extends Command {
  readonly #width: number;
  readonly #height: number;

  public constructor(width = 800, height = 600) {
    super();
    this.#width = width;
    this.#height = height;
  }

  public override execute(executor: CommandExecutor): string {
    const document = new SvgDocument(this.#width, this.#height);
    executor.replaceDocument(document);
    return `canvas ${document.width}x${document.height} created`;
  }
}

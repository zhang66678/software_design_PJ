import { ApplicationError } from "../errors/ApplicationError.js";
import type { SvgStorage } from "../ports/SvgStorage.js";
import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export class ReadCommand extends Command {
  readonly #storage: SvgStorage;
  readonly #filePath: string;

  public constructor(storage: SvgStorage, filePath: string) {
    super();
    this.#storage = storage;
    this.#filePath = filePath;
  }

  public override execute(executor: CommandExecutor): string {
    if (this.#filePath.trim().length === 0) {
      throw new ApplicationError(`cannot read file: ${this.#filePath}`);
    }
    const { document, warnings } = this.#storage.read(this.#filePath);
    const count = document.getShapes().reduce((total, root) => total + [...root.walk()].length, 0);
    executor.replaceDocument(document, this.#filePath);
    return [...warnings, `read ${this.#filePath} (${count} elements)`].join("\n");
  }
}

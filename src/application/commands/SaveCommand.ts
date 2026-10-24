import { ApplicationError } from "../errors/ApplicationError.js";
import type { SvgStorage } from "../ports/SvgStorage.js";
import type { EditorSession } from "../session/EditorSession.js";
import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export class SaveCommand extends Command {
  readonly #session: EditorSession;
  readonly #storage: SvgStorage;
  readonly #filePath: string | undefined;

  public constructor(session: EditorSession, storage: SvgStorage, filePath?: string) {
    super();
    this.#session = session;
    this.#storage = storage;
    this.#filePath = filePath;
  }

  public override execute(executor: CommandExecutor): string {
    const document = this.#session.getDocument();
    const filePath = this.#filePath ?? this.#session.filePath;
    if (filePath === undefined) {
      throw new ApplicationError("no file path. use 'save <file.svg>' first");
    }
    if (filePath.trim().length === 0) {
      throw new ApplicationError(`cannot write file: ${filePath}`);
    }
    const count = document.getShapes().reduce((total, root) => total + [...root.walk()].length, 0);
    this.#storage.save(document, filePath);
    this.#session.setFilePath(filePath);
    executor.setHistoryBarrier();
    return `saved to ${filePath} (${count} elements)`;
  }
}

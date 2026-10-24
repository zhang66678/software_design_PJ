import type { EditorSession } from "../session/EditorSession.js";
import { Command } from "./Command.js";
import type { CommandExecutor } from "./CommandExecutor.js";

export class CanvasCommand extends Command {
  readonly #session: EditorSession;
  readonly #width: number | undefined;
  readonly #height: number | undefined;

  public constructor(session: EditorSession, width?: number, height?: number) {
    super();
    this.#session = session;
    this.#width = width;
    this.#height = height;
  }

  public override execute(executor: CommandExecutor): string {
    const document = this.#session.getDocument();
    if (this.#width === undefined && this.#height === undefined) {
      return `canvas ${document.width}x${document.height}`;
    }
    const resized = document.withSize(this.#width ?? document.width, this.#height ?? document.height);
    executor.replaceDocument(resized, this.#session.filePath);
    return `canvas resized to ${resized.width}x${resized.height}`;
  }
}

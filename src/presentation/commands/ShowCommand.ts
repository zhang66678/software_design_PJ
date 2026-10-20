import { Command } from "../../application/commands/Command.js";
import type { EditorSession } from "../../application/session/EditorSession.js";
import type { DocumentFormatter } from "../formatters/DocumentFormatter.js";

export class ShowCommand extends Command {
  readonly #session: EditorSession;
  readonly #formatter: DocumentFormatter;
  readonly #id: string;

  public constructor(session: EditorSession, formatter: DocumentFormatter, id: string) {
    super();
    this.#session = session;
    this.#formatter = formatter;
    this.#id = id;
  }

  public override execute(): string {
    return this.#formatter.show(this.#session.getDocument(), this.#id);
  }
}

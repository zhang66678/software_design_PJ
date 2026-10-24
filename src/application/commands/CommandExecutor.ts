import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { CommandHistory } from "../history/CommandHistory.js";
import { DocumentSnapshot } from "../history/DocumentSnapshot.js";
import { HistoryEntry } from "../history/HistoryEntry.js";
import type { EditorSession } from "../session/EditorSession.js";
import type { EditCommand } from "./EditCommand.js";

export class CommandExecutor {
  readonly #session: EditorSession;
  readonly #history = new CommandHistory();

  public constructor(session: EditorSession) {
    this.#session = session;
  }

  public execute(command: EditCommand): string {
    const before = this.#session.capture();
    const candidate = before.restore();
    const summary = command.apply(candidate);
    const after = new DocumentSnapshot(candidate);
    const entry = new HistoryEntry(before, after, summary);

    this.#session.restore(after);
    this.#history.record(entry);
    return summary;
  }

  public undo(): string {
    this.#session.capture();
    return this.#history.undo(this.#session);
  }

  public redo(): string {
    this.#session.capture();
    return this.#history.redo(this.#session);
  }

  public replaceDocument(document: SvgDocument, filePath?: string): void {
    this.#session.replaceDocument(document, filePath);
    this.#history.setBarrier();
  }

  public setHistoryBarrier(): void {
    this.#session.capture();
    this.#history.setBarrier();
  }
}

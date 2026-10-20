import { ApplicationError } from "../errors/ApplicationError.js";
import type { EditorSession } from "../session/EditorSession.js";
import type { HistoryEntry } from "./HistoryEntry.js";

export class CommandHistory {
  readonly #undoEntries: HistoryEntry[] = [];
  readonly #redoEntries: HistoryEntry[] = [];
  #blockedByBarrier = false;

  public record(entry: HistoryEntry): void {
    this.#undoEntries.push(entry);
    this.#redoEntries.length = 0;
    this.#blockedByBarrier = false;
  }

  public undo(session: EditorSession): string {
    this.assertAllowed();
    const entry = this.#undoEntries.at(-1);
    if (entry === undefined) {
      throw new ApplicationError("nothing to undo");
    }

    const summary = entry.undo(session);
    this.#undoEntries.pop();
    this.#redoEntries.push(entry);
    return summary;
  }

  public redo(session: EditorSession): string {
    this.assertAllowed();
    const entry = this.#redoEntries.at(-1);
    if (entry === undefined) {
      throw new ApplicationError("nothing to redo");
    }

    const summary = entry.redo(session);
    this.#redoEntries.pop();
    this.#undoEntries.push(entry);
    return summary;
  }

  public setBarrier(): void {
    this.#undoEntries.length = 0;
    this.#redoEntries.length = 0;
    this.#blockedByBarrier = true;
  }

  private assertAllowed(): void {
    if (this.#blockedByBarrier) {
      throw new ApplicationError("undo not allowed after io command");
    }
  }
}

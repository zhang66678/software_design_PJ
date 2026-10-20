import type { EditorSession } from "../session/EditorSession.js";
import type { DocumentSnapshot } from "./DocumentSnapshot.js";

export class HistoryEntry {
  readonly #before: DocumentSnapshot;
  readonly #after: DocumentSnapshot;
  readonly #summary: string;

  public constructor(
    before: DocumentSnapshot,
    after: DocumentSnapshot,
    summary: string,
  ) {
    this.#before = before;
    this.#after = after;
    this.#summary = summary;
  }

  public undo(session: EditorSession): string {
    session.restore(this.#before);
    return `undone: ${this.#summary}`;
  }

  public redo(session: EditorSession): string {
    session.restore(this.#after);
    return `redone: ${this.#summary}`;
  }
}

import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { ApplicationError } from "../errors/ApplicationError.js";
import { DocumentSnapshot } from "../history/DocumentSnapshot.js";

export class EditorSession {
  #snapshot: DocumentSnapshot | undefined;

  public getDocument(): SvgDocument {
    return this.capture().restore();
  }

  public replaceDocument(document: SvgDocument): void {
    this.restore(new DocumentSnapshot(document));
  }

  public capture(): DocumentSnapshot {
    if (this.#snapshot === undefined) {
      throw new ApplicationError("no document. use 'init' or 'read' first");
    }

    return this.#snapshot;
  }

  public restore(snapshot: DocumentSnapshot): void {
    this.#snapshot = snapshot;
  }
}

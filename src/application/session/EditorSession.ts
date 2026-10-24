import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { ApplicationError } from "../errors/ApplicationError.js";
import { DocumentSnapshot } from "../history/DocumentSnapshot.js";

export class EditorSession {
  #snapshot: DocumentSnapshot | undefined;
  #filePath: string | undefined;

  public get filePath(): string | undefined {
    return this.#filePath;
  }

  public setFilePath(filePath: string): void {
    this.#filePath = filePath;
  }

  public getDocument(): SvgDocument {
    return this.capture().restore();
  }

  public replaceDocument(document: SvgDocument, filePath?: string): void {
    this.restore(new DocumentSnapshot(document));
    this.#filePath = filePath;
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

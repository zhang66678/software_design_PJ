import type { SvgDocument } from "../../domain/document/SvgDocument.js";

export class DocumentSnapshot {
  readonly #document: SvgDocument;

  public constructor(document: SvgDocument) {
    this.#document = document.clone();
  }

  public restore(): SvgDocument {
    return this.#document.clone();
  }
}

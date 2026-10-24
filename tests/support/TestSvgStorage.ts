import { ApplicationError } from "../../src/application/errors/ApplicationError.js";
import type { SvgStorage } from "../../src/application/ports/SvgStorage.js";
import type { SvgDocument } from "../../src/domain/document/SvgDocument.js";

export class TestSvgStorage implements SvgStorage {
  public readonly writes: { readonly document: SvgDocument; readonly filePath: string }[] = [];
  public failWrites = false;

  public save(document: SvgDocument, filePath: string): void {
    if (this.failWrites) {
      throw new ApplicationError(`cannot write file: ${filePath}`);
    }
    this.writes.push({ document: document.clone(), filePath });
  }
}

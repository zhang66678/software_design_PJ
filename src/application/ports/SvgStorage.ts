import type { SvgDocument } from "../../domain/document/SvgDocument.js";

export interface SvgReadResult {
  readonly document: SvgDocument;
  readonly warnings: readonly string[];
}

export interface SvgStorage {
  read(filePath: string): SvgReadResult;
  save(document: SvgDocument, filePath: string): void;
}

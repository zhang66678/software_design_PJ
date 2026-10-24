import type { SvgDocument } from "../../domain/document/SvgDocument.js";

export interface SvgStorage {
  save(document: SvgDocument, filePath: string): void;
}

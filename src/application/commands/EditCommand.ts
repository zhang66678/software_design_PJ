import type { SvgDocument } from "../../domain/document/SvgDocument.js";

export abstract class EditCommand {
  public abstract execute(document: SvgDocument): string;
}

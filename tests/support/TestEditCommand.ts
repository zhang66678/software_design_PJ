import { EditCommand } from "../../src/application/commands/EditCommand.js";
import type { SvgDocument } from "../../src/domain/document/SvgDocument.js";

export class TestEditCommand extends EditCommand {
  readonly #action: (document: SvgDocument) => string;

  public constructor(action: (document: SvgDocument) => string) {
    super();
    this.#action = action;
  }

  public override apply(document: SvgDocument): string {
    return this.#action(document);
  }
}

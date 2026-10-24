import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class FrontCommand extends EditCommand {
  readonly #id: string;

  public constructor(id: string) {
    super();
    this.#id = id;
  }

  public override apply(document: SvgDocument): string {
    const shape = document.bringToFront(this.#id);
    return `${shape.type}#${shape.id} brought to front`;
  }
}

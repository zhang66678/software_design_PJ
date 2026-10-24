import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class BackCommand extends EditCommand {
  readonly #id: string;

  public constructor(id: string) {
    super();
    this.#id = id;
  }

  public override apply(document: SvgDocument): string {
    const shape = document.sendToBack(this.#id);
    return `${shape.type}#${shape.id} sent to back`;
  }
}

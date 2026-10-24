import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class UngroupCommand extends EditCommand {
  readonly #id: string;

  public constructor(id: string) {
    super();
    this.#id = id;
  }

  public override apply(document: SvgDocument): string {
    const group = document.ungroup(this.#id);
    return `${group.type}#${group.id} ungrouped with ${group.getChildren().length} children`;
  }
}

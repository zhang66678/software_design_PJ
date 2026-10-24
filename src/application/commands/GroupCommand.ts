import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class GroupCommand extends EditCommand {
  readonly #id: string;
  readonly #shapeIds: readonly string[];

  public constructor(id: string, shapeIds: readonly string[]) {
    super();
    this.#id = id;
    this.#shapeIds = [...shapeIds];
  }

  public override apply(document: SvgDocument): string {
    const group = document.group(this.#id, this.#shapeIds);
    return `${group.type}#${group.id} created with ${group.getChildren().length} children`;
  }
}

import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class AddToCommand extends EditCommand {
  readonly #containerId: string;
  readonly #id: string;

  public constructor(containerId: string, id: string) {
    super();
    this.#containerId = containerId;
    this.#id = id;
  }

  public override apply(document: SvgDocument): string {
    const shape = document.addTo(this.#containerId, this.#id);
    const container = document.getContainer(this.#containerId);
    return `${shape.type}#${shape.id} added to ${container.type}#${container.id}`;
  }
}

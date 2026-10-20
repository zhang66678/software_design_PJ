import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class ScaleCommand extends EditCommand {
  readonly #id: string;
  readonly #factor: number;

  public constructor(id: string, factor: number) {
    super();
    this.#id = id;
    this.#factor = factor;
  }

  public override apply(document: SvgDocument): string {
    const shape = document.getShape(this.#id);
    shape.scale(this.#factor);
    return `${shape.type}#${shape.id} scaled by ${this.#factor}`;
  }
}

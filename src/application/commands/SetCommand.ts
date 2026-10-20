import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { EditCommand } from "./EditCommand.js";

export class SetCommand extends EditCommand {
  readonly #id: string;
  readonly #attribute: string;
  readonly #value: string;

  public constructor(id: string, attribute: string, value: string) {
    super();
    this.#id = id;
    this.#attribute = attribute;
    this.#value = value;
  }

  public override apply(document: SvgDocument): string {
    const shape = document.getShape(this.#id);
    shape.set(this.#attribute, this.#value);
    return `${shape.type}#${shape.id} updated: ${this.#attribute}=${JSON.stringify(this.#value)}`;
  }
}

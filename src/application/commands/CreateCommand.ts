import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import type { ShapeFactory } from "../factories/ShapeFactory.js";
import { EditCommand } from "./EditCommand.js";

export class CreateCommand extends EditCommand {
  readonly #factory: ShapeFactory;
  readonly #type: string;
  readonly #id: string;
  readonly #parameters: readonly string[];

  public constructor(
    factory: ShapeFactory,
    type: string,
    id: string,
    parameters: readonly string[],
  ) {
    super();
    this.#factory = factory;
    this.#type = type;
    this.#id = id;
    this.#parameters = [...parameters];
  }

  public override apply(document: SvgDocument): string {
    const shape = this.#factory.create(this.#type, this.#id, this.#parameters);
    document.add(shape);
    return `${shape.type}#${shape.id} created`;
  }
}

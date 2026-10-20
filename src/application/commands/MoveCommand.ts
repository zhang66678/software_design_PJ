import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import { ApplicationError } from "../errors/ApplicationError.js";
import { EditCommand } from "./EditCommand.js";

export class MoveCommand extends EditCommand {
  readonly #id: string;
  readonly #dx: number;
  readonly #dy: number;

  public constructor(id: string, dx: number, dy: number) {
    super();
    this.#id = id;
    this.#dx = dx;
    this.#dy = dy;
  }

  public override apply(document: SvgDocument): string {
    if (![this.#dx, this.#dy].every(Number.isFinite)) {
      throw new ApplicationError("move offsets must be finite numbers");
    }

    const shape = document.getShape(this.#id);
    shape.move(this.#dx, this.#dy);
    return `${shape.type}#${shape.id} moved by (${this.#dx},${this.#dy})`;
  }
}

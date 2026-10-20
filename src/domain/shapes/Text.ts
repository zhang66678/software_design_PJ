import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes, ShapeDescription } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Text extends Shape {
  #x: number;
  #y: number;
  readonly #content: string;

  public constructor(id: string, x: number, y: number, content: string, style: Style = new Style()) {
    super(id, style);
    Text.validateGeometry(x, y);
    this.#x = x;
    this.#y = y;
    this.#content = content;
  }

  public override get type(): "text" {
    return "text";
  }

  public override move(dx: number, dy: number): void {
    const x = this.#x + dx;
    const y = this.#y + dy;
    Text.validateGeometry(x, y);
    this.#x = x;
    this.#y = y;
  }

  public override clone(): Text {
    return new Text(this.id, this.#x, this.#y, this.#content, this.copyStyle());
  }

  public override describe(): ShapeDescription {
    return Object.freeze({ ...super.describe(), textContent: this.#content });
  }

  protected override geometryAttributes(): ShapeAttributes {
    return { x: this.#x, y: this.#y };
  }

  private static validateGeometry(x: number, y: number): void {
    if (![x, y].every(Number.isFinite)) {
      throw new DomainError("text position must be finite");
    }
  }
}

import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Line extends Shape {
  #x1: number;
  #y1: number;
  #x2: number;
  #y2: number;

  public constructor(
    id: string, x1: number, y1: number, x2: number, y2: number, style: Style = new Style(),
  ) {
    super(id, style);
    Line.validateGeometry(x1, y1, x2, y2);
    this.#x1 = x1;
    this.#y1 = y1;
    this.#x2 = x2;
    this.#y2 = y2;
  }

  public override get type(): "line" {
    return "line";
  }

  public override move(dx: number, dy: number): void {
    const x1 = this.#x1 + dx;
    const y1 = this.#y1 + dy;
    const x2 = this.#x2 + dx;
    const y2 = this.#y2 + dy;
    Line.validateGeometry(x1, y1, x2, y2);
    this.#x1 = x1;
    this.#y1 = y1;
    this.#x2 = x2;
    this.#y2 = y2;
  }

  public override clone(): Line {
    return new Line(this.id, this.#x1, this.#y1, this.#x2, this.#y2, this.copyStyle());
  }

  protected override geometryAttributes(): ShapeAttributes {
    return { x1: this.#x1, y1: this.#y1, x2: this.#x2, y2: this.#y2 };
  }

  private static validateGeometry(x1: number, y1: number, x2: number, y2: number): void {
    if (![x1, y1, x2, y2].every(Number.isFinite)) {
      throw new DomainError("line geometry must be finite");
    }
  }
}

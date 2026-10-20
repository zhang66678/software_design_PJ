import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Circle extends Shape {
  #cx: number;
  #cy: number;
  #r: number;

  public constructor(id: string, cx: number, cy: number, r: number, style: Style = new Style()) {
    super(id, style);
    Circle.validateGeometry(cx, cy, r);
    this.#cx = cx;
    this.#cy = cy;
    this.#r = r;
  }

  public override get type(): "circle" {
    return "circle";
  }

  public override move(dx: number, dy: number): void {
    this.updateGeometry(this.#cx + dx, this.#cy + dy, this.#r);
  }

  public override scale(factor: number): void {
    this.validateScaleFactor(factor);
    this.updateGeometry(this.#cx * factor, this.#cy * factor, this.#r * factor);
  }

  public override clone(): Circle {
    return new Circle(this.id, this.#cx, this.#cy, this.#r, this.copyStyle());
  }

  protected override geometryAttributes(): ShapeAttributes {
    return { cx: this.#cx, cy: this.#cy, r: this.#r };
  }

  protected override setOwnAttribute(attribute: string, value: string): void {
    const geometry = this.updatedGeometry({ cx: this.#cx, cy: this.#cy, r: this.#r }, attribute, value);
    this.updateGeometry(geometry.cx, geometry.cy, geometry.r);
  }

  private updateGeometry(cx: number, cy: number, r: number): void {
    Circle.validateGeometry(cx, cy, r);
    this.#cx = cx;
    this.#cy = cy;
    this.#r = r;
  }

  private static validateGeometry(cx: number, cy: number, r: number): void {
    if (![cx, cy, r].every(Number.isFinite)) {
      throw new DomainError("circle geometry must be finite");
    }
    if (r < 0) {
      throw new DomainError("circle radius must be non-negative");
    }
  }
}

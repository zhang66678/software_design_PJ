import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Ellipse extends Shape {
  #cx: number;
  #cy: number;
  #rx: number;
  #ry: number;

  public constructor(
    id: string, cx: number, cy: number, rx: number, ry: number, style: Style = new Style(),
  ) {
    super(id, style);
    Ellipse.validateGeometry(cx, cy, rx, ry);
    this.#cx = cx;
    this.#cy = cy;
    this.#rx = rx;
    this.#ry = ry;
  }

  public override get type(): "ellipse" {
    return "ellipse";
  }

  public override move(dx: number, dy: number): void {
    this.updateGeometry(this.#cx + dx, this.#cy + dy, this.#rx, this.#ry);
  }

  public override scale(factor: number): void {
    this.validateScaleFactor(factor);
    this.updateGeometry(this.#cx * factor, this.#cy * factor, this.#rx * factor, this.#ry * factor);
  }

  public override clone(): Ellipse {
    return new Ellipse(this.id, this.#cx, this.#cy, this.#rx, this.#ry, this.copyStyle());
  }

  protected override geometryAttributes(): ShapeAttributes {
    return { cx: this.#cx, cy: this.#cy, rx: this.#rx, ry: this.#ry };
  }

  protected override setOwnAttribute(attribute: string, value: string): void {
    const geometry = this.updatedGeometry(
      { cx: this.#cx, cy: this.#cy, rx: this.#rx, ry: this.#ry }, attribute, value,
    );
    this.updateGeometry(geometry.cx, geometry.cy, geometry.rx, geometry.ry);
  }

  private updateGeometry(cx: number, cy: number, rx: number, ry: number): void {
    Ellipse.validateGeometry(cx, cy, rx, ry);
    this.#cx = cx;
    this.#cy = cy;
    this.#rx = rx;
    this.#ry = ry;
  }

  private static validateGeometry(cx: number, cy: number, rx: number, ry: number): void {
    if (![cx, cy, rx, ry].every(Number.isFinite)) {
      throw new DomainError("ellipse geometry must be finite");
    }
    if (rx < 0 || ry < 0) {
      throw new DomainError("ellipse radii must be non-negative");
    }
  }
}

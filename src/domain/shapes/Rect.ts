import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Rect extends Shape {
  #x: number;
  #y: number;
  #width: number;
  #height: number;

  public constructor(
    id: string,
    x: number,
    y: number,
    width: number,
    height: number,
    style: Style = new Style(),
  ) {
    super(id, style);
    Rect.validateGeometry(x, y, width, height);
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
  }

  public override get type(): "rect" {
    return "rect";
  }

  public get x(): number {
    return this.#x;
  }

  public get y(): number {
    return this.#y;
  }

  public get width(): number {
    return this.#width;
  }

  public get height(): number {
    return this.#height;
  }

  public override move(dx: number, dy: number): void {
    this.updateGeometry(this.#x + dx, this.#y + dy, this.#width, this.#height);
  }

  public override scale(factor: number): void {
    this.validateScaleFactor(factor);
    this.updateGeometry(this.#x * factor, this.#y * factor, this.#width * factor, this.#height * factor);
  }

  public override clone(): Rect {
    return new Rect(
      this.id,
      this.#x,
      this.#y,
      this.#width,
      this.#height,
      this.copyStyle(),
    );
  }

  protected override geometryAttributes(): ShapeAttributes {
    return {
      x: this.#x,
      y: this.#y,
      width: this.#width,
      height: this.#height,
    };
  }

  protected override setOwnAttribute(attribute: string, value: string): void {
    const geometry = this.updatedGeometry(
      { x: this.#x, y: this.#y, width: this.#width, height: this.#height }, attribute, value,
    );
    this.updateGeometry(geometry.x, geometry.y, geometry.width, geometry.height);
  }

  private updateGeometry(x: number, y: number, width: number, height: number): void {
    Rect.validateGeometry(x, y, width, height);
    this.#x = x;
    this.#y = y;
    this.#width = width;
    this.#height = height;
  }

  private static validateGeometry(
    x: number,
    y: number,
    width: number,
    height: number,
  ): void {
    if (![x, y, width, height].every(Number.isFinite)) {
      throw new DomainError("rectangle geometry must be finite");
    }
    if (width < 0 || height < 0) {
      throw new DomainError("rectangle dimensions must be non-negative");
    }
  }
}

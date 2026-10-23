import { DomainError } from "../errors/DomainError.js";
import { Shape } from "./Shape.js";
import type { ShapeAttributes } from "./ShapeDescription.js";
import { Style } from "./Style.js";

export class Group extends Shape {
  readonly #children: readonly Shape[];

  public constructor(id: string, children: readonly Shape[] = [], style: Style = new Style()) {
    super(id, style);
    this.#children = Object.freeze([...children]);
    const ids = new Set<string>();
    for (const shape of this.walk()) {
      if (ids.has(shape.id)) {
        throw new DomainError(`id already exists: ${shape.id}`);
      }
      ids.add(shape.id);
    }
  }

  public override get type(): "g" {
    return "g";
  }

  public override get isContainer(): boolean {
    return true;
  }

  public override getChildren(): readonly Shape[] {
    return this.#children;
  }

  public override withChildren(children: readonly Shape[]): Group {
    return new Group(this.id, children, this.copyStyle());
  }

  public override move(dx: number, dy: number): void {
    if (![dx, dy].every(Number.isFinite)) {
      throw new DomainError("move offsets must be finite numbers");
    }
    this.transform((shape) => shape.move(dx, dy));
  }

  public override scale(factor: number): void {
    this.validateScaleFactor(factor);
    this.transform((shape) => shape.scale(factor));
  }

  public override clone(): Group {
    return this.withChildren(this.#children.map((child) => child.clone()));
  }

  protected override geometryAttributes(): ShapeAttributes {
    return {};
  }

  protected override setOwnAttribute(attribute: string): void {
    throw new DomainError(`unknown attribute: ${attribute}`);
  }

  private transform(operation: (shape: Shape) => void): void {
    // Validate leaf geometry before recursively updating the existing children.
    for (const shape of this.walk()) {
      if (!shape.isContainer) {
        operation(shape.clone());
      }
    }
    for (const child of this.#children) {
      operation(child);
    }
  }
}

import { DomainError } from "../errors/DomainError.js";
import type { Shape } from "../shapes/Shape.js";

export class SvgDocument {
  readonly #width: number;
  readonly #height: number;
  readonly #shapes: Shape[] = [];

  public constructor(width = 800, height = 600) {
    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      throw new DomainError("canvas dimensions must be positive finite numbers");
    }

    this.#width = width;
    this.#height = height;
  }

  public get width(): number {
    return this.#width;
  }

  public get height(): number {
    return this.#height;
  }

  public add(shape: Shape): void {
    if (this.#shapes.some((existing) => existing.id === shape.id)) {
      throw new DomainError(`id already exists: ${shape.id}`);
    }

    this.#shapes.push(shape);
  }

  public getShape(id: string): Shape {
    const shape = this.#shapes.find((candidate) => candidate.id === id);
    if (shape === undefined) {
      throw new DomainError(`no such shape: ${id}`);
    }

    return shape;
  }

  public getShapes(): readonly Shape[] {
    return Object.freeze([...this.#shapes]);
  }

  public clone(): SvgDocument {
    const copy = new SvgDocument(this.#width, this.#height);
    for (const shape of this.#shapes) {
      copy.add(shape.clone());
    }

    return copy;
  }
}

import { DomainError } from "../errors/DomainError.js";
import type {
  ShapeAttributes,
  ShapeDescription,
} from "./ShapeDescription.js";
import { Style } from "./Style.js";

export abstract class Shape {
  readonly #id: string;
  #style: Style;

  protected constructor(id: string, style: Style = new Style()) {
    if (id.length === 0) {
      throw new DomainError("id must not be empty");
    }
    if (/\s/u.test(id)) {
      throw new DomainError("id must not contain whitespace");
    }

    this.#id = id;
    this.#style = style.clone();
  }

  public get id(): string {
    return this.#id;
  }

  public abstract get type(): string;

  public abstract move(dx: number, dy: number): void;

  public abstract scale(factor: number): void;

  public set(attribute: string, value: string): void {
    if (["fill", "stroke", "stroke-width"].includes(attribute)) {
      this.#style = this.#style.withAttribute(attribute, value);
    } else {
      this.setOwnAttribute(attribute, value);
    }
  }

  public abstract clone(): Shape;

  public describe(): ShapeDescription {
    return Object.freeze({
      id: this.#id,
      type: this.type,
      attributes: Object.freeze({
        ...this.#style.toAttributes(),
        ...this.geometryAttributes(),
      }),
    });
  }

  protected abstract geometryAttributes(): ShapeAttributes;

  protected abstract setOwnAttribute(attribute: string, value: string): void;

  protected validateScaleFactor(factor: number): void {
    if (!Number.isFinite(factor) || factor <= 0) {
      throw new DomainError("scale factor must be positive");
    }
  }

  protected updatedGeometry<T extends Record<string, number>>(
    geometry: T, attribute: string, value: string,
  ): T {
    if (!Object.hasOwn(geometry, attribute)) {
      throw new DomainError(`unknown attribute: ${attribute}`);
    }
    const number = Number(value);
    if (value.trim().length === 0 || !Number.isFinite(number)) {
      throw new DomainError(`${attribute} must be a finite number`);
    }

    return { ...geometry, [attribute]: number };
  }

  protected copyStyle(): Style {
    return this.#style.clone();
  }
}

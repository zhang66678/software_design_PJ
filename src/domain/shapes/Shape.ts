import { DomainError } from "../errors/DomainError.js";
import type {
  ShapeAttributes,
  ShapeDescription,
} from "./ShapeDescription.js";
import { Style } from "./Style.js";

export abstract class Shape {
  readonly #id: string;
  readonly #style: Style;

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

  protected copyStyle(): Style {
    return this.#style.clone();
  }
}

import { DomainError } from "../errors/DomainError.js";
import type { ShapeAttributes } from "./ShapeDescription.js";

export interface StyleOptions {
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth?: number;
}

export class Style {
  readonly #fill: string | undefined;
  readonly #stroke: string | undefined;
  readonly #strokeWidth: number | undefined;

  public constructor(options: StyleOptions = {}) {
    for (const color of [options.fill, options.stroke]) {
      if (color !== undefined && color.trim().length === 0) {
        throw new DomainError("style color must not be empty");
      }
    }

    if (
      options.strokeWidth !== undefined &&
      (!Number.isFinite(options.strokeWidth) || options.strokeWidth < 0)
    ) {
      throw new DomainError("stroke-width must be a non-negative finite number");
    }

    this.#fill = options.fill;
    this.#stroke = options.stroke;
    this.#strokeWidth = options.strokeWidth;
  }

  public toAttributes(): ShapeAttributes {
    const attributes: Record<string, string | number> = {};

    if (this.#fill !== undefined) {
      attributes.fill = this.#fill;
    }
    if (this.#stroke !== undefined) {
      attributes.stroke = this.#stroke;
    }
    if (this.#strokeWidth !== undefined) {
      attributes["stroke-width"] = this.#strokeWidth;
    }

    return Object.freeze(attributes);
  }

  public clone(): Style {
    return new Style({
      ...(this.#fill === undefined ? {} : { fill: this.#fill }),
      ...(this.#stroke === undefined ? {} : { stroke: this.#stroke }),
      ...(this.#strokeWidth === undefined
        ? {}
        : { strokeWidth: this.#strokeWidth }),
    });
  }
}

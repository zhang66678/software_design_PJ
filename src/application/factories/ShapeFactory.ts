import type { Shape } from "../../domain/shapes/Shape.js";
import { Rect } from "../../domain/shapes/Rect.js";
import { Style } from "../../domain/shapes/Style.js";
import { CommandArguments } from "../arguments/CommandArguments.js";
import { ApplicationError } from "../errors/ApplicationError.js";

type ShapeCreator = (id: string, parameters: readonly string[]) => Shape;

export class ShapeFactory {
  // Refactoring point: shape-name dispatch is confined to this factory.
  readonly #creators = new Map<string, ShapeCreator>([
    ["rect", (id, parameters) => this.createRect(id, parameters)],
  ]);

  public create(type: string, id: string, parameters: readonly string[]): Shape {
    const creator = this.#creators.get(type);
    if (creator === undefined) {
      throw new ApplicationError(
        `unknown shape type: ${type} (is the plugin loaded?)`,
      );
    }

    return creator(id, parameters);
  }

  private createRect(id: string, parameters: readonly string[]): Rect {
    const args = new CommandArguments(parameters);
    args.expectCount(4, 5, "create rect <id> <x> <y> <w> <h> [fill]");
    const fill = args.optionalAt(4);

    return new Rect(
      id,
      args.numberAt(0, "x"),
      args.numberAt(1, "y"),
      args.numberAt(2, "width"),
      args.numberAt(3, "height"),
      new Style(fill === undefined ? {} : { fill }),
    );
  }
}

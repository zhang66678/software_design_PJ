import type { Shape } from "../../domain/shapes/Shape.js";
import { Circle } from "../../domain/shapes/Circle.js";
import { Ellipse } from "../../domain/shapes/Ellipse.js";
import { Group } from "../../domain/shapes/Group.js";
import { Line } from "../../domain/shapes/Line.js";
import { Rect } from "../../domain/shapes/Rect.js";
import { Style } from "../../domain/shapes/Style.js";
import { Text } from "../../domain/shapes/Text.js";
import { CommandArguments } from "../arguments/CommandArguments.js";
import { ApplicationError } from "../errors/ApplicationError.js";

type ShapeCreator = (id: string, parameters: readonly string[]) => Shape;

interface ShapeDefinition {
  readonly create: ShapeCreator;
  readonly geometry: readonly string[];
  readonly text?: boolean;
}

export class ShapeFactory {
  // Refactoring point: shape-name dispatch is confined to this factory.
  readonly #definitions = new Map<string, ShapeDefinition>([
    ["rect", { create: (id, args) => this.createRect(id, args), geometry: ["x", "y", "width", "height"] }],
    ["circle", { create: (id, args) => this.createCircle(id, args), geometry: ["cx", "cy", "r"] }],
    ["ellipse", { create: (id, args) => this.createEllipse(id, args), geometry: ["cx", "cy", "rx", "ry"] }],
    ["line", { create: (id, args) => this.createLine(id, args), geometry: ["x1", "y1", "x2", "y2"] }],
    ["text", { create: (id, args) => this.createText(id, args), geometry: ["x", "y"], text: true }],
    ["g", { create: (id, args) => this.createGroup(id, args), geometry: [] }],
  ]);

  public create(type: string, id: string, parameters: readonly string[]): Shape {
    return this.definition(type).create(id, parameters);
  }

  public fromSvg(
    type: string, id: string, attributes: Readonly<Record<string, string>>,
    textContent: string, children: readonly Shape[],
  ): Shape {
    const definition = this.definition(type);
    const styles = ["fill", "stroke", "stroke-width"];
    const allowed = new Set(["id", ...definition.geometry, ...styles]);
    for (const attribute of Object.keys(attributes)) {
      if (!allowed.has(attribute)) {
        throw new ApplicationError(`unsupported SVG attribute: ${attribute} on <${type}>`);
      }
    }
    if (!definition.text && textContent.trim().length > 0) {
      throw new ApplicationError(`unexpected text in <${type}>`);
    }
    const parameters = definition.geometry.map((name) => (attributes[name] ?? "0").trim().replace(/px$/u, ""));
    if (definition.text) {
      parameters.push(textContent);
    }
    const shape = definition.create(id, parameters);
    for (const attribute of styles) {
      const value = attributes[attribute];
      if (value !== undefined) {
        shape.set(attribute, attribute === "stroke-width" ? value.trim().replace(/px$/u, "") : value);
      }
    }

    return children.length === 0 ? shape : shape.withChildren(children);
  }

  private definition(type: string): ShapeDefinition {
    const definition = this.#definitions.get(type);
    if (definition === undefined) {
      throw new ApplicationError(
        `unknown shape type: ${type} (is the plugin loaded?)`,
      );
    }

    return definition;
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

  private createCircle(id: string, parameters: readonly string[]): Circle {
    const args = new CommandArguments(parameters);
    args.expectCount(3, 4, "create circle <id> <cx> <cy> <r> [fill]");
    const fill = args.optionalAt(3);

    return new Circle(
      id,
      args.numberAt(0, "cx"),
      args.numberAt(1, "cy"),
      args.numberAt(2, "r"),
      new Style(fill === undefined ? {} : { fill }),
    );
  }

  private createEllipse(id: string, parameters: readonly string[]): Ellipse {
    const args = new CommandArguments(parameters);
    args.expectCount(4, 5, "create ellipse <id> <cx> <cy> <rx> <ry> [fill]");
    const fill = args.optionalAt(4);

    return new Ellipse(
      id,
      args.numberAt(0, "cx"),
      args.numberAt(1, "cy"),
      args.numberAt(2, "rx"),
      args.numberAt(3, "ry"),
      new Style(fill === undefined ? {} : { fill }),
    );
  }

  private createLine(id: string, parameters: readonly string[]): Line {
    const args = new CommandArguments(parameters);
    args.expectCount(4, 5, "create line <id> <x1> <y1> <x2> <y2> [stroke]");
    const stroke = args.optionalAt(4);

    return new Line(
      id,
      args.numberAt(0, "x1"),
      args.numberAt(1, "y1"),
      args.numberAt(2, "x2"),
      args.numberAt(3, "y2"),
      new Style(stroke === undefined ? {} : { stroke }),
    );
  }

  private createText(id: string, parameters: readonly string[]): Text {
    const args = new CommandArguments(parameters);
    args.expectCount(3, 3, 'create text <id> <x> <y> "content"');
    return new Text(id, args.numberAt(0, "x"), args.numberAt(1, "y"), args.stringAt(2, "content"));
  }

  private createGroup(id: string, parameters: readonly string[]): Group {
    new CommandArguments(parameters).expectCount(0, 0, "create g <id>");
    return new Group(id);
  }
}

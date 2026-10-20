import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import type { ShapeDescription } from "../../domain/shapes/ShapeDescription.js";

export class DocumentFormatter {
  readonly #styleNames = new Set(["fill", "stroke", "stroke-width"]);

  public tree(document: SvgDocument, id?: string): string {
    if (id !== undefined) {
      return this.inline(document.getShape(id).describe());
    }

    const lines = [`svg (${document.width}x${document.height})`];
    const shapes = document.getShapes();
    for (const [index, shape] of shapes.entries()) {
      const branch = index === shapes.length - 1 ? "└── " : "├── ";
      lines.push(`${branch}${this.inline(shape.describe())}`);
    }

    return lines.join("\n");
  }

  public show(document: SvgDocument, id: string): string {
    const description = document.getShape(id).describe();
    const lines = [`${description.type}#${description.id}  parent=svg`];
    const geometry = this.attributes(description, false);
    const content = description.textContent === undefined ? "" : `text=${JSON.stringify(description.textContent)}`;
    const style = this.attributes(description, true);
    for (const attributes of [geometry, content, style]) {
      if (attributes.length > 0) {
        lines.push(`  ${attributes}`);
      }
    }

    return lines.join("\n");
  }

  private inline(description: ShapeDescription): string {
    const attributes = [
      this.attributes(description, false),
      description.textContent === undefined ? "" : JSON.stringify(description.textContent),
      this.attributes(description, true),
    ].filter((value) => value.length > 0);

    return [`${description.type}#${description.id}`, ...attributes].join("  ");
  }

  private attributes(description: ShapeDescription, style: boolean): string {
    return Object.entries(description.attributes)
      .filter(([name]) => this.#styleNames.has(name) === style)
      .map(([name, value]) => `${name}=${this.value(value)}`)
      .join(" ");
  }

  private value(value: string | number): string {
    if (typeof value === "string" && (value.length === 0 || /[\s"\\]/u.test(value))) {
      return JSON.stringify(value);
    }

    return String(value);
  }
}

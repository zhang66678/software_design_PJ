import { ApplicationError } from "../../application/errors/ApplicationError.js";
import type { SvgDocument } from "../../domain/document/SvgDocument.js";
import type { Shape } from "../../domain/shapes/Shape.js";

export class SvgCodec {
  public encode(document: SvgDocument): string {
    const { width, height } = document;
    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
      ...document.getShapes().flatMap((shape) => this.element(shape, 1)),
      "</svg>",
      "",
    ].join("\n");
  }

  private element(shape: Shape, depth: number): string[] {
    const description = shape.describe();
    const attributes = Object.entries({ id: description.id, ...description.attributes })
      .map(([name, value]) => `${name}="${this.escape(String(value))}"`).join(" ");
    const indent = "  ".repeat(depth);
    const tag = `${description.type} ${attributes}`;
    const children = shape.getChildren();
    if (children.length > 0) {
      return [
        `${indent}<${tag}>`,
        ...children.flatMap((child) => this.element(child, depth + 1)),
        `${indent}</${description.type}>`,
      ];
    }
    if (description.textContent !== undefined) {
      return [`${indent}<${tag}>${this.escape(description.textContent)}</${description.type}>`];
    }

    return [`${indent}<${tag}/>`];
  }

  private escape(value: string): string {
    for (const character of value) {
      const code = character.codePointAt(0) ?? 0;
      if ((code < 32 && ![9, 10, 13].includes(code)) ||
        (code >= 0xd800 && code <= 0xdfff) || code === 0xfffe || code === 0xffff) {
        throw new ApplicationError("invalid XML character");
      }
    }

    return value.replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&apos;")
      .replaceAll("\r", "&#13;").replaceAll("\n", "&#10;").replaceAll("\t", "&#9;");
  }
}

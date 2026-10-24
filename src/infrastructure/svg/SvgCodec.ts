import { SaxesParser } from "saxes";
import { CommandArguments } from "../../application/arguments/CommandArguments.js";
import { ApplicationError } from "../../application/errors/ApplicationError.js";
import { ShapeFactory } from "../../application/factories/ShapeFactory.js";
import type { SvgReadResult } from "../../application/ports/SvgStorage.js";
import { SvgDocument } from "../../domain/document/SvgDocument.js";
import type { Shape } from "../../domain/shapes/Shape.js";

interface SvgElementData {
  readonly type: string;
  readonly attributes: Record<string, string>;
  readonly children: SvgElementData[];
  textContent: string;
}

export class SvgCodec {
  readonly #factory: ShapeFactory;

  public constructor(factory: ShapeFactory = new ShapeFactory()) {
    this.#factory = factory;
  }

  public decode(source: string): SvgReadResult {
    const root = this.parse(source);
    if (root.type !== "svg") {
      throw new ApplicationError("expected <svg> root element");
    }
    const document = this.canvas(root);
    const elements = [...this.walk(root)].slice(1);
    const ids = new Set<string>();
    for (const element of elements) {
      const id = element.attributes.id;
      if (id !== undefined && id.length > 0) {
        if (ids.has(id)) {
          throw new ApplicationError(`id already exists: ${id}`);
        }
        ids.add(id);
      }
    }
    const counters = new Map<string, number>();
    const warnings: string[] = [];
    for (const element of elements) {
      if (!element.attributes.id) {
        let number = counters.get(element.type) ?? 1;
        let id: string;
        do {
          id = `${element.type}${number++}`;
        } while (ids.has(id));
        counters.set(element.type, number);
        element.attributes.id = id;
        ids.add(id);
        warnings.push(`warning: assigned id ${id} to unnamed <${element.type}>`);
      }
    }
    for (const child of root.children) {
      document.add(this.restore(child));
    }

    return { document, warnings };
  }

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

  private parse(source: string): SvgElementData {
    const roots: SvgElementData[] = [];
    const stack: SvgElementData[] = [];
    const appendText = (text: string): void => {
      const current = stack.at(-1);
      if (current !== undefined) {
        current.textContent += text;
      }
    };
    const parser = new SaxesParser({ xmlns: true });
    parser.on("error", (error) => {
      throw new ApplicationError(`invalid SVG XML: ${error.message}`);
    });
    parser.on("doctype", () => { throw new ApplicationError("unsupported SVG doctype"); });
    parser.on("processinginstruction", () => { throw new ApplicationError("unsupported SVG processing instruction"); });
    parser.on("xmldecl", (declaration) => {
      if (declaration.version !== "1.0" ||
        (declaration.encoding !== undefined && !/^utf-?8$/iu.test(declaration.encoding))) {
        throw new ApplicationError("only UTF-8 XML 1.0 SVG is supported");
      }
    });
    parser.on("opentag", (tag) => {
      if (tag.uri !== "" && tag.uri !== "http://www.w3.org/2000/svg") {
        throw new ApplicationError(`unsupported SVG namespace: ${tag.uri}`);
      }
      const element: SvgElementData = {
        type: tag.local,
        attributes: Object.fromEntries(Object.values(tag.attributes)
          .filter((attribute) => attribute.uri !== "http://www.w3.org/2000/xmlns/")
          .map((attribute) => [attribute.name, attribute.value])),
        children: [], textContent: "",
      };
      const parent = stack.at(-1);
      if (parent === undefined) {
        roots.push(element);
      } else {
        parent.children.push(element);
      }
      stack.push(element);
    });
    parser.on("text", appendText);
    parser.on("cdata", appendText);
    parser.on("closetag", () => { stack.pop(); });
    parser.write(source).close();
    const root = roots[0];
    if (root === undefined) {
      throw new ApplicationError("expected <svg> root element");
    }

    return root;
  }

  private canvas(root: SvgElementData): SvgDocument {
    const allowed = new Set(["width", "height", "viewBox", "version"]);
    for (const attribute of Object.keys(root.attributes)) {
      if (!allowed.has(attribute)) {
        throw new ApplicationError(`unsupported SVG attribute: ${attribute} on <svg>`);
      }
    }
    if (root.textContent.trim().length > 0) {
      throw new ApplicationError("unexpected text in <svg>");
    }
    const box = root.attributes.viewBox?.trim().split(/[\s,]+/u).map(Number);
    if (box !== undefined && (box.length !== 4 || !box.every(Number.isFinite) || box[0] !== 0 || box[1] !== 0)) {
      throw new ApplicationError("unsupported SVG viewBox");
    }
    const dimensions = [root.attributes.width ?? String(box?.[2] ?? ""), root.attributes.height ?? String(box?.[3] ?? "")]
      .map((value) => value.trim().replace(/px$/u, ""));
    const args = new CommandArguments(dimensions);
    const document = new SvgDocument(args.numberAt(0, "width"), args.numberAt(1, "height"));
    if (box !== undefined && (box[2] !== document.width || box[3] !== document.height)) {
      throw new ApplicationError("unsupported SVG viewBox");
    }

    return document;
  }

  private *walk(element: SvgElementData): IterableIterator<SvgElementData> {
    yield element;
    for (const child of element.children) {
      yield* this.walk(child);
    }
  }

  private restore(element: SvgElementData): Shape {
    return this.#factory.fromSvg(element.type, element.attributes.id ?? "", element.attributes,
      element.textContent, element.children.map((child) => this.restore(child)));
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

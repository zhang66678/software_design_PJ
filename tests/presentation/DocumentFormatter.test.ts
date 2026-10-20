import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { DocumentFormatter } from "../../src/presentation/formatters/DocumentFormatter.js";

describe("DocumentFormatter", () => {
  const formatter = new DocumentFormatter();

  it("shows an empty canvas", () => {
    assert.equal(formatter.tree(new SvgDocument(400, 300)), "svg (400x300)");
  });

  it("shows ordered roots, tree branches and inline geometry before styles", () => {
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50, new Style({ fill: "#eee" })));
    document.add(new Rect("r2", -5.5, 0, 0, 10));

    assert.equal(formatter.tree(document), [
      "svg (800x600)",
      "├── rect#r1  x=10 y=20 width=100 height=50  fill=#eee",
      "└── rect#r2  x=-5.5 y=0 width=0 height=10",
    ].join("\n"));
  });

  it("limits tree output to the requested shape", () => {
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50));
    document.add(new Rect("r2", 0, 0, 10, 10));

    assert.equal(formatter.tree(document, "r1"), "rect#r1  x=10 y=20 width=100 height=50");
  });

  it("shows parent, geometry and explicitly supplied styles", () => {
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50,
      new Style({ fill: "rgb(255, 0, 0)", stroke: "black", strokeWidth: 0 })));

    assert.equal(formatter.show(document, "r1"), [
      "rect#r1  parent=svg",
      "  x=10 y=20 width=100 height=50",
      '  fill="rgb(255, 0, 0)" stroke=black stroke-width=0',
    ].join("\n"));
  });

  it("omits absent styles and leaves the document unchanged", () => {
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50));
    const before = document.getShape("r1").describe();

    assert.equal(formatter.show(document, "r1"),
      "rect#r1  parent=svg\n  x=10 y=20 width=100 height=50");
    formatter.tree(document);
    assert.deepEqual(document.getShape("r1").describe(), before);
  });

  it("reports missing ids for tree and show", () => {
    const document = new SvgDocument();
    assert.throws(() => formatter.tree(document, "missing"), { message: "no such shape: missing" });
    assert.throws(() => formatter.show(document, "missing"), { message: "no such shape: missing" });
  });
});

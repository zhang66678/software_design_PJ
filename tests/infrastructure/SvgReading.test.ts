import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Ellipse } from "../../src/domain/shapes/Ellipse.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";
import { SvgCodec } from "../../src/infrastructure/svg/SvgCodec.js";

describe("SVG reading", () => {
  const codec = new SvgCodec();
  const svg = (body: string): string => `<svg width="400" height="300">${body}</svg>`;

  it("round trips all six types, tree order, explicit styles, empty text and XML characters", () => {
    const document = new SvgDocument(400, 300);
    document.add(new Group("scene", [
      new Rect("rect1", 1, 2, 30, 40, new Style({ fill: "#eee" })),
      new Circle("circle1", 50, 60, 20),
      new Group("nested", [new Ellipse("ellipse1", 100, 100, 30, 20),
        new Line("line1", 0, 0, 100, 100, new Style({ stroke: "black", strokeWidth: 2 }))]),
      new Text('label&<>"', 10, 40, " 开始 & <结束> \"quoted\" 'single'\r\n\t 😀 "),
      new Text("emptyText", 0, 0, ""), new Group("emptyGroup"),
    ], new Style({ fill: "white", stroke: "none" })));
    const encoded = codec.encode(document);
    const result = codec.decode(encoded);

    assert.deepEqual(result.warnings, []);
    assert.equal(codec.encode(result.document), encoded);
    assert.equal(result.document.getParent("line1")?.id, "nested");
    assert.equal(result.document.getShape("circle1").describe().attributes.fill, undefined);
    result.document.getShape("rect1").move(10, 0);
    assert.equal(document.getShape("rect1").describe().attributes.x, 1);
  });

  it("reads the coursework other.svg example and assigns its one missing id", () => {
    const result = codec.decode(svg(`
      <rect x="0" y="0" width="400" height="300" fill="#ffffff"/>
      <text id="t1" x="10" y="290">imported</text>
      <circle id="c1" cx="50" cy="50" r="10"/>
      <g id="g1"><rect id="r2" width="10" height="10"/><circle id="c2" cx="5" cy="5" r="2"/></g>
      <ellipse id="e1" cx="1" cy="2" rx="3" ry="4"/>`));

    assert.deepEqual(result.warnings, ["warning: assigned id rect1 to unnamed <rect>"]);
    assert.deepEqual(result.document.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.id)),
      ["rect1", "t1", "c1", "g1", "r2", "c2", "e1"]);
    assert.equal(result.document.getParent("r2")?.id, "g1");
    assert.deepEqual(result.document.getShape("r2").describe().attributes, { x: 0, y: 0, width: 10, height: 10 });
  });

  it("reserves later explicit ids before assigning names, with per-tag counters and case sensitivity", () => {
    const result = codec.decode(svg('<rect/><g><rect id="rect1"/><circle id=""/></g><g id="g1"/><rect/><rect id="Rect1"/>'));
    assert.deepEqual(result.warnings, [
      "warning: assigned id rect2 to unnamed <rect>",
      "warning: assigned id g2 to unnamed <g>",
      "warning: assigned id circle1 to unnamed <circle>",
      "warning: assigned id rect3 to unnamed <rect>",
    ]);
    assert.equal(result.document.getShape("Rect1").id, "Rect1");
    assert.equal(result.document.getParent("rect1")?.id, "g2");
  });

  it("rejects duplicate ids throughout the tree and invalid explicit ids", () => {
    assert.throws(() => codec.decode(svg('<rect id="a"/><g id="g"><circle id="a"/></g>')),
      { message: "id already exists: a" });
    assert.throws(() => codec.decode(svg('<rect id="bad id"/>')), { message: "id must not contain whitespace" });
  });

  it("accepts UTF-8 declarations, comments, SVG namespaces, CDATA and px geometry", () => {
    const result = codec.decode(`<?xml version="1.0" encoding="UTF-8"?>
      <s:svg xmlns:s="http://www.w3.org/2000/svg" width="400px" height="300px" viewBox="0,0,400,300">
        <!-- source comment --><s:text id="t" x="1.5px"><![CDATA[开始 & <结束>]]></s:text>
        <s:rect id="r" width="2e1px" height="10" stroke-width="2px"/>
      </s:svg>`);
    assert.equal(result.document.getShape("t").describe().textContent, "开始 & <结束>");
    assert.equal(result.document.getShape("t").describe().attributes.x, 1.5);
    assert.deepEqual(result.document.getShape("r").describe().attributes,
      { x: 0, y: 0, width: 20, height: 10, "stroke-width": 2 });
    assert.equal(result.document.width, 400);
  });

  it("derives dimensions from a zero-origin viewBox", () => {
    const { document } = codec.decode('<svg viewBox="0 0 640 480"/>');
    assert.equal(document.width, 640);
    assert.equal(document.height, 480);
  });

  for (const source of [
    '<svg width="1" height="1"><g></svg>',
    '<svg width="1" height="1"><text>&unknown;</text></svg>',
    '<svg width="1" width="2" height="1"/>',
    '<svg width="1" height="1"/><svg width="1" height="1"/>',
    '<svg width="1" height="1">\u0000</svg>', "", "not XML",
  ]) {
    it(`rejects malformed XML ${JSON.stringify(source)}`, () => {
      assert.throws(() => codec.decode(source), { message: /^invalid SVG XML:/u });
    });
  }

  it("rejects unsupported SVG semantics instead of silently discarding them", () => {
    for (const body of ['<path id="p"/>', '<g id="g" transform="translate(10,0)"/>',
      '<rect id="r" style="fill:red"/>', '<text id="t" font-size="16">hello</text>',
      '<text id="t"><tspan>hello</tspan></text>', '<rect id="r"><circle id="c"/></rect>',
      '<g id="g">unexpected text</g>']) {
      assert.throws(() => codec.decode(svg(body)));
    }
    assert.throws(() => codec.decode('<svg xmlns="urn:other" width="1" height="1"/>'),
      { message: "unsupported SVG namespace: urn:other" });
    assert.throws(() => codec.decode('<g/>'), { message: "expected <svg> root element" });
    assert.throws(() => codec.decode('<svg width="1" height="1" style="background:red"/>'),
      { message: "unsupported SVG attribute: style on <svg>" });
    assert.throws(() => codec.decode('<!DOCTYPE svg SYSTEM "external.dtd"><svg width="1" height="1"/>'),
      { message: "unsupported SVG doctype" });
    assert.throws(() => codec.decode('<?xml-stylesheet href="external.css"?><svg width="1" height="1"/>'),
      { message: "unsupported SVG processing instruction" });
    assert.throws(() => codec.decode('<?xml version="1.0" encoding="ISO-8859-1"?><svg width="1" height="1"/>'),
      { message: "only UTF-8 XML 1.0 SVG is supported" });
  });

  it("rejects invalid dimensions, units, geometry, styles and viewBox mappings", () => {
    for (const source of ['<svg/>', '<svg width="0" height="100"/>', '<svg width="100%" height="100"/>',
      '<svg width="400" height="300" viewBox="0 0 800 600"/>', '<svg viewBox="1 0 400 300"/>',
      '<svg viewBox="0 0 400"/>', svg('<rect width="-1"/>'), svg('<circle r="NaN"/>'),
      svg('<text x="10em">text</text>'), svg('<rect fill=""/>'), svg('<rect stroke-width="-1"/>')]) {
      assert.throws(() => codec.decode(source));
    }
  });
});

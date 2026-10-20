import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Ellipse } from "../../src/domain/shapes/Ellipse.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";

describe("Shape scaling and attributes", () => {
  for (const { create, geometry } of [
    { create: () => new Rect("r1", 10, 20, 100, 50), geometry: { x: 10, y: 20, width: 100, height: 50 } },
    { create: () => new Circle("c1", -5, 10, 20), geometry: { cx: -5, cy: 10, r: 20 } },
    { create: () => new Ellipse("e1", 10, 20, 30, 40), geometry: { cx: 10, cy: 20, rx: 30, ry: 40 } },
    { create: () => new Line("edge", -1, 2, 3, 4), geometry: { x1: -1, y1: 2, x2: 3, y2: 4 } },
    { create: () => new Text("label", 10, 20, "keep me"), geometry: { x: 10, y: 20 } },
  ]) {
    it(`scales all geometry and edits allowed attributes of ${create().type}`, () => {
      const shape = create();
      shape.set("fill", "red");
      shape.set("stroke-width", "1.5");
      const before = shape.describe();
      assert.throws(() => shape.scale(0), { message: "scale factor must be positive" });
      assert.deepEqual(shape.describe(), before);

      shape.scale(2);
      const scaled = Object.fromEntries(Object.entries(geometry).map(([name, value]) => [name, value * 2]));
      assert.deepEqual(shape.describe().attributes, { ...scaled, fill: "red", "stroke-width": 1.5 });
      const copy = shape.clone();

      for (const attribute of Object.keys(geometry)) {
        shape.set(attribute, "1.25");
      }
      const edited = Object.fromEntries(Object.keys(geometry).map((name) => [name, 1.25]));
      assert.deepEqual(shape.describe().attributes, { ...edited, fill: "red", "stroke-width": 1.5 });
      assert.deepEqual(copy.describe().attributes, { ...scaled, fill: "red", "stroke-width": 1.5 });
      assert.equal(shape.describe().textContent, before.textContent);
      assert.throws(() => shape.set("id", "other"), { message: "unknown attribute: id" });
    });
  }

  it("updates individual styles without changing the old style or a cloned shape", () => {
    const style = new Style({ fill: "red" });
    const updated = style.withAttribute("stroke", "black").withAttribute("stroke-width", "0");
    assert.deepEqual(style.toAttributes(), { fill: "red" });
    assert.deepEqual(updated.toAttributes(), { fill: "red", stroke: "black", "stroke-width": 0 });

    const rect = new Rect("r1", 0, 0, 10, 20, updated);
    const copy = rect.clone();
    rect.set("fill", "blue");
    assert.equal(rect.describe().attributes.fill, "blue");
    assert.equal(copy.describe().attributes.fill, "red");
    assert.equal(rect.describe().attributes.stroke, "black");
  });

  it("sets text content including spaces and the empty string", () => {
    const text = new Text("label", 10, 20, "old");
    text.set("text", "  新 标题  ");
    const copy = text.clone();
    text.set("text", "");

    assert.equal(text.describe().textContent, "");
    assert.equal(copy.describe().textContent, "  新 标题  ");
    assert.deepEqual(text.describe().attributes, { x: 10, y: 20 });
  });

  it("rejects invalid attributes and values without changing the shape", () => {
    for (const { shape, attribute, value } of [
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "width", value: "-1" },
      { shape: new Circle("c1", 1, 2, 3), attribute: "r", value: "-1" },
      { shape: new Ellipse("e1", 1, 2, 3, 4), attribute: "rx", value: "-1" },
      { shape: new Ellipse("e1", 1, 2, 3, 4), attribute: "ry", value: "-1" },
      { shape: new Line("edge", 1, 2, 3, 4), attribute: "r", value: "1" },
      { shape: new Text("label", 1, 2, "old"), attribute: "font-size", value: "16" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "x", value: "" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "x", value: "not a number" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "x", value: "Infinity" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "fill", value: "" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "stroke-width", value: "" },
      { shape: new Rect("r1", 1, 2, 3, 4), attribute: "stroke-width", value: "-1" },
    ]) {
      const before = shape.describe();
      assert.throws(() => shape.set(attribute, value), DomainError);
      assert.deepEqual(shape.describe(), before);
    }
  });

  it("rejects invalid scale factors and overflow without partial changes", () => {
    const rect = new Rect("r1", 1, 2, Number.MAX_VALUE, 4);
    const before = rect.describe();
    for (const factor of [0, -1, Infinity, NaN, 2]) {
      assert.throws(() => rect.scale(factor), DomainError);
      assert.deepEqual(rect.describe(), before);
    }
  });
});

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Ellipse } from "../../src/domain/shapes/Ellipse.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("Circle and Ellipse", () => {
  for (const { name, create, geometry } of [
    {
      name: "circle",
      create: () => new Circle("c1", 10.5, 20.25, 8.5, new Style({ fill: "red" })),
      geometry: { cx: 10.5, cy: 20.25, r: 8.5 },
    },
    {
      name: "ellipse",
      create: () => new Ellipse("e1", -5.25, 7.5, 30, 12.5, new Style({ fill: "red" })),
      geometry: { cx: -5.25, cy: 7.5, rx: 30, ry: 12.5 },
    },
  ]) {
    it(`moves and independently clones a ${name} with fractional geometry and style`, () => {
      const shape = create();
      const copy = shape.clone();
      assert.equal(shape.type, name);
      assert.equal(copy.constructor, shape.constructor);
      assert.deepEqual(shape.describe().attributes, { fill: "red", ...geometry });

      shape.move(-2.5, 3.75);

      const moved = { fill: "red", ...geometry, cx: geometry.cx - 2.5, cy: geometry.cy + 3.75 };
      assert.deepEqual(shape.describe().attributes, moved);
      assert.deepEqual(copy.describe().attributes, { fill: "red", ...geometry });
      copy.move(1, -1);
      assert.deepEqual(shape.describe().attributes, moved);
    });

    it(`keeps both coordinates unchanged when a ${name} move fails`, () => {
      const shape = create();
      const before = shape.describe();

      assert.throws(() => shape.move(1, Infinity), DomainError);

      assert.deepEqual(shape.describe(), before);
    });
  }

  it("rejects negative radii and non-finite geometry", () => {
    for (const create of [
      () => new Circle("c1", 0, 0, -1),
      () => new Circle("c1", 0, 0, Infinity),
      () => new Circle("c1", NaN, 0, 1),
      () => new Ellipse("e1", 0, 0, -1, 1),
      () => new Ellipse("e1", 0, 0, 1, -1),
      () => new Ellipse("e1", 0, 0, 1, Infinity),
      () => new Ellipse("e1", 0, NaN, 1, 1),
    ]) {
      assert.throws(create, DomainError);
    }
  });

  it("accepts zero radii and preserves omitted styles", () => {
    assert.deepEqual(new Circle("c1", 1, 2, 0).clone().describe().attributes,
      { cx: 1, cy: 2, r: 0 });
    assert.deepEqual(new Ellipse("e1", 1, 2, 0, 0).clone().describe().attributes,
      { cx: 1, cy: 2, rx: 0, ry: 0 });
  });
});

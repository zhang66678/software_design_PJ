import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import type { Shape } from "../../src/domain/shapes/Shape.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("Rect", () => {
  it("preserves fractional and negative coordinates and zero dimensions", () => {
    const rect = new Rect("r1", -10.5, 20.25, 100.5, 0);

    assert.deepEqual(rect.describe(), {
      id: "r1",
      type: "rect",
      attributes: { x: -10.5, y: 20.25, width: 100.5, height: 0 },
    });
  });

  for (const id of ["", " ", "r 1", "r1\n"]) {
    it(`rejects invalid id ${JSON.stringify(id)}`, () => {
      assert.throws(() => new Rect(id, 0, 0, 10, 20), DomainError);
    });
  }

  for (const { x, y, width, height } of [
    { x: NaN, y: 0, width: 10, height: 20 },
    { x: Infinity, y: 0, width: 10, height: 20 },
    { x: 0, y: -Infinity, width: 10, height: 20 },
    { x: 0, y: 0, width: -1, height: 20 },
    { x: 0, y: 0, width: 10, height: -1 },
    { x: 0, y: 0, width: Infinity, height: 20 },
    { x: 0, y: 0, width: 10, height: NaN },
  ]) {
    it(`rejects invalid geometry (${x}, ${y}, ${width}, ${height})`, () => {
      assert.throws(() => new Rect("r1", x, y, width, height), DomainError);
    });
  }

  it("moves through the shared Shape interface", () => {
    const shape: Shape = new Rect("r1", 10, 20, 100, 50);

    shape.move(2.5, -4.25);

    assert.deepEqual(shape.describe().attributes, {
      x: 12.5,
      y: 15.75,
      width: 100,
      height: 50,
    });
  });

  for (const { dx, dy } of [
    { dx: NaN, dy: 0 },
    { dx: Infinity, dy: 0 },
    { dx: 0, dy: -Infinity },
    { dx: 1, dy: NaN },
  ]) {
    it(`does not partially move on invalid delta (${dx}, ${dy})`, () => {
      const rect = new Rect("r1", 10, 20, 100, 50);
      const before = rect.describe();

      assert.throws(() => rect.move(dx, dy), DomainError);
      assert.deepEqual(rect.describe(), before);
    });
  }

  it("rejects arithmetic overflow without changing either coordinate", () => {
    const rect = new Rect("r1", Number.MAX_VALUE, 0, 10, 20);
    const before = rect.describe();

    assert.throws(() => rect.move(Number.MAX_VALUE, 1), DomainError);
    assert.deepEqual(rect.describe(), before);
  });

  it("exposes identity and geometry only through getters", () => {
    const rect = new Rect("r1", 10, 20, 100, 50);
    const before = rect.describe();

    for (const key of ["id", "x", "y", "width", "height"]) {
      assert.equal(Reflect.set(rect, key, 999), false);
    }

    assert.deepEqual(rect.describe(), before);
    assert.deepEqual([rect.x, rect.y, rect.width, rect.height], [10, 20, 100, 50]);
  });

  it("returns isolated, immutable descriptions", () => {
    const rect = new Rect("r1", 10, 20, 100, 50, new Style({ fill: "red" }));
    const description = rect.describe();

    assert.equal(Reflect.set(description, "id", "changed"), false);
    assert.equal(Reflect.set(description.attributes, "x", 999), false);
    assert.equal(Reflect.set(description.attributes, "fill", "blue"), false);
    rect.move(5, 0);

    assert.equal(description.attributes.x, 10);
    assert.deepEqual(rect.describe().attributes, {
      fill: "red",
      x: 15,
      y: 20,
      width: 100,
      height: 50,
    });
  });

  it("clones concrete behavior, geometry and styles without sharing state", () => {
    const rect = new Rect(
      "r1",
      10,
      20,
      100,
      50,
      new Style({ fill: "red", stroke: "black", strokeWidth: 2 }),
    );
    const copy = rect.clone();

    assert.ok(copy instanceof Rect);
    assert.notEqual(copy, rect);
    assert.deepEqual(copy.describe(), rect.describe());
    copy.move(50, 0);
    rect.move(0, 5);

    assert.deepEqual([rect.x, rect.y], [10, 25]);
    assert.deepEqual([copy.x, copy.y], [60, 20]);
    assert.equal(copy.describe().attributes.fill, "red");
  });
});

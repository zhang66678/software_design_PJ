import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("Style", () => {
  it("preserves omitted SVG styles instead of inserting defaults", () => {
    assert.deepEqual(new Style().toAttributes(), {});
  });

  it("preserves explicitly supplied styles, including zero stroke width", () => {
    const style = new Style({
      fill: "#4a90d9",
      stroke: "none",
      strokeWidth: 0,
    });

    assert.deepEqual(style.toAttributes(), {
      fill: "#4a90d9",
      stroke: "none",
      "stroke-width": 0,
    });
  });

  it("returns immutable attributes", () => {
    const style = new Style({ fill: "red" });
    const attributes = style.toAttributes();

    assert.equal(Reflect.set(attributes, "fill", "blue"), false);
    assert.deepEqual(style.toAttributes(), { fill: "red" });
  });

  it("clones style values into a separate object", () => {
    const style = new Style({ stroke: "black", strokeWidth: 1.5 });
    const copy = style.clone();

    assert.notEqual(copy, style);
    assert.deepEqual(copy.toAttributes(), style.toAttributes());
  });

  for (const color of ["", "   "]) {
    it(`rejects empty color ${JSON.stringify(color)}`, () => {
      assert.throws(() => new Style({ fill: color }), DomainError);
      assert.throws(() => new Style({ stroke: color }), DomainError);
    });
  }

  for (const strokeWidth of [-1, NaN, Infinity, -Infinity]) {
    it(`rejects invalid stroke width ${strokeWidth}`, () => {
      assert.throws(() => new Style({ strokeWidth }), DomainError);
    });
  }
});

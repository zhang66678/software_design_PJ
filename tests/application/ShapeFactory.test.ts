import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ShapeFactory } from "../../src/application/factories/ShapeFactory.js";
import { Rect } from "../../src/domain/shapes/Rect.js";

describe("ShapeFactory", () => {
  const factory = new ShapeFactory();

  it("creates a concrete rectangle with geometry and an explicit hex fill", () => {
    const shape = factory.create("rect", "r1", ["10", "20", "100", "50", "#4a90d9"]);

    assert.ok(shape instanceof Rect);
    assert.deepEqual(shape.describe(), {
      id: "r1",
      type: "rect",
      attributes: { x: 10, y: 20, width: 100, height: 50, fill: "#4a90d9" },
    });
  });

  it("parses fractional, negative and scientific values while preserving omitted styles", () => {
    const shape = factory.create("rect", "r1", ["-10.25", ".5", "1e2", "0"]);

    assert.deepEqual(shape.describe().attributes, {
      x: -10.25, y: 0.5, width: 100, height: 0,
    });
  });

  for (const type of ["hexagon", "box", "Rect"]) {
    it(`rejects unregistered type ${type}`, () => {
      assert.throws(() => factory.create(type, "r1", ["0", "0", "1", "1"]), {
        name: "ApplicationError",
        message: `unknown shape type: ${type} (is the plugin loaded?)`,
      });
    });
  }

  for (const parameters of [
    ["10", "20", "100"],
    ["10", "20", "100", "50", "red", "unexpected"],
  ]) {
    it(`rejects a rectangle with ${parameters.length} geometry/style parameters`, () => {
      assert.throws(() => factory.create("rect", "r1", parameters), {
        name: "ApplicationError",
        message: "usage: create rect <id> <x> <y> <w> <h> [fill]",
      });
    });
  }

  for (const value of ["", "   ", "abc", "NaN", "Infinity", "1e309", "10px"]) {
    it(`rejects invalid numeric input ${JSON.stringify(value)}`, () => {
      assert.throws(() => factory.create("rect", "r1", [value, "20", "100", "50"]), {
        name: "ApplicationError",
        message: "x must be a finite number",
      });
    });
  }

  for (const { index, name } of [
    { index: 1, name: "y" },
    { index: 2, name: "width" },
    { index: 3, name: "height" },
  ]) {
    it(`validates and names the ${name} argument`, () => {
      const parameters = ["10", "20", "100", "50"];
      parameters[index] = "invalid";

      assert.throws(() => factory.create("rect", "r1", parameters), {
        message: `${name} must be a finite number`,
      });
    });
  }

  it("uses domain validation for negative rectangle dimensions", () => {
    assert.throws(() => factory.create("rect", "r1", ["0", "0", "-1", "50"]), {
      name: "DomainError",
      message: "rectangle dimensions must be non-negative",
    });
  });

  it("rejects an explicitly empty fill instead of treating it as omitted", () => {
    assert.throws(() => factory.create("rect", "r1", ["0", "0", "100", "50", ""]), {
      name: "DomainError",
      message: "style color must not be empty",
    });
  });
});

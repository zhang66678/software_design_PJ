import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";

describe("Line and Text", () => {
  it("moves both line endpoints and keeps its clone independent", () => {
    const line = new Line("edge", -1.5, 2, 30, 40.5, new Style({ stroke: "black" }));
    const copy = line.clone();

    line.move(5, -2);

    assert.ok(copy instanceof Line);
    assert.deepEqual(line.describe().attributes, { x1: 3.5, y1: 0, x2: 35, y2: 38.5, stroke: "black" });
    assert.deepEqual(copy.describe().attributes, { x1: -1.5, y1: 2, x2: 30, y2: 40.5, stroke: "black" });
  });

  it("does not change any endpoint when the final endpoint overflows", () => {
    const line = new Line("edge", 0, 0, Number.MAX_VALUE, 1);
    const before = line.describe();

    assert.throws(() => line.move(Number.MAX_VALUE, 1), DomainError);

    assert.deepEqual(line.describe(), before);
  });

  it("preserves text content separately from attributes when moving and cloning", () => {
    const content = '  开始 "流程" & <结束>  ';
    const text = new Text("label", -1.5, 2.25, content, new Style({ fill: "blue" }));
    const copy = text.clone();

    text.move(5, -2);

    assert.ok(copy instanceof Text);
    assert.deepEqual(text.describe(), {
      id: "label", type: "text", attributes: { x: 3.5, y: 0.25, fill: "blue" }, textContent: content,
    });
    assert.deepEqual(copy.describe().attributes, { x: -1.5, y: 2.25, fill: "blue" });
    assert.equal(copy.describe().textContent, content);
    assert.equal(Reflect.set(text.describe(), "textContent", "changed"), false);
  });

  it("accepts empty text and zero-length lines without inserting styles", () => {
    assert.deepEqual(new Text("empty", 0, 0, "").clone().describe(), {
      id: "empty", type: "text", attributes: { x: 0, y: 0 }, textContent: "",
    });
    assert.deepEqual(new Line("point", 0, 0, 0, 0).describe().attributes,
      { x1: 0, y1: 0, x2: 0, y2: 0 });
  });

  it("rejects non-finite geometry", () => {
    for (const create of [
      () => new Line("edge", 0, 0, NaN, 1),
      () => new Line("edge", Infinity, 0, 1, 1),
      () => new Text("label", 0, Infinity, "hello"),
    ]) {
      assert.throws(create, DomainError);
    }
  });

  it("keeps text position and content unchanged on a failed move", () => {
    const text = new Text("label", Number.MAX_VALUE, 0, "开始");
    const before = text.describe();

    assert.throws(() => text.move(Number.MAX_VALUE, 1), DomainError);

    assert.deepEqual(text.describe(), before);
  });
});

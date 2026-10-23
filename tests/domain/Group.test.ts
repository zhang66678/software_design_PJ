import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Ellipse } from "../../src/domain/shapes/Ellipse.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import type { Shape } from "../../src/domain/shapes/Shape.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";

describe("Group", () => {
  it("moves and scales nested mixed shapes through the shared interface", () => {
    const rect = new Rect("rect", 1, 2, 3, 4, new Style({ fill: "red" }));
    const circle = new Circle("circle", 2, 3, 4);
    const ellipse = new Ellipse("ellipse", 3, 4, 5, 6);
    const line = new Line("line", 1, 2, 3, 4);
    const text = new Text("text", 4, 5, "开始");
    const group: Shape = new Group("outer", [rect, new Group("inner", [circle, ellipse, line, text])]);

    group.set("fill", "blue");
    group.move(10, -2);
    group.scale(2);

    assert.deepEqual([...group.walk()].map((shape) => shape.id),
      ["outer", "rect", "inner", "circle", "ellipse", "line", "text"]);
    assert.deepEqual(rect.describe().attributes, { x: 22, y: 0, width: 6, height: 8, fill: "red" });
    assert.deepEqual(circle.describe().attributes, { cx: 24, cy: 2, r: 8 });
    assert.deepEqual(ellipse.describe().attributes, { cx: 26, cy: 4, rx: 10, ry: 12 });
    assert.deepEqual(line.describe().attributes, { x1: 22, y1: 0, x2: 26, y2: 4 });
    assert.deepEqual(text.describe(), { id: "text", type: "text", attributes: { x: 28, y: 6 }, textContent: "开始" });
    assert.deepEqual(group.describe(), { id: "outer", type: "g", attributes: { fill: "blue" } });
  });

  it("copies child lists and produces new structure without mutating the old group", () => {
    const rect = new Rect("r1", 0, 0, 1, 1);
    const children: Shape[] = [rect];
    const group = new Group("g1", children, new Style({ stroke: "black" }));
    children.length = 0;

    assert.equal(Reflect.set(group.getChildren(), "length", 0), false);
    const updated = group.withChildren([...group.getChildren(), new Group("g2")]);
    assert.deepEqual(group.getChildren(), [rect]);
    assert.deepEqual(updated.getChildren().map((shape) => shape.id), ["r1", "g2"]);
    updated.set("stroke", "red");
    assert.equal(group.describe().attributes.stroke, "black");
    assert.equal(rect.isContainer, false);
    assert.deepEqual(rect.getChildren(), []);
    assert.throws(() => rect.withChildren([new Group("child")]), { message: "not a container: r1" });
  });

  it("rejects duplicate ids across the group and all of its descendants", () => {
    for (const children of [
      [new Rect("group", 0, 0, 1, 1)],
      [new Group("a", [new Rect("same", 0, 0, 1, 1)]), new Group("b", [new Text("same", 0, 0, "")])],
    ]) {
      assert.throws(() => new Group("group", children), { message: /^id already exists:/u });
    }
  });

  it("clones nested geometry, text and styles independently", () => {
    const text = new Text("label", 2, 3, "old");
    const group = new Group("outer", [new Group("inner", [text])], new Style({ fill: "red" }));
    const copy = group.clone();
    copy.move(10, 20);
    copy.set("fill", "blue");
    text.set("text", "changed");

    const clonedText = [...copy.walk()].find((shape) => shape.id === "label");
    assert.ok(clonedText);
    assert.notEqual(copy.getChildren()[0], group.getChildren()[0]);
    assert.notEqual(clonedText, text);
    assert.deepEqual(clonedText.describe(), {
      id: "label", type: "text", attributes: { x: 12, y: 23 }, textContent: "old",
    });
    assert.deepEqual(text.describe().attributes, { x: 2, y: 3 });
    assert.equal(group.describe().attributes.fill, "red");
    assert.equal(copy.describe().attributes.fill, "blue");
  });

  it("does not partly move earlier children when a later nested child overflows", () => {
    const first = new Rect("first", 1, 2, 3, 4);
    const last = new Rect("last", Number.MAX_VALUE, 0, 1, 1);
    const group = new Group("outer", [first, new Group("inner", [last])]);
    const before = [...group.walk()].map((shape) => shape.describe());

    assert.throws(() => group.move(Number.MAX_VALUE, 1), { message: "rectangle geometry must be finite" });
    assert.deepEqual([...group.walk()].map((shape) => shape.describe()), before);
    assert.equal(group.getChildren()[0], first);
  });

  it("does not partly scale earlier children when a later child overflows", () => {
    const group = new Group("outer", [
      new Circle("first", 1, 2, 3),
      new Group("inner", [new Rect("last", 1, 2, Number.MAX_VALUE, 4)]),
    ]);
    const before = [...group.walk()].map((shape) => shape.describe());

    assert.throws(() => group.scale(2), { message: "rectangle geometry must be finite" });
    assert.deepEqual([...group.walk()].map((shape) => shape.describe()), before);
  });

  it("validates empty-group transforms and rejects non-style attributes", () => {
    const group = new Group("empty");
    group.move(-2, 3);
    group.scale(2);
    for (const factor of [0, -1, NaN, Infinity]) {
      assert.throws(() => group.scale(factor), { message: "scale factor must be positive" });
    }
    for (const [dx, dy] of [[NaN, 0], [0, Infinity]] as const) {
      assert.throws(() => group.move(dx, dy), { message: "move offsets must be finite numbers" });
    }
    assert.throws(() => group.set("x", "1"), { message: "unknown attribute: x" });
    assert.deepEqual(group.describe().attributes, {});
  });
});

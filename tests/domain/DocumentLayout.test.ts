import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("Document layout", () => {
  let document: SvgDocument;

  beforeEach(() => {
    document = new SvgDocument(400, 300);
    document.add(new Rect("before", 0, 0, 1, 1));
    document.add(new Group("scene", [
      new Rect("a", 1, 2, 3, 4),
      new Group("node", [new Rect("nested", 5, 6, 7, 8)], new Style({ fill: "red" })),
      new Rect("b", 0, 0, 1, 1),
    ]));
    document.add(new Group("other"));
    document.add(new Rect("after", 0, 0, 1, 1));
  });

  it("moves root containers to the front and back without changing their subtrees", () => {
    const scene = document.getShape("scene");
    const expected = [...scene.walk()].map((shape) => shape.describe());

    assert.equal(document.bringToFront("scene"), scene);
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["before", "other", "after", "scene"]);
    document.sendToBack("scene");
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["scene", "before", "other", "after"]);
    assert.deepEqual([...scene.walk()].map((shape) => shape.describe()), expected);
    assert.equal(document.getParent("scene"), undefined);
    assert.equal(document.getParent("nested")?.id, "node");
  });

  it("reorders only the siblings of nested leaves and containers", () => {
    const node = document.getShape("node");
    document.bringToFront("a");
    assert.deepEqual(document.getShape("scene").getChildren().map((shape) => shape.id), ["node", "b", "a"]);
    document.sendToBack("b");
    assert.deepEqual(document.getShape("scene").getChildren().map((shape) => shape.id), ["b", "node", "a"]);
    document.bringToFront("node");
    assert.deepEqual(document.getShape("scene").getChildren().map((shape) => shape.id), ["b", "a", "node"]);
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["before", "scene", "other", "after"]);
    assert.equal(document.getShape("node"), node);
    assert.equal(document.getParent("node")?.id, "scene");
    assert.equal(node.describe().attributes.fill, "red");
    assert.deepEqual(document.getShape("other").getChildren(), []);
  });

  it("rejects missing reorder targets without changing any parent or order", () => {
    const snapshot = () => document.getShapes().flatMap((root) => [...root.walk()].map((shape) => ({
      ...shape.describe(), parent: document.getParent(shape.id)?.id,
    })));
    const before = snapshot();
    for (const action of [() => document.bringToFront("missing"), () => document.sendToBack("missing")]) {
      assert.throws(action, { message: "no such shape: missing" });
      assert.deepEqual(snapshot(), before);
    }
  });

  it("changes dimensions in an independent document while preserving the complete tree", () => {
    const resized = document.withSize(800.5, 600.25);

    assert.deepEqual([resized.width, resized.height], [800.5, 600.25]);
    assert.deepEqual([document.width, document.height], [400, 300]);
    assert.deepEqual(resized.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())),
      document.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())));
    assert.equal(resized.getParent("nested")?.id, "node");
    resized.getShape("nested").move(10, 20);
    assert.deepEqual(document.getShape("nested").describe().attributes, { x: 5, y: 6, width: 7, height: 8 });
  });

  it("keeps the original size and tree when new dimensions are invalid", () => {
    const before = document.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe()));
    for (const [width, height] of [[0, 300], [400, -1], [NaN, 300], [400, Infinity]] as const) {
      assert.throws(() => document.withSize(width, height), { message: "canvas dimensions must be positive finite numbers" });
      assert.deepEqual([document.width, document.height], [400, 300]);
      assert.deepEqual(document.getShapes().flatMap((root) => [...root.walk()].map((shape) => shape.describe())), before);
    }
  });
});

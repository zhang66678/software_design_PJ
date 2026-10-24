import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("Document grouping", () => {
  let document: SvgDocument;

  beforeEach(() => {
    document = new SvgDocument();
    document.add(new Rect("before", 0, 0, 1, 1));
    document.add(new Group("scene", [
      new Rect("left", 1, 2, 3, 4),
      new Group("branchA", [
        new Rect("a1", 10, 20, 30, 40, new Style({ fill: "red" })),
        new Rect("a2", 0, 0, 1, 1),
      ]),
      new Rect("middle", 0, 0, 1, 1),
      new Group("branchB", [new Rect("b1", 5, 6, 7, 8)], new Style({ stroke: "black" })),
      new Rect("right", 0, 0, 1, 1),
    ]));
    document.add(new Rect("after", 0, 0, 1, 1));
  });

  it("groups siblings at the earliest selected position in original sibling order", () => {
    const branch = document.getShape("branchB");
    const group = document.group("bundle", ["branchB", "left"]);

    assert.deepEqual(group.getChildren().map((shape) => shape.id), ["left", "branchB"]);
    assert.deepEqual(document.getShape("scene").getChildren().map((shape) => shape.id),
      ["bundle", "branchA", "middle", "right"]);
    assert.equal(document.getParent("bundle")?.id, "scene");
    assert.equal(document.getParent("left"), group);
    assert.equal(document.getShape("branchB"), branch);
    assert.equal(branch.describe().attributes.stroke, "black");
    assert.equal(document.getParent("b1"), branch);
  });

  it("groups root siblings at their earliest slot and refuses top-level ungroup", () => {
    document.group("bundle", ["after", "before"]);

    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["bundle", "scene"]);
    assert.deepEqual(document.getShape("bundle").getChildren().map((shape) => shape.id), ["before", "after"]);
    assert.throws(() => document.ungroup("bundle"), { message: "cannot ungroup top-level container: bundle" });
    assert.equal(document.getParent("before")?.id, "bundle");
  });

  it("groups different parents in document traversal order at the end of the root list", () => {
    document.group("bundle", ["after", "b1", "a1"]);

    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["before", "scene", "bundle"]);
    assert.deepEqual(document.getShape("bundle").getChildren().map((shape) => shape.id), ["a1", "b1", "after"]);
    assert.deepEqual(document.getShape("branchA").getChildren().map((shape) => shape.id), ["a2"]);
    assert.deepEqual(document.getShape("branchB").getChildren(), []);
    assert.deepEqual(document.getShape("a1").describe().attributes, { x: 10, y: 20, width: 30, height: 40, fill: "red" });
  });

  it("rejects all invalid group selections before changing the tree", () => {
    const snapshot = () => document.getShapes().flatMap((root) => [...root.walk()].map((shape) => ({
      ...shape.describe(), parent: document.getParent(shape.id)?.id,
    })));
    const before = snapshot();
    for (const { id, targets, message } of [
      { id: "a2", targets: ["a1"], message: "id already exists: a2" },
      { id: "bundle", targets: [], message: "group requires at least one shape" },
      { id: "bundle", targets: ["a1", "missing"], message: "no such shape: missing" },
      { id: "bundle", targets: ["a1", "a1"], message: "duplicate group target: a1" },
      { id: "bundle", targets: ["a1", "branchA"], message: "cannot group a container into its own descendant: branchA" },
      { id: "", targets: ["a1"], message: "id must not be empty" },
      { id: "bad name", targets: ["a1"], message: "id must not contain whitespace" },
    ]) {
      assert.throws(() => document.group(id, targets), { message });
      assert.deepEqual(snapshot(), before);
    }
  });

  it("promotes children into the removed group's exact position", () => {
    const group = document.ungroup("branchA");

    assert.deepEqual(group.getChildren().map((shape) => shape.id), ["a1", "a2"]);
    assert.deepEqual(document.getShape("scene").getChildren().map((shape) => shape.id),
      ["left", "a1", "a2", "middle", "branchB", "right"]);
    assert.equal(document.getParent("a1")?.id, "scene");
    assert.equal(document.getParent("b1")?.id, "branchB");
    assert.equal(document.getShape("a1").describe().attributes.fill, "red");
    assert.throws(() => document.getShape("branchA"), { message: "no such shape: branchA" });
  });

  it("supports single-target groups and empty nested ungroup", () => {
    document.group("single", ["a1"]);
    assert.deepEqual(document.getShape("branchA").getChildren().map((shape) => shape.id), ["single", "a2"]);
    document.ungroup("single");
    document.add(new Group("empty"), "branchA");
    assert.deepEqual(document.ungroup("empty").getChildren(), []);
    assert.deepEqual(document.getShape("branchA").getChildren().map((shape) => shape.id), ["a1", "a2"]);
  });

  it("rejects root groups, leaves and missing ungroup targets without mutation", () => {
    const snapshot = () => document.getShapes().flatMap((root) => [...root.walk()].map((shape) => ({
      ...shape.describe(), parent: document.getParent(shape.id)?.id,
    })));
    const before = snapshot();
    for (const { id, message } of [
      { id: "scene", message: "cannot ungroup top-level container: scene" },
      { id: "a1", message: "not a container: a1" },
      { id: "missing", message: "no such container: missing" },
    ]) {
      assert.throws(() => document.ungroup(id), { message });
      assert.deepEqual(snapshot(), before);
    }
  });
});

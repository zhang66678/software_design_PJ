import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { DomainError } from "../../src/domain/errors/DomainError.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("SvgDocument", () => {
  it("creates a default empty 800 by 600 canvas", () => {
    const document = new SvgDocument();

    assert.deepEqual([document.width, document.height], [800, 600]);
    assert.deepEqual(document.getShapes(), []);
  });

  it("accepts positive fractional canvas dimensions", () => {
    const document = new SvgDocument(400.5, 300.25);

    assert.deepEqual([document.width, document.height], [400.5, 300.25]);
  });

  for (const { width, height } of [
    { width: 0, height: 600 },
    { width: 800, height: 0 },
    { width: -1, height: 600 },
    { width: 800, height: -1 },
    { width: NaN, height: 600 },
    { width: 800, height: Infinity },
  ]) {
    it(`rejects invalid canvas size (${width}, ${height})`, () => {
      assert.throws(() => new SvgDocument(width, height), DomainError);
    });
  }

  it("preserves insertion order and resolves existing shapes by id", () => {
    const document = new SvgDocument();
    const first = new Rect("r1", 0, 0, 10, 20);
    const second = new Rect("r2", 20, 0, 10, 20);

    document.add(first);
    document.add(second);

    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["r1", "r2"]);
    assert.equal(document.getShape("r1"), first);
    assert.equal(document.getShape("r2"), second);
  });

  it("rejects duplicate ids without replacing or appending a shape", () => {
    const document = new SvgDocument();
    const original = new Rect("r1", 0, 0, 10, 20);
    document.add(original);

    assert.throws(() => document.add(new Rect("r1", 99, 99, 1, 1)), {
      name: "DomainError",
      message: "id already exists: r1",
    });
    assert.deepEqual(document.getShapes(), [original]);
    assert.equal(document.getShape("r1"), original);
    assert.equal(original.describe().attributes.x, 0);
  });

  it("keeps ids case-sensitive", () => {
    const document = new SvgDocument();
    const lower = new Rect("r1", 0, 0, 10, 20);
    const upper = new Rect("R1", 0, 0, 30, 40);

    document.add(lower);
    document.add(upper);

    assert.equal(document.getShape("r1"), lower);
    assert.equal(document.getShape("R1"), upper);
  });

  it("reports a missing shape without changing the document", () => {
    const document = new SvgDocument();

    assert.throws(() => document.getShape("r9"), {
      name: "DomainError",
      message: "no such shape: r9",
    });
    assert.deepEqual(document.getShapes(), []);
  });

  it("returns an immutable copy of the ordered shape list", () => {
    const document = new SvgDocument();
    const first = new Rect("r1", 0, 0, 10, 20);
    document.add(first);
    const shapes = document.getShapes();

    assert.equal(Reflect.set(shapes, 0, new Rect("other", 0, 0, 1, 1)), false);
    assert.equal(Reflect.set(shapes, "length", 0), false);
    document.add(new Rect("r2", 0, 0, 10, 20));

    assert.deepEqual(shapes, [first]);
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["r1", "r2"]);
  });

  it("prevents direct assignment to canvas dimensions", () => {
    const document = new SvgDocument();

    assert.equal(Reflect.set(document, "width", 1), false);
    assert.equal(Reflect.set(document, "height", 1), false);
    assert.deepEqual([document.width, document.height], [800, 600]);
  });

  it("clones the document with independent lists and concrete shapes", () => {
    const document = new SvgDocument(400, 300);
    document.add(new Rect("r1", 10, 20, 100, 50, new Style({ fill: "red" })));
    const copy = document.clone();

    assert.notEqual(copy, document);
    assert.deepEqual([copy.width, copy.height], [400, 300]);
    assert.ok(copy.getShape("r1") instanceof Rect);
    assert.notEqual(copy.getShape("r1"), document.getShape("r1"));
    assert.deepEqual(
      copy.getShape("r1").describe(),
      document.getShape("r1").describe(),
    );

    copy.getShape("r1").move(30, 0);
    copy.add(new Rect("r2", 0, 0, 10, 10));
    document.getShape("r1").move(0, 5);

    assert.deepEqual(document.getShape("r1").describe().attributes, {
      x: 10,
      y: 25,
      width: 100,
      height: 50,
      fill: "red",
    });
    assert.deepEqual(copy.getShape("r1").describe().attributes, {
      x: 40,
      y: 20,
      width: 100,
      height: 50,
      fill: "red",
    });
    assert.equal(document.getShapes().length, 1);
    assert.equal(copy.getShapes().length, 2);
  });

  it("resolves nested shapes and their current parents after attaching children", () => {
    const document = new SvgDocument();
    document.add(new Group("outer", [new Group("inner")]));
    const rect = new Rect("r1", 1, 2, 3, 4);
    document.add(rect, "inner");
    document.add(new Rect("R1", 0, 0, 1, 1), "outer");

    assert.equal(document.getShape("r1"), rect);
    assert.equal(document.getParent("outer"), undefined);
    assert.equal(document.getParent("inner"), document.getShape("outer"));
    assert.equal(document.getParent("r1"), document.getShape("inner"));
    assert.equal(document.getContainer("inner"), document.getShape("inner"));
    assert.deepEqual([...document.getShape("outer").walk()].map((shape) => shape.id), ["outer", "inner", "r1", "R1"]);
    assert.throws(() => document.getParent("missing"), { message: "no such shape: missing" });
  });

  it("checks every incoming id against the entire document before attaching", () => {
    const document = new SvgDocument();
    document.add(new Group("outer", [new Group("inner", [new Rect("r1", 1, 2, 3, 4)])]));
    document.add(new Group("other"));
    const roots = document.getShapes();

    for (const candidate of [new Rect("r1", 0, 0, 1, 1), new Group("new", [new Rect("r1", 0, 0, 1, 1)])]) {
      assert.throws(() => document.add(candidate), { message: "id already exists: r1" });
      assert.throws(() => document.add(candidate, "other"), { message: "id already exists: r1" });
    }
    assert.throws(() => document.add(document.getShape("outer"), "inner"), { message: "id already exists: outer" });
    assert.deepEqual(document.getShapes(), roots);
    assert.deepEqual(document.getShape("other").getChildren(), []);
  });

  it("rejects missing containers and leaf targets without changing the tree", () => {
    const document = new SvgDocument();
    const rect = new Rect("r1", 0, 0, 1, 1);
    document.add(rect);

    assert.throws(() => document.add(new Group("g1"), "missing"), { message: "no such container: missing" });
    assert.throws(() => document.add(new Group("g1"), "r1"), { message: "not a container: r1" });
    assert.deepEqual(document.getShapes(), [rect]);
  });

  it("detaches complete subtrees and permits reattaching them at another parent", () => {
    const document = new SvgDocument();
    document.add(new Rect("before", 0, 0, 1, 1));
    document.add(new Group("outer", [
      new Group("inner", [new Rect("r1", 1, 2, 3, 4)]),
      new Rect("r2", 5, 6, 7, 8),
    ]));
    document.add(new Group("target"));
    const detached = document.remove("inner");

    assert.deepEqual(document.getShape("outer").getChildren().map((shape) => shape.id), ["r2"]);
    assert.throws(() => document.getShape("r1"), { message: "no such shape: r1" });
    assert.throws(() => document.remove("inner"), { message: "no such shape: inner" });
    document.add(detached, "target");
    assert.equal(document.getShape("inner"), detached);
    assert.equal(document.getParent("inner"), document.getShape("target"));
    assert.equal(document.getParent("r1"), detached);

    document.remove("outer");
    assert.deepEqual(document.getShapes().map((shape) => shape.id), ["before", "target"]);
    assert.throws(() => document.getShape("r2"), { message: "no such shape: r2" });
  });

  it("keeps document structure valid when a new group is derived from a returned group", () => {
    const document = new SvgDocument();
    document.add(new Group("outer", [new Rect("r1", 0, 0, 1, 1)]));
    document.add(new Rect("r2", 0, 0, 1, 1));
    const derived = document.getContainer("outer").withChildren([document.getShape("r2")]);

    assert.deepEqual(derived.getChildren().map((shape) => shape.id), ["r2"]);
    assert.equal(document.getParent("r1"), document.getShape("outer"));
    assert.equal(document.getParent("r2"), undefined);
    assert.deepEqual(document.getShape("outer").getChildren().map((shape) => shape.id), ["r1"]);
  });
});

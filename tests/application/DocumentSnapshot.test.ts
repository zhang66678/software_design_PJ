import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DocumentSnapshot } from "../../src/application/history/DocumentSnapshot.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";

describe("DocumentSnapshot", () => {
  it("preserves dimensions, root order, concrete shapes and style omission", () => {
    const document = new SvgDocument(400.5, 300.25);
    document.add(new Rect("r1", 10, 20, 100, 50, new Style({ fill: "red" })));
    document.add(new Rect("r2", -5, 0, 0, 10));

    const restored = new DocumentSnapshot(document).restore();

    assert.deepEqual([restored.width, restored.height], [400.5, 300.25]);
    assert.deepEqual(
      restored.getShapes().map((shape) => shape.describe()),
      document.getShapes().map((shape) => shape.describe()),
    );
    assert.ok(restored.getShape("r1") instanceof Rect);
    restored.getShape("r1").move(2, 3);
    assert.equal(restored.getShape("r1").describe().attributes.x, 12);
  });

  it("isolates a snapshot from changes to the original document", () => {
    const document = new SvgDocument();
    const rect = new Rect("r1", 10, 20, 100, 50);
    document.add(rect);
    const snapshot = new DocumentSnapshot(document);

    rect.move(50, 60);
    document.add(new Rect("r2", 0, 0, 10, 10));

    assert.deepEqual(
      snapshot.restore().getShapes().map((shape) => shape.describe()),
      [{
        id: "r1",
        type: "rect",
        attributes: { x: 10, y: 20, width: 100, height: 50 },
      }],
    );
  });

  it("restores independent documents on every call", () => {
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50));
    const snapshot = new DocumentSnapshot(document);
    const first = snapshot.restore();
    const second = snapshot.restore();

    first.getShape("r1").move(50, 0);
    first.add(new Rect("r2", 0, 0, 10, 10));
    second.getShape("r1").move(0, 30);

    assert.equal(first.getShape("r1").describe().attributes.x, 60);
    assert.equal(second.getShape("r1").describe().attributes.x, 10);
    assert.equal(second.getShapes().length, 1);
    assert.equal(snapshot.restore().getShape("r1").describe().attributes.y, 20);
  });

  it("preserves nested order, parentage and styles without sharing restored subtrees", () => {
    const document = new SvgDocument();
    document.add(new Group("outer", [
      new Rect("r1", 1, 2, 3, 4),
      new Group("inner", [new Rect("r2", 5, 6, 7, 8)], new Style({ fill: "red" })),
    ]));
    const snapshot = new DocumentSnapshot(document);
    const first = snapshot.restore();
    const second = snapshot.restore();
    first.getShape("outer").move(10, 20);
    first.remove("inner");
    document.getShape("inner").set("fill", "blue");
    document.add(new Rect("r3", 0, 0, 1, 1), "inner");

    assert.deepEqual([...second.getShape("outer").walk()].map((shape) => shape.id), ["outer", "r1", "inner", "r2"]);
    assert.equal(second.getParent("r2"), second.getShape("inner"));
    assert.equal(second.getShape("inner").describe().attributes.fill, "red");
    assert.deepEqual(second.getShape("r2").describe().attributes, { x: 5, y: 6, width: 7, height: 8 });
    assert.equal(first.getShape("r1").describe().attributes.x, 11);
    assert.notEqual(second.getShape("inner"), snapshot.restore().getShape("inner"));
  });
});

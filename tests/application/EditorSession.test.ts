import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { EditorSession } from "../../src/application/session/EditorSession.js";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { UnclonableRect } from "../support/UnclonableRect.js";

describe("EditorSession", () => {
  it("reports an absent document for reads and captures", () => {
    const session = new EditorSession();

    for (const action of [() => session.getDocument(), () => session.capture()]) {
      assert.throws(action, {
        name: "ApplicationError",
        message: "no document. use 'init' or 'read' first",
      });
    }
  });

  it("takes ownership of an independent document when replacing it", () => {
    const session = new EditorSession();
    const document = new SvgDocument(400, 300);
    const rect = new Rect("r1", 10, 20, 100, 50);
    document.add(rect);
    session.replaceDocument(document);

    rect.move(99, 99);
    document.add(new Rect("r2", 0, 0, 10, 10));

    assert.deepEqual([session.getDocument().width, session.getDocument().height], [400, 300]);
    assert.deepEqual(session.getDocument().getShapes().map((shape) => shape.id), ["r1"]);
    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
  });

  it("returns editable copies without exposing the current state", () => {
    const session = new EditorSession();
    const document = new SvgDocument();
    document.add(new Rect("r1", 10, 20, 100, 50));
    session.replaceDocument(document);

    const readCopy = session.getDocument();
    readCopy.getShape("r1").move(50, 0);
    readCopy.add(new Rect("r2", 0, 0, 10, 10));

    assert.equal(session.getDocument().getShape("r1").describe().attributes.x, 10);
    assert.equal(session.getDocument().getShapes().length, 1);
  });

  it("restores a captured document including canvas size and root order", () => {
    const session = new EditorSession();
    const document = new SvgDocument(400, 300);
    document.add(new Rect("r2", 20, 0, 30, 40));
    document.add(new Rect("r1", 10, 20, 100, 50));
    session.replaceDocument(document);
    const before = session.capture();

    session.replaceDocument(new SvgDocument(900, 700));
    session.restore(before);

    const restored = session.getDocument();
    assert.deepEqual([restored.width, restored.height], [400, 300]);
    assert.deepEqual(restored.getShapes().map((shape) => shape.id), ["r2", "r1"]);
    assert.ok(restored.getShape("r1") instanceof Rect);
  });

  it("keeps the current file path during edit restoration and clears it for a new document", () => {
    const session = new EditorSession();
    session.replaceDocument(new SvgDocument(400, 300), "read.svg");
    const snapshot = session.capture();
    session.setFilePath("saved.svg");
    session.restore(snapshot);

    assert.equal(session.filePath, "saved.svg");
    session.replaceDocument(new SvgDocument());
    assert.equal(session.filePath, undefined);
  });

  it("preserves both the document and its file path when replacement cannot be captured", () => {
    const session = new EditorSession();
    session.replaceDocument(new SvgDocument(400, 300), "original.svg");
    const invalid = new SvgDocument();
    invalid.add(new UnclonableRect("broken", 0, 0, 1, 1));

    assert.throws(() => session.replaceDocument(invalid, "new.svg"), { message: "cannot clone test rectangle" });
    assert.equal(session.filePath, "original.svg");
    assert.deepEqual([session.getDocument().width, session.getDocument().height], [400, 300]);
  });
});

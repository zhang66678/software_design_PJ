import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SvgDocument } from "../../src/domain/document/SvgDocument.js";
import { Circle } from "../../src/domain/shapes/Circle.js";
import { Ellipse } from "../../src/domain/shapes/Ellipse.js";
import { Group } from "../../src/domain/shapes/Group.js";
import { Line } from "../../src/domain/shapes/Line.js";
import { Rect } from "../../src/domain/shapes/Rect.js";
import { Style } from "../../src/domain/shapes/Style.js";
import { Text } from "../../src/domain/shapes/Text.js";
import { SvgCodec } from "../../src/infrastructure/svg/SvgCodec.js";

describe("SvgCodec", () => {
  const codec = new SvgCodec();

  it("encodes all six types with canvas metadata, nested order and explicit styles", () => {
    const document = new SvgDocument(400, 200);
    document.add(new Group("scene", [
      new Rect("r1", 1, 2, 30, 40, new Style({ fill: "#eee" })),
      new Circle("c1", 100, 100, 20),
      new Ellipse("e1", 200, 100, 40, 20),
      new Line("edge", 10, 20, 30, 40, new Style({ stroke: "black" })),
      new Text("title", 10, 40, "开始"),
      new Group("empty"),
    ]));

    assert.equal(codec.encode(document), [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200">',
      '  <g id="scene">',
      '    <rect id="r1" fill="#eee" x="1" y="2" width="30" height="40"/>',
      '    <circle id="c1" cx="100" cy="100" r="20"/>',
      '    <ellipse id="e1" cx="200" cy="100" rx="40" ry="20"/>',
      '    <line id="edge" stroke="black" x1="10" y1="20" x2="30" y2="40"/>',
      '    <text id="title" x="10" y="40">开始</text>',
      '    <g id="empty"/>',
      '  </g>',
      '</svg>',
      '',
    ].join("\n"));
  });

  it("escapes XML text and attributes while retaining whitespace and Unicode", () => {
    const document = new SvgDocument();
    document.add(new Text('label&<>"', 10, 20, "开始 & <结束> \"quoted\" 'single'\r\n\t 😀", new Style({ fill: 'url("a&b")' })));
    const xml = codec.encode(document);

    assert.ok(xml.includes('id="label&amp;&lt;&gt;&quot;"'));
    assert.ok(xml.includes('fill="url(&quot;a&amp;b&quot;)"'));
    assert.ok(xml.includes('>开始 &amp; &lt;结束&gt; &quot;quoted&quot; &apos;single&apos;&#13;&#10;&#9; 😀</text>'));
  });

  it("writes empty documents and empty text without injecting default styles", () => {
    const document = new SvgDocument();
    assert.ok(codec.encode(document).endsWith('viewBox="0 0 800 600">\n</svg>\n'));
    document.add(new Text("empty", 0, 0, ""));
    const xml = codec.encode(document);
    assert.ok(xml.includes('<text id="empty" x="0" y="0"></text>'));
    assert.doesNotMatch(xml, /fill=|stroke=/u);
  });

  it("rejects characters forbidden by XML instead of producing a broken file", () => {
    for (const content of ["bad\u0000", "bad\u000b", "\ud800", "\ufffe"]) {
      const document = new SvgDocument();
      document.add(new Text("t1", 0, 0, content));
      assert.throws(() => codec.encode(document), { message: "invalid XML character" });
      assert.equal(document.getShape("t1").describe().textContent, content);
    }
  });
});

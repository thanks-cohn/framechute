import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8 } from "../src/vendor/fflate.mjs";
import { addDocxImage, serializeDocx } from "../src/documents/docx-document.js";

test("new DOCX images share the relationship/media model and serialize into document flow", async () => {
  const model = {
    parts: {
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),
      "word/_rels/document.xml.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'),
      "word/document.xml": strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>')
    },
    originalXml: '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>',
    relationships: new Map(), blocks: []
  };
  const image = addDocxImage(model, new Uint8Array([137, 80, 78, 71]), { mime: "image/png", width: 200, height: 100 });
  model.blocks = [{ type: "paragraph", runs: [{ text: "before" }, { text: "", images: [image] }, { text: "after" }] }];
  assert.deepEqual([...model.parts[image.part]], [137, 80, 78, 71]);
  assert.match(strFromU8(model.parts["word/_rels/document.xml.rels"]), /relationships\/image/);
  assert.match(strFromU8(model.parts["[Content_Types].xml"]), /ContentType="image\/png"/);
  const bytes = new Uint8Array(await (await serializeDocx(model)).arrayBuffer());
  assert.ok(bytes.length > 4, "serialized DOCX contains its package and image part");
});

import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync } from "../src/vendor/fflate.mjs";
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

test("mixed existing, PNG, and JPEG images retain unique relationships and drawing metadata", async () => {
  const existingBytes = new Uint8Array([1, 2, 3]);
  const pngBytes = new Uint8Array([137, 80, 78, 71, 4]);
  const jpegBytes = new Uint8Array([255, 216, 255, 5]);
  const originalXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><w:body><w:p><w:r><w:t>old text</w:t></w:r><w:r><w:drawing><wp:inline><wp:docPr id="1" name="Existing"/></wp:inline></w:drawing></w:r></w:p></w:body></w:document>';
  const model = {
    parts: {
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="gif" ContentType="image/gif"/></Types>'),
      "word/_rels/document.xml.rels": strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFrameChute1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/existing.gif"/><Relationship Id="rId7" Type="styles" Target="styles.xml"/></Relationships>'),
      "word/document.xml": strToU8(originalXml),
      "word/media/existing.gif": existingBytes,
      "word/media/framechute1.jpg": new Uint8Array([9])
    },
    originalXml,
    relationships: new Map([["rIdFrameChute1", "word/media/existing.gif"]]),
    blocks: []
  };
  const png = addDocxImage(model, pngBytes, { mime: "image/png", width: 200, height: 100 });
  const jpeg = addDocxImage(model, jpegBytes, { mime: "image/jpeg", width: 300, height: 200 });
  assert.notEqual(png.relationshipId, jpeg.relationshipId);
  assert.notEqual(png.relationshipId, "rIdFrameChute1");
  model.blocks = [{ type: "paragraph", runs: [
    { text: "edited text" },
    { text: "", images: [{ relationshipId: "rIdFrameChute1", part: "word/media/existing.gif", width: 10, height: 10 }] },
    { text: "", images: [png] },
    { text: "", images: [jpeg] }
  ] }];

  const saved = unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer()));
  const relationships = strFromU8(saved["word/_rels/document.xml.rels"]);
  const relationshipIds = [...relationships.matchAll(/\bId="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(relationshipIds).size, relationshipIds.length);
  for (const image of [png, jpeg]) {
    assert.match(relationships, new RegExp(`Id="${image.relationshipId}"[^>]+Target="media/${image.part.split("/").pop()}"`));
  }
  assert.deepEqual(saved["word/media/existing.gif"], existingBytes);
  assert.deepEqual(saved[png.part], pngBytes);
  assert.deepEqual(saved[jpeg.part], jpegBytes);

  const documentXml = strFromU8(saved["word/document.xml"]);
  assert.match(documentXml, /edited text/);
  const docPrIds = [...documentXml.matchAll(/<wp:docPr\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  const pictureIds = [...documentXml.matchAll(/<pic:cNvPr\b[^>]*\bid="(\d+)"/g)].map((match) => match[1]);
  assert.equal(docPrIds.length, 3);
  assert.equal(new Set(docPrIds).size, docPrIds.length);
  assert.deepEqual(pictureIds, docPrIds);
  for (const id of ["rIdFrameChute1", png.relationshipId, jpeg.relationshipId]) assert.match(documentXml, new RegExp(`r:embed="${id}"`));
});

test("moved DOCX image order and relationship survive save/reopen",async()=>{
  const originalXml='<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p/></w:body></w:document>';
  const model={parts:{"[Content_Types].xml":strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),"word/_rels/document.xml.rels":strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>'),"word/document.xml":strToU8(originalXml)},originalXml,relationships:new Map(),blocks:[]};
  const image=addDocxImage(model,new Uint8Array([137,80,78,71]),{mime:"image/png",width:20,height:10});
  model.blocks=[{type:"paragraph",runs:[{text:"before"},{text:"after"},{text:"",images:[image]}]}];
  // The direct manipulation moved the same descriptor between the two text runs.
  model.blocks[0].runs.splice(1,0,model.blocks[0].runs.pop());
  const reopened=unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer()));
  const xml=strFromU8(reopened["word/document.xml"]),before=xml.indexOf("before"),drawing=xml.indexOf(`r:embed="${image.relationshipId}"`),after=xml.indexOf("after");
  assert.ok(before>=0&&before<drawing&&drawing<after);
  assert.deepEqual(reopened[image.part],new Uint8Array([137,80,78,71]));
});

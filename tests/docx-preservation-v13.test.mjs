import test from "node:test";
import assert from "node:assert/strict";
import { strFromU8, strToU8, unzipSync } from "../src/vendor/fflate.mjs";
import { normalizeDocxPart, relationshipsPath } from "../src/documents/docx/relationships.js";
import { serializeDocx } from "../src/documents/docx-document.js";

test("relationships resolve relative to every owning OOXML part", () => {
  assert.equal(relationshipsPath("word/document.xml"), "word/_rels/document.xml.rels");
  assert.equal(relationshipsPath("word/header1.xml"), "word/_rels/header1.xml.rels");
  assert.equal(normalizeDocxPart("word/header1.xml", "media/header.png"), "word/media/header.png");
  assert.equal(normalizeDocxPart("word/charts/chart1.xml", "../embeddings/data.xlsx"), "word/embeddings/data.xlsx");
  assert.equal(normalizeDocxPart("word/document.xml", "/word/comments.xml"), "word/comments.xml");
});

test("unrelated text edits preserve revisions, fields, AlternateContent, comments, and unknown parts", async () => {
  const xml = `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><w:body><w:p><w:r><w:t>before</w:t></w:r></w:p><w:p><w:ins w:author="Ada"><w:r><w:t>inserted</w:t></w:r></w:ins><w:fldSimple w:instr="PAGE"><w:r><w:t>7</w:t></w:r></w:fldSimple><mc:AlternateContent><mc:Fallback><w:r><w:t>fallback</w:t></w:r></mc:Fallback></mc:AlternateContent></w:p></w:body></w:document>`;
  const comments = strToU8('<w:comments xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:comment w:id="0"><w:p><w:r><w:t>Keep me</w:t></w:r></w:p></w:comment></w:comments>');
  const embedded = new Uint8Array([0, 1, 2, 253, 254, 255]);
  const model = {
    originalXml: xml,
    originalBlocks: [{ type:"paragraph", sourceIndex:0, style:"", alignment:"left", list:"", level:0, lineSpacing:null, spaceBefore:0, spaceAfter:null, indentLeft:0, indentRight:0, firstLine:0, pageBreak:false }, { type:"paragraph", sourceIndex:1, style:"", alignment:"left", list:"", level:0, lineSpacing:null, spaceBefore:0, spaceAfter:null, indentLeft:0, indentRight:0, firstLine:0, pageBreak:false }],
    parts: { "word/document.xml":strToU8(xml), "word/comments.xml":comments, "word/embeddings/object1.bin":embedded },
    blocks: [
      { type:"paragraph", sourceIndex:0, style:"", alignment:"left", list:"", level:0, lineSpacing:null, spaceBefore:0, spaceAfter:null, indentLeft:0, indentRight:0, firstLine:0, pageBreak:false, runs:[{text:"after"}] },
      { type:"paragraph", sourceIndex:1, style:"", alignment:"left", list:"", level:0, lineSpacing:null, spaceBefore:0, spaceAfter:null, indentLeft:0, indentRight:0, firstLine:0, pageBreak:false, runs:[{text:"inserted"},{text:"7"},{text:"fallback"}] }
    ]
  };
  const saved=unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer()));
  const savedXml=strFromU8(saved["word/document.xml"]);
  assert.match(savedXml, />after<\/w:t>/);
  assert.match(savedXml, /<w:ins w:author="Ada">/);
  assert.match(savedXml, /<w:fldSimple w:instr="PAGE">/);
  assert.match(savedXml, /<mc:AlternateContent>/);
  assert.deepEqual(saved["word/comments.xml"],comments);
  assert.deepEqual(saved["word/embeddings/object1.bin"],embedded);
});

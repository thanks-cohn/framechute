import assert from "node:assert/strict";
import test from "node:test";
import { strFromU8, strToU8, unzipSync } from "../src/vendor/fflate.mjs";
import { serializeDocx } from "../src/documents/docx-document.js";
import { editorNodeToRuns } from "../src/documents/rich-text-runs.js";

const text = (value) => ({ nodeType: 3, textContent: value });
const element = (tagName, children, style = {}) => ({ nodeType: 1, tagName, childNodes: children, style });

test("nested and equivalent editor markup becomes combinable canonical run styles", () => {
  const root = element("P", [
    element("U", [text("u")]),
    element("SPAN", [text("css")], { textDecoration: "underline" }),
    element("STRONG", [element("U", [text("bu")])]),
    element("EM", [element("STRONG", [element("U", [text("biu")])])]),
    element("SPAN", [text("styled")], { fontWeight: "700", fontStyle: "italic", textDecorationLine: "underline" })
  ]);
  assert.deepEqual(editorNodeToRuns(root).map(({ text, bold, italic, underline }) => ({ text, bold, italic, underline })), [
    { text: "ucss", bold: false, italic: false, underline: true },
    { text: "bu", bold: true, italic: false, underline: true },
    { text: "biustyled", bold: true, italic: true, underline: true }
  ]);
});

test("canonical underline combinations survive into actual DOCX document.xml", async () => {
  const originalXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>a</w:t></w:r><w:r><w:t>b</w:t></w:r><w:r><w:t>c</w:t></w:r><w:r><w:t>d</w:t></w:r></w:p></w:body></w:document>';
  const model = { originalXml, parts: { "word/document.xml": strToU8(originalXml) }, blocks: [{ type: "paragraph", runs: [
    { text: "underline", underline: true },
    { text: "bold underline", bold: true, underline: true },
    { text: "italic underline", italic: true, underline: true },
    { text: "all", bold: true, italic: true, underline: true }
  ] }] };
  const xml = strFromU8(unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer()))["word/document.xml"]);
  const properties = [...xml.matchAll(/<w:rPr>([\s\S]*?)<\/w:rPr>/g)].map((match) => match[1]);
  assert.equal(properties.length, 4);
  assert.doesNotMatch(properties[0], /<w:(?:b|i)\/>/); assert.match(properties[0], /<w:u w:val="single"\/>/);
  assert.match(properties[1], /<w:b\/>/); assert.match(properties[1], /<w:u /);
  assert.match(properties[2], /<w:i\/>/); assert.match(properties[2], /<w:u /);
  for (const property of [properties[3]]) for (const tag of ["b", "i", "u"]) assert.match(property, new RegExp(`<w:${tag}(?: |/>)`));
});

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

test("font, size, alignment, lists, and links serialize as structural OOXML", async () => {
  const originalXml = '<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>seed</w:t></w:r></w:p></w:body></w:document>';
  const model = { originalXml, parts: {
    "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),
    "word/document.xml": strToU8(originalXml)
  }, blocks: [
    { type:"paragraph", style:"Heading1", alignment:"center", runs:[{ text:"Heading", fontFamily:"Calibri", fontSize:18 }] },
    { type:"paragraph", list:"bullet", runs:[{ text:"linked", hyperlink:"https://example.com/?a=1&b=2", underline:true }] },
    { type:"paragraph", list:"number", runs:[{ text:"numbered", fontFamily:"Times New Roman", fontSize:12 }] }
  ] };
  const saved=unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer()));
  const xml=strFromU8(saved["word/document.xml"]),rels=strFromU8(saved["word/_rels/document.xml.rels"]),types=strFromU8(saved["[Content_Types].xml"]);
  assert.match(xml, /<w:pStyle w:val="Heading1"\/>/);assert.match(xml, /<w:jc w:val="center"\/>/);
  assert.match(xml, /<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"\/>/);assert.match(xml, /<w:sz w:val="36"\/>/);
  assert.match(xml, /<w:numId w:val="1"\/>/);assert.match(xml, /<w:numId w:val="2"\/>/);assert.match(xml, /<w:hyperlink r:id="rIdFrameChuteLink1">/);
  assert.match(rels, /relationships\/hyperlink/);assert.match(rels, /a=1&amp;b=2/);assert.match(rels, /relationships\/numbering/);
  assert.ok(saved["word/numbering.xml"]);assert.match(types, /word\/numbering.xml/);
});

test("typography, paragraph whitespace, hierarchy, and page setup survive as OOXML", async () => {
  const originalXml='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>seed</w:t></w:r></w:p><w:sectPr/></w:body></w:document>';
  const model={originalXml,parts:{"[Content_Types].xml":strToU8('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"></Types>'),"word/document.xml":strToU8(originalXml)},pageSetup:"a4,landscape,0.5,0.75,1,0.75",blocks:[
    {type:"paragraph",style:"Heading3",lineSpacing:1.5,spaceBefore:6,spaceAfter:12,indentLeft:.25,indentRight:.1,firstLine:.5,pageBreak:true,runs:[{text:"Hierarchy\tUnicode 🌍\nsoft break",fontFamily:"Georgia",fontSize:10.5,bold:true,italic:true,strike:true}]}
  ]};
  const saved=unzipSync(new Uint8Array(await (await serializeDocx(model)).arrayBuffer())),xml=strFromU8(saved["word/document.xml"]),styles=strFromU8(saved["word/styles.xml"]),rels=strFromU8(saved["word/_rels/document.xml.rels"]);
  assert.match(xml,/<w:pStyle w:val="Heading3"\/>/);assert.match(styles,/<w:outlineLvl w:val="2"\/>/);assert.match(rels,/relationships\/styles/);
  assert.match(xml,/<w:spacing w:before="120" w:after="240" w:line="360" w:lineRule="auto"\/>/);assert.match(xml,/<w:ind w:left="360" w:right="144" w:firstLine="720"\/>/);assert.match(xml,/<w:pageBreakBefore\/>/);
  assert.match(xml,/<w:rFonts w:ascii="Georgia"/);assert.match(xml,/<w:sz w:val="21"\/>/);assert.match(xml,/<w:strike\/>/);assert.match(xml,/<w:tab\/>/);assert.match(xml,/<w:br\/>/);
  assert.match(xml,/<w:pgSz w:w="16838" w:h="11906" w:orient="landscape"\/>/);assert.match(xml,/<w:pgMar w:top="720" w:right="1080" w:bottom="1440" w:left="1080"/);
});

test("find/replace changes text nodes without rewriting element attributes",async()=>{
  const {replaceTextNodes}=await import("../src/documents/rich-text-runs.js");
  const text={nodeType:3,textContent:"find this find"};
  const link={nodeType:1,childNodes:[text],href:"https://find.example"};
  const root={nodeType:1,childNodes:[link]};
  assert.equal(replaceTextNodes(root,"find","safe"),2);
  assert.equal(text.textContent,"safe this safe");assert.equal(link.href,"https://find.example");
});

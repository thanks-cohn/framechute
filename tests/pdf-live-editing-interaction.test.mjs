import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePdfTextAutofit } from "../src/documents/pdf-forensics.js";

const [workspace,css]=await Promise.all([
  readFile(new URL("../src/workspace.js",import.meta.url),"utf8"),
  readFile(new URL("../src/workspace.css",import.meta.url),"utf8")
]);

test("single click enters PDF text editing without selecting the entire source run",()=>{
  assert.match(workspace,/placePdfCaretFromPointer/);
  assert.match(workspace,/caretPositionFromPoint/);
  const start=workspace.indexOf("const enterPdfTextEditing=");
  const end=workspace.indexOf('textLayer.addEventListener("click"',start);
  const block=workspace.slice(start,end);
  assert.equal(block.includes("range.selectNodeContents(text)"),false);
  assert.match(block,/showControls=false/);
});

test("double click stays in the same text editing session and only reveals controls",()=>{
  const start=workspace.indexOf('textLayer.addEventListener("dblclick"');
  const end=workspace.indexOf('textLayer.addEventListener("input"',start);
  const block=workspace.slice(start,end);
  assert.match(block,/showPdfTextControls/);
  assert.equal(block.includes("commitActivePdfText"),false);
  assert.equal(block.includes("beginPdfManipulation"),false);
});

test("live PDF typing is explicitly visible without a white field rectangle",()=>{
  assert.match(css,/\.pdf-edit-text\[contenteditable="true"\][\s\S]*-webkit-text-fill-color:\s*#111\s*!important/);
  assert.match(css,/\.pdf-edit-text\[contenteditable="true"\][\s\S]*outline:\s*none/);
  assert.match(css,/\.pdf-text-item\.is-editing\s*\{[\s\S]*background:\s*transparent\s*!important/);
  assert.match(workspace,/WebkitTextFillColor:"#111"/);
});

test("live source mask gets bounded antialias padding while source ownership stays immutable",()=>{
  assert.match(workspace,/projectPdfSourceMask\(viewport,ownership,\{[\s\S]*padding:Math\.max\(1\.25/);
});

test("single-line autofit does not manufacture a second row",()=>{
  const result=calculatePdfTextAutofit({
    text:"word",
    previousText:"word",
    fontSize:12,
    lineHeight:12,
    measureText:value=>value.length*6,
    previousRect:{x:0,y:0,width:80,height:12},
    contentRect:{x:0,y:0,width:300,height:300},
    minWidth:16,
    minHeight:12,
    userWidth:80
  });
  assert.equal(result.trace.newLineCount,1);
  assert.equal(result.rect.height,12);
});

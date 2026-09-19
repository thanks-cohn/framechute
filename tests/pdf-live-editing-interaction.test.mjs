import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { calculatePdfTextAutofit } from "../src/documents/pdf-forensics.js";

const [workspace,css,pdfDocument]=await Promise.all([
  readFile(new URL("../src/workspace.js",import.meta.url),"utf8"),
  readFile(new URL("../src/workspace.css",import.meta.url),"utf8"),
  readFile(new URL("../src/documents/pdf-document.js",import.meta.url),"utf8")
]);

test("single click enters caret editing and shows field controls and handles",()=>{
  assert.match(workspace,/placePdfCaretFromPointer/);
  assert.match(workspace,/caretPositionFromPoint/);
  const start=workspace.indexOf('textLayer.addEventListener("click"');
  const end=workspace.indexOf('textLayer.addEventListener("dblclick"',start);
  const block=workspace.slice(start,end);
  assert.match(block,/pdfSelectionMode="caret"/);
  assert.match(block,/enterPdfTextEditing\(event,span,\{showControls:true\}\)/);
  assert.equal(block.includes("controls.hidden=true"),false);
  assert.match(css,/\.pdf-text-item\.is-selected \.pdf-move-handle/);
  assert.match(css,/\.pdf-text-item\.is-selected \.pdf-resize-handle/);
});

test("double click selects the entire PDF text field instead of a native word",()=>{
  const helperStart=workspace.indexOf("const selectWholePdfTextField=");
  const start=workspace.indexOf('textLayer.addEventListener("dblclick"',helperStart);
  const end=workspace.indexOf('textLayer.addEventListener("input"',start);
  const helper=workspace.slice(helperStart,start),block=workspace.slice(start,end);
  assert.match(helper,/range\.selectNodeContents\(text\)/);
  assert.match(helper,/data-pdf-selection-mode/);
  assert.match(block,/event\.preventDefault\(\)/);
  assert.match(block,/selectWholePdfTextField\(text\)/);
  assert.match(block,/showPdfTextControls/);
});

test("untouched source text carries hidden interaction handles without becoming a persisted edit",()=>{
  const sourceStart=pdfDocument.indexOf('span.dataset.geometryDerivation="pdf-baseline-font-ascent"');
  const sourceBlock=pdfDocument.slice(sourceStart,sourceStart+1200);
  assert.match(sourceBlock,/pdf-move-handle/);
  assert.match(sourceBlock,/pdf-resize-handle/);
  assert.equal(sourceBlock.includes('span.classList.add("pdf-text-edit")'),false);
  assert.match(workspace,/function materializePdfSourceEdit/);
  assert.match(workspace,/if\(!edit&&Number\(span\.dataset\.index\)>=0\).*materializePdfSourceEdit/s);
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


test("unchanged PDF edit exit clears transient live text visibility so source glyphs do not double",()=>{
  const start=workspace.indexOf("function commitActivePdfText");
  const end=workspace.indexOf("function selectedPdfEdit",start);
  const block=workspace.slice(start,end);
  assert.match(block,/const activeText=truth\.state\.activeElement/);
  assert.match(block,/if\(!result\.changed&&activeText\)/);
  assert.match(block,/removeProperty\("color"\)/);
  assert.match(block,/removeProperty\("-webkit-text-fill-color"\)/);
  assert.match(block,/removeProperty\("background"\)/);
  assert.match(block,/removeProperty\("opacity"\)/);
  assert.match(block,/delete activeText\.dataset\.liveText/);
});

test("committing a replacement installs persistent source coverage before transient live mask is removed",()=>{
  const start=workspace.indexOf("function commitActivePdfText");
  const end=workspace.indexOf("function selectedPdfEdit",start);
  const block=workspace.slice(start,end);
  const sync=block.indexOf("syncPdfReplacementSourceMask");
  const remove=block.indexOf("removePdfLiveEditMask");
  assert.ok(sync>=0&&remove>sync,"persistent source mask is installed before transient mask removal");
});

test("first PDF edit preserves inferred source family instead of forcing Helvetica",()=>{
  assert.match(workspace,/inferPdfSourceFontFamily\(original,runtime\.pageData\.content\.styles\)/);
  const applyStart=workspace.indexOf("function applyPdfTextCommit");
  const applyEnd=workspace.indexOf("function commitActivePdfText",applyStart);
  const applyBlock=workspace.slice(applyStart,applyEnd);
  assert.equal(applyBlock.includes('fontFamily:"Helvetica"'),false);
});

test("legacy automatic margin reconstruction edits are discarded during runtime initialization",()=>{
  assert.match(workspace,/state\.edits\.filter\(edit=>edit\?\.marginReconstructed!==true\)/);
});


test("free-text DOM has no competing local focusout/contenteditable lifecycle",()=>{
  const start=pdfDocument.indexOf("export function createPdfFreeTextElement");
  const end=pdfDocument.indexOf("export async function renderPdfPage",start);
  const block=pdfDocument.slice(start,end);
  assert.equal(block.includes('addEventListener("focusout"'),false);
  assert.equal(block.includes('removeAttribute("contenteditable")'),false);
});

test("new PDF free text is one-line sized and does not rerender the source canvas",()=>{
  const start=workspace.indexOf('if(action==="add-text")');
  const end=workspace.indexOf('} else if(!edit && action==="delete"',start);
  const block=workspace.slice(start,end);
  assert.match(block,/initialHeight=Math\.max\(14,12\*/);
  assert.match(block,/createPdfFreeTextElement/);
  assert.equal(block.includes("setPdfPage"),false);
});

test("free-text input never creates a white source mask beneath itself",()=>{
  const start=workspace.indexOf('textLayer.addEventListener("input"');
  const end=workspace.indexOf('textLayer.addEventListener("keydown"',start);
  const block=workspace.slice(start,end);
  assert.match(block,/if\(Number\(span\.dataset\.index\)>=0\)/);
  assert.match(block,/else removePdfLiveEditMask\(textLayer\)/);
});

test("PDF text overlay origin is explicitly locked to the rendered canvas",()=>{
  assert.match(pdfDocument,/alignPdfTextLayerToCanvas\(canvas, textLayer\)/);
  assert.match(pdfDocument,/transform:\s*"none"/);
});

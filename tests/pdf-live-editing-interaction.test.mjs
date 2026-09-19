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

test("selected editing field remains above the live source mask",()=>{
  assert.match(css,/\.pdf-text-item\.is-selected\.is-editing\s*\{\s*z-index:\s*6/);
  assert.match(css,/\.pdf-live-edit-mask\s*\{\s*z-index:\s*3/);
});

test("live typing grows field width instead of locking to the original box",()=>{
  const start=workspace.indexOf('textLayer.addEventListener("input"');
  const end=workspace.indexOf('textLayer.addEventListener("keydown"',start);
  const block=workspace.slice(start,end);
  assert.match(block,/const userWidth=span\.dataset\.userWidth\?Number\(span\.dataset\.userWidth\):null/);
  assert.match(block,/const liveWidth=userWidth==null\?Math\.max\(baseWidth,autofit\.rect\.width\):autofit\.rect\.width/);
  assert.match(block,/width:\`\$\{liveWidth\}px\`/);
  assert.equal(block.includes('userWidth:span.dataset.userWidth?Number(span.dataset.userWidth):currentWidth'),false);
});

test("live mask uses directional padding so horizontal cleanup does not erase the line above",()=>{
  const start=workspace.indexOf("function createPdfLiveEditMask");
  const end=workspace.indexOf("function syncPdfReplacementSourceMask",start);
  const block=workspace.slice(start,end);
  assert.match(block,/horizontalPadding:horizontalPad/);
  assert.match(block,/verticalPadding:verticalPad/);
  assert.match(block,/verticalPad=Math\.max\(\.25,Math\.min\(\.75,scale\*\.3\)\)/);
});

test("live source mask adds vertical-only glyph bleed",()=>{
  const start=workspace.indexOf("function createPdfLiveEditMask");
  const end=workspace.indexOf("function syncPdfReplacementSourceMask",start);
  const block=workspace.slice(start,end);
  assert.match(block,/topBleed=Math\.max\(\.5,Math\.min\(2,fieldHeight\*\.06\)\)/);
  assert.match(block,/bottomBleed=Math\.max\(5,Math\.min\(14,fieldHeight\*\.44\)\)/);
  assert.match(block,/rawTop=projected\.y-topBleed/);
  assert.match(block,/rawHeight=projected\.height\+topBleed\+bottomBleed/);
  assert.match(block,/terminalBleed:span\.dataset\.terminalFragment==="true"\?Math\.min\(8,Math\.max\(2\.5,scale\*2\.2\)\):0/);
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

test("single-line autofit expands horizontally when width is not user locked",()=>{
  const result=calculatePdfTextAutofit({
    text:"this text is substantially wider",
    previousText:"short",
    fontSize:12,
    lineHeight:12,
    measureText:value=>value.length*6,
    previousRect:{x:0,y:0,width:60,height:12},
    contentRect:{x:0,y:0,width:400,height:300},
    minWidth:16,
    minHeight:12,
    userWidth:null
  });
  assert.equal(result.trace.newLineCount,1);
  assert.ok(result.rect.width>60);
  assert.equal(result.trace.wrapped,false);
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

test("committed replacement mask keeps live bottom and terminal glyph bleed",()=>{
  const start=workspace.indexOf("function syncPdfReplacementSourceMask");
  const end=workspace.indexOf("function capturePdfTextSourceOwnership",start);
  const block=workspace.slice(start,end);
  assert.match(block,/bottomBleed=Math\.max\(5,Math\.min\(14,fieldHeight\*\.44\)\)/);
  assert.match(block,/terminalBleed=sourceSpan\?\.dataset\.terminalFragment==="true"\?Math\.min\(8,Math\.max\(2\.5,scale\*2\.2\)\):0/);
  assert.match(block,/ownedDisplay\.top\+ownedDisplay\.height\+bottomBleed/);
});

test("rerendered persistent PDF mask preserves bottom and terminal visual bleed",()=>{
  const start=pdfDocument.indexOf("for (const mask of visibleMasks)");
  const end=pdfDocument.indexOf("content.items.forEach",start);
  const block=pdfDocument.slice(start,end);
  assert.match(block,/maskGeometry=mask\.ownerEditId\?\(mask\.sourceOwnershipRect\|\|mask\):mask/);
  assert.match(block,/if\(mask\.ownerEditId\)/);
  assert.match(block,/bottomBleed=Math\.max\(5,Math\.min\(14,fieldHeight\*\.44\)\)/);
  assert.match(block,/rawBottom\+=bottomBleed/);
  assert.match(block,/rawLeft-=horizontalPad/);
  assert.match(block,/rawRight\+=horizontalPad\+terminalBleed/);
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

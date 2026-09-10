import test from "node:test";
import assert from "node:assert/strict";
import { commandsForEditorContext, genericAdvancedVisibility, supportsMediaSync } from "../src/actions/context-menu-model.mjs";
import { readFile } from "node:fs/promises";

const block = (type, media=false) => ({dataset:{blockType:type},classList:{contains:()=>false},querySelector:selector=>media&&selector==="video"?{}:null});
test("simple generic menus omit advanced and sync commands",()=>{
  for(const type of ["image","pdf","docx","text"])assert.deepEqual(genericAdvancedVisibility({advanced:false,block:block(type)}),{advanced:false,supportsMediaSync:false,showImageOnly:false,timedEdit:false,timedPlayback:false});
});
test("media synchronization is capability-gated to playable video",()=>{
  assert.equal(supportsMediaSync(block("video",true)),true);assert.equal(supportsMediaSync(block("video",false)),false);assert.equal(supportsMediaSync(block("pdf",true)),false);
  assert.equal(genericAdvancedVisibility({advanced:true,block:block("video",true)}).supportsMediaSync,true);
});
test("document editor command registries stay document-specific",()=>{
  const pdf=commandsForEditorContext({editorKind:"pdf",selectionKind:"page"}),docx=commandsForEditorContext({editorKind:"docx",selectionKind:"page"});
  assert.ok(pdf.some(item=>item.id==="add-text"));assert.ok(docx.some(item=>item.id==="bold"));
  for(const items of [pdf,docx])assert.equal(items.some(item=>["grab","timed-edit","sync"].includes(item.id)),false);
});
test("DOCX image context exposes Word-style wrapping and free positioning",()=>{
  const menu=commandsForEditorContext({editorKind:"docx",selectionKind:"image"});
  const imageGroup=menu.find(item=>item.id==="context");
  const wrapping=imageGroup?.submenu?.find(item=>item.id==="image-wrapping")?.submenu || [];
  assert.deepEqual(wrapping.map(item=>item.id),[
    "image-wrap-inline",
    "image-wrap-square",
    "image-wrap-tight",
    "image-wrap-top-bottom",
    "image-wrap-behind",
    "image-wrap-front"
  ]);
  assert.match(wrapping.at(-1)?.label || "",/Free Position/);
});
test("DOCX correctness layer owns exact point size, paragraph style, image delete and history",async()=>{
  const source=await readFile(new URL("../src/docx-editor-correctness.js",import.meta.url),"utf8");
  assert.match(source,/fontSize.*\$\{size\}pt/s);
  assert.match(source,/applyParagraphStyle\(block, target\.value\.toLowerCase\(\)\)/);
  assert.match(source,/removeSelectedImage\(block\)/);
  assert.match(source,/Ctrl\/Cmd\+Z or Undo restores it/);
  assert.match(source,/docx-image-corner-handle/);
});
test("Quick Actions uses a close control and never a selection-clearing control",async()=>{
  const source=await readFile(new URL("../src/actions/quick-actions.js",import.meta.url),"utf8");
  assert.match(source,/quick-actions-close/);assert.doesNotMatch(source,/quick-actions-clear|>Clear</);
});

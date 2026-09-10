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
test("DOCX text context exposes highlight without borrowing PDF/media commands",()=>{
  const docx=commandsForEditorContext({editorKind:"docx",selectionKind:"text"});
  assert.ok(docx.some(item=>item.id==="highlight"));
  const formatting=docx.find(item=>item.id==="formatting")?.submenu||[];
  assert.ok(formatting.some(item=>item.id==="highlight"));
  assert.ok(formatting.some(item=>item.id==="remove-highlight"));
  assert.equal(docx.some(item=>item.id==="settings"),false);
});
test("Quick Actions uses a close control and never a selection-clearing control",async()=>{
  const source=await readFile(new URL("../src/actions/quick-actions.js",import.meta.url),"utf8");
  assert.match(source,/quick-actions-close/);assert.doesNotMatch(source,/quick-actions-clear|>Clear</);
});

test("media synchronization accepts playable audio and rejects mislabeled static objects",()=>{
  const audio={dataset:{blockType:"audio"},querySelector:selector=>selector==="audio"?{}:null};
  assert.equal(supportsMediaSync(audio),true);
  assert.equal(supportsMediaSync({dataset:{blockType:"image"},querySelector:()=>({})}),false);
});

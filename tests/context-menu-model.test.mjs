import test from "node:test";
import assert from "node:assert/strict";
import { commandsForEditorContext, genericAdvancedVisibility, supportsMediaSync } from "../src/actions/context-menu-model.mjs";
import { objectMenuItems } from "../src/actions/object-menu-model.mjs";
import { readFile } from "node:fs/promises";

const block = (type, media=false) => ({dataset:{blockType:type},classList:{contains:()=>false},querySelector:selector=>media&&selector==="video"?{}:null});
test("simple generic menus omit advanced and sync commands",()=>{
  for(const type of ["image","pdf","docx","text"])assert.deepEqual(genericAdvancedVisibility({advanced:false,block:block(type)}),{advanced:false,supportsMediaSync:false,showImageOnly:false,timedEdit:false,timedPlayback:false});
});
test("media synchronization is capability-gated to playable video",()=>{
  assert.equal(supportsMediaSync(block("video",true)),true);assert.equal(supportsMediaSync(block("video",false)),false);assert.equal(supportsMediaSync(block("pdf",true)),false);
  assert.equal(genericAdvancedVisibility({advanced:true,block:block("video",true)}).supportsMediaSync,true);
});
test("every object-facing menu leads with Show Header",()=>{
  assert.equal(objectMenuItems()[0]?.id,"show-header");
  for(const context of [
    {editorKind:"pdf",selectionKind:"page"},
    {editorKind:"pdf",selectionKind:"edit"},
    {editorKind:"pdf",selectionKind:"source-text"},
    {editorKind:"docx",selectionKind:"text"}
  ]) {
    assert.equal(commandsForEditorContext(context)[0]?.id,"show-header");
    assert.equal(commandsForEditorContext(context)[0]?.label,"Show Header");
  }
});

test("every object-facing menu ends with Fix to Viewport state",()=>{
  assert.equal(objectMenuItems({viewportFixed:false}).at(-1)?.id,"fix-viewport");
  assert.match(objectMenuItems({viewportFixed:false}).at(-1)?.label,/OFF/);
  assert.match(objectMenuItems({viewportFixed:true}).at(-1)?.label,/ON/);

  for(const context of [
    {editorKind:"pdf",selectionKind:"page",block:{dataset:{viewportFixed:"false"}}},
    {editorKind:"pdf",selectionKind:"edit",block:{dataset:{viewportFixed:"true"}}},
    {editorKind:"pdf",selectionKind:"source-text",block:{dataset:{viewportFixed:"false"}}},
    {editorKind:"docx",selectionKind:"text",block:{dataset:{viewportFixed:"true"}}}
  ]) {
    const items=commandsForEditorContext(context);
    assert.equal(items.at(-1)?.id,"fix-viewport");
    assert.match(items.at(-1)?.label,context.block.dataset.viewportFixed==="true"?/ON/:/OFF/);
  }
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

test("document context menus expose the effective per-object Quick Actions state",()=>{
  const pdfOn=commandsForEditorContext({editorKind:"pdf",selectionKind:"source-text",quickActionsEnabled:true,block:{dataset:{pdfEditMode:"on"}}});
  const pdfHidden=commandsForEditorContext({editorKind:"pdf",selectionKind:"page",quickActionsEnabled:true,block:{dataset:{pdfEditMode:"on",quickActionsHidden:"true"}}});
  const pdfGlobalOff=commandsForEditorContext({editorKind:"pdf",selectionKind:"page",quickActionsEnabled:false,block:{dataset:{pdfEditMode:"on"}}});
  const docxHidden=commandsForEditorContext({editorKind:"docx",selectionKind:"text",quickActionsEnabled:true,block:{dataset:{quickActionsHidden:"true"}}});
  assert.equal(pdfOn.find(item=>item.id==="quick-actions-object")?.label,"Quick Actions  [ ON ]");
  assert.equal(pdfHidden.find(item=>item.id==="quick-actions-object")?.label,"Quick Actions  [ OFF ]");
  assert.equal(pdfGlobalOff.find(item=>item.id==="quick-actions-object")?.label,"Quick Actions  [ OFF ]");
  assert.equal(docxHidden.find(item=>item.id==="quick-actions-object")?.label,"Quick Actions  [ OFF ]");
});

test("PDF edit mode keeps existing source-text editing explicit",()=>{
  const on=commandsForEditorContext({editorKind:"pdf",selectionKind:"source-text",block:{dataset:{pdfEditMode:"on"}}});
  const off=commandsForEditorContext({editorKind:"pdf",selectionKind:"source-text",block:{dataset:{pdfEditMode:"off"}}});
  assert.equal(on.find(item=>item.id==="toggle-edit")?.label,"EDIT [ ON ]");
  assert.equal(on.find(item=>item.id==="edit-text")?.label,"Edit / Replace Text");
  assert.equal(off.find(item=>item.id==="toggle-edit")?.label,"EDIT [ OFF ]");
  assert.equal(off.some(item=>item.id==="edit-text"),false);
});


test("PDF image context exposes Wrap Text state",()=>{
  const onSelected={dataset:{wrapText:"on"},classList:{contains:name=>name==="pdf-image-edit"}};
  const offSelected={dataset:{wrapText:"off"},classList:{contains:name=>name==="pdf-image-edit"}};
  const on=commandsForEditorContext({editorKind:"pdf",selectionKind:"image",selected:onSelected,block:{dataset:{pdfEditMode:"on"}}});
  const off=commandsForEditorContext({editorKind:"pdf",selectionKind:"image",selected:offSelected,block:{dataset:{pdfEditMode:"on"}}});
  assert.equal(on.find(item=>item.id==="toggle-wrap")?.label,"Wrap Text  [ ON ]");
  assert.equal(off.find(item=>item.id==="toggle-wrap")?.label,"Wrap Text  [ OFF ]");
});

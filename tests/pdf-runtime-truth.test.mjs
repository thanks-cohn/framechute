import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { extractSemanticPdfText, openPdfDocument, searchCurrentPdfDocument, serializeEditedPdf, viewportRectToPdf } from "../src/documents/pdf-document.js";
import {
  beginPdfManipulation,
  beginPdfTextInteraction,
  commitPdfTextEdit,
  createPdfRuntimeTruth,
  hydrateReopenedPdfCurrentObjects,
  projectPdfContentRect,
  runtimeTruthDiagnostics,
  updatePdfLiveText
} from "../src/documents/pdf-runtime-truth.js";

const fixtureDirectory=fileURLToPath(new URL("../pdf/",import.meta.url));
const sourceRect={x:72,y:500,width:120,height:18};
const manifestObject=(overrides={})=>({
  id:"edit:stable",
  kind:"replacement",
  page:1,
  index:0,
  text:"Current replacement",
  original:"Historical source",
  sourceObjectId:"source:p1:text:0",
  sourceLineId:"line:p1:0",
  pdfRect:{x:80,y:480,width:160,height:32},
  sourceOwnershipRect:sourceRect,
  fontSize:12,
  fontFamily:"Helvetica",
  rotation:0,
  versionState:"current",
  ...overrides
});

test("reopen hydration preserves identity, geometry, ownership, and manipulation capability",()=>{
  const model={reopenedCurrent:{documentVersionId:"document:1",objects:[manifestObject()]}};
  const result=hydrateReopenedPdfCurrentObjects(model);
  assert.equal(result.edits.length,1);
  const [edit]=result.edits;
  assert.equal(edit.id,"edit:stable");
  assert.equal(edit.replacement,"Current replacement");
  assert.deepEqual({x:edit.x,y:edit.y,width:edit.width,height:edit.height},{x:80,y:480,width:160,height:32});
  assert.deepEqual({x:edit.sourceX,y:edit.sourceY,width:edit.sourceWidth,height:edit.sourceHeight},sourceRect);
  assert.deepEqual(edit.manipulationCapability,{move:true,resize:true,editText:true});
  assert.equal(edit.reopened,true);
  assert.equal(edit.versionState,"current");
});

test("workspace restoration deterministically wins over manifest hydration",()=>{
  const restored={...manifestObject(),replacement:"Workspace is newer",x:91};
  delete restored.text;
  const model={reopenedCurrent:{documentVersionId:"document:2",objects:[manifestObject()]}};
  const result=hydrateReopenedPdfCurrentObjects(model,[restored]);
  assert.equal(result.edits.length,1);
  assert.equal(result.edits[0].replacement,"Workspace is newer");
  assert.equal(result.edits[0].x,91);
  assert.equal(result.hydrated.length,0);
  assert.equal(result.deduplicated,1);
});

test("historical manifest objects never hydrate into live runtime edits",()=>{
  const model={reopenedCurrent:{objects:[
    manifestObject({id:"old",versionState:"historical"}),
    manifestObject({id:"new",text:"Only current"})
  ]}};
  const result=hydrateReopenedPdfCurrentObjects(model);
  assert.deepEqual(result.edits.map(edit=>edit.id),["new"]);
});

function fakeElement(text){
  return {
    innerText:text,
    textContent:text,
    dataset:{before:text},
    editable:true,
    removeAttribute(name){if(name==="contenteditable")this.editable=false;}
  };
}

function fakeSpan(id="edit:stable"){
  return {dataset:{objectId:id},classList:{values:new Set(["is-editing"]),remove(value){this.values.delete(value);}}};
}

test("one commit path preserves live text during edit to manipulation transition",()=>{
  const truth=createPdfRuntimeTruth({model:{},mode:"debug"});
  const element=fakeElement("Before"),span=fakeSpan();
  const edit={...manifestObject(),replacement:"Before"};
  let masksRemoved=0,applyCalls=0;
  beginPdfTextInteraction(truth,{element,span,edit,context:{
    getEdit:()=>edit,
    readLayoutRect:()=>({left:10,top:20,width:90,height:24}),
    removeLiveMask:()=>masksRemoved++,
    apply:({text})=>{applyCalls++;edit.replacement=text;return {changed:true,edit};}
  }});
  element.innerText="Before ABC";
  updatePdfLiveText(truth,element.innerText,{cause:"input"});
  beginPdfManipulation(truth,{objectId:edit.id});
  assert.equal(edit.replacement,"Before ABC");
  assert.equal(applyCalls,1);
  assert.equal(masksRemoved,1);
  assert.equal(element.editable,false);
  assert.equal(truth.state.interaction,"manipulating");
  assert.equal(truth.state.manipulatingObjectId,edit.id);
  assert.deepEqual(truth.journal.snapshot().map(entry=>entry.event),["edit-begin","input","commit","manipulation-begin"]);
});

test("focusout, Enter, Save, and page change share idempotent commit semantics",()=>{
  for(const cause of ["focusout","enter","save","page-change"]){
    const truth=createPdfRuntimeTruth({model:{},mode:"debug"});
    const element=fakeElement("old"),span=fakeSpan(cause);let calls=0;
    beginPdfTextInteraction(truth,{element,span,context:{apply:({text})=>{calls++;return {changed:true,edit:{...manifestObject({id:cause}),replacement:text}};}}});
    element.innerText=`live-${cause}`;
    const first=commitPdfTextEdit(truth,{cause});
    const second=commitPdfTextEdit(truth,{cause});
    assert.equal(first.text,`live-${cause}`);
    assert.equal(first.changed,true);
    assert.equal(second.changed,false);
    assert.equal(second.reason,"not-editing");
    assert.equal(calls,1);
  }
});

test("cancel restores committed text without applying a semantic mutation",()=>{
  const truth=createPdfRuntimeTruth({model:{},mode:"debug"});
  const element=fakeElement("committed"),span=fakeSpan();let applied=false;
  beginPdfTextInteraction(truth,{element,span,context:{apply:()=>{applied=true;}}});
  element.innerText="discard me";
  const result=commitPdfTextEdit(truth,{cause:"escape",cancel:true});
  assert.equal(result.text,"committed");
  assert.equal(result.cancelled,true);
  assert.equal(applied,false);
});

test("actual content rectangle projects into live viewport CSS coordinates",()=>{
  const viewport={convertToViewportRectangle:([x1,y1,x2,y2])=>[x1*2,800-y1*2,x2*2,800-y2*2]};
  assert.deepEqual(projectPdfContentRect(viewport,{x:36,y:54,width:240,height:300}),{x:72,y:92,width:480,height:600});
});

test("OFF runtime remains allocation-cheap while DEBUG exposes causal truth",()=>{
  const off=createPdfRuntimeTruth({model:{},mode:"off"});
  off.record("input",{objectId:"x"});
  assert.equal(off.journal.size,0);
  assert.deepEqual(off.journal.snapshot(),[]);
  const debug=createPdfRuntimeTruth({model:{reopenedCurrent:{objects:[manifestObject()] }},mode:"debug"});
  const diagnostics=runtimeTruthDiagnostics(debug);
  assert.equal(diagnostics.hydration.hydratedObjectIds[0],"edit:stable");
  assert.equal(diagnostics.recentCausalEvents[0].event,"reopen-hydration");
  assert.equal(diagnostics.generations.semantic,1);
  assert.equal(diagnostics.generations.replacement,1);
});

test("real first /pdf fixture serialize to reopen hydrates exactly one stable current replacement",async()=>{
  const fixture=(await readdir(fixtureDirectory)).filter(name=>name.toLowerCase().endsWith(".pdf")).sort()[0];
  assert.ok(fixture,"repository must contain a PDF fixture");
  const originalBytes=new Uint8Array(await readFile(join(fixtureDirectory,fixture)));
  const model=await openPdfDocument(originalBytes);
  let reopened;
  try{
    const pages=[];const counts=new Map();
    for(let pageNumber=1;pageNumber<=model.pageCount;pageNumber++){const page=await model.pdf.getPage(pageNumber),content=await page.getTextContent();pages.push({pageNumber,page,content});for(const item of content.items){const value=String(item.str||"").trim();if(value)counts.set(value,(counts.get(value)||0)+1);}}
    let selected=null;
    for(const candidate of pages)candidate.content.items.forEach((item,index)=>{const value=String(item.str||"").trim();if(counts.get(value)===1&&/[A-Za-z]/.test(value)&&(!selected||value.length>selected.value.length))selected={...candidate,item,index,value};});
    assert.ok(selected,"fixture must contain globally unique source text");
    const {pageNumber,page,content,item,index}=selected,viewport=page.getViewport({scale:1});
    assert.ok(index>=0,"fixture must expose a real source text run");
    const height=Math.max(8,Math.hypot(item.transform[2],item.transform[3]));
    const [left,baseline]=viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
    const geometry=viewportRectToPdf(viewport,{left,top:baseline-height,width:Math.max(item.width,8),height:height*1.25});
    const replacement=`ZQ_RUNTIME_TRUTH_${Date.now()}`;
    const edit={kind:"replacement",id:"edit:fixture-stable",page:pageNumber,index,original:item.str,replacement,...geometry,sourceX:geometry.x,sourceY:geometry.y,sourceWidth:geometry.width,sourceHeight:geometry.height,fontFamily:"Helvetica",fontSize:Math.max(4,height),rotation:0,sourceObjectId:`source:p${pageNumber}:text:${index}`,versionState:"current"};
    const blob=await serializeEditedPdf(model,[edit]);
    reopened=await openPdfDocument(await blob.arrayBuffer());
    const hydration=hydrateReopenedPdfCurrentObjects(reopened);
    assert.equal(hydration.edits.length,1);
    assert.equal(hydration.edits[0].id,edit.id);
    assert.equal(hydration.edits[0].replacement,replacement);
    assert.deepEqual({x:hydration.edits[0].sourceX,y:hydration.edits[0].sourceY,width:hydration.edits[0].sourceWidth,height:hydration.edits[0].sourceHeight},geometry);
    assert.deepEqual({x:hydration.edits[0].x,y:hydration.edits[0].y,width:hydration.edits[0].width,height:hydration.edits[0].height},geometry);
    assert.equal((await searchCurrentPdfDocument(reopened,hydration.edits,replacement)).length,1);
    // Search is current-version aware: the stable replacement is found once.
    // The fixture intentionally paints some prose twice, so source quarantine
    // is asserted through reconciliation rather than treating equal text in a
    // separate paint operator as the same source identity.
    await extractSemanticPdfText(reopened,hydration.edits,{pageNumber});
    const reconciliation=reopened.reopenedReconciliation.get(pageNumber);
    assert.ok(reconciliation.historical.some(object=>object.ownerEditId===edit.id));
    const currentText=await extractSemanticPdfText(reopened,hydration.edits);
    assert.equal(currentText.split(replacement).length-1,1,"replacement is current exactly once");
    assert.equal(hydration.edits[0].manipulationCapability.move,true);
    assert.equal(hydration.edits[0].manipulationCapability.resize,true);
  } finally {
    await model.pdf.destroy();
    await reopened?.pdf.destroy();
  }
});

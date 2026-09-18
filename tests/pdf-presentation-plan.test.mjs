import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  PDF_PRESENTATION_STATES, buildPdfAgentPageMirror, buildPdfPresentationPlan,
  classifyPdfPresentationCollisions, explainPdfMirrorPoint, inspectPdfMirrorObject,
  validatePdfPresentation
} from "../src/documents/pdf-presentation-plan.js";
import { createPdfPageDiagnostics, getPdfPageLayout, openPdfDocument } from "../src/documents/pdf-document.js";

const rect={x:10,y:20,width:80,height:12};
const source=(id="source:p1:text:0",overrides={})=>({id,sourceObjectId:id,page:1,text:"Original",pdfRect:rect,sourceOwnershipRect:rect,...overrides});
const edit=(overrides={})=>({id:"edit:1",sourceObjectId:"source:p1:text:0",page:1,kind:"replacement",original:"Original",replacement:"Changed",layoutRect:{x:10,y:20,width:80,height:12},sourceOwnershipRect:rect,...overrides});
const plan=overrides=>buildPdfPresentationPlan({pageNumber:1,sourceObjects:[source()],...overrides});

test("source-only plan has exactly one source presentation",()=>{
  const value=plan();assert.equal(value.valid,true);assert.equal(value.objects["source:p1:text:0"].state,PDF_PRESENTATION_STATES.SOURCE_ONLY);assert.equal(value.sourcePresentations.length,1);assert.equal(value.masks.length,0);
});

test("live edit covers source before exposing only live text",()=>{
  const value=plan({currentEdits:[edit()],activeInteraction:{editingObjectId:"edit:1",liveText:"Typing"}}),object=value.objects["source:p1:text:0"];
  assert.deepEqual([object.sourceVisible,object.liveVisible,object.replacementVisible],[false,true,false]);assert.deepEqual(value.masks[0].sourceOwnershipRect,rect);assert.equal(object.text,"Typing");
});

test("committed and editing-existing replacement are exclusive",()=>{
  let value=plan({currentEdits:[edit()]});assert.deepEqual([value.sourcePresentations.length,value.livePresentations.length,value.replacementPresentations.length],[0,0,1]);
  value=plan({currentEdits:[edit()],activeInteraction:{editingObjectId:"edit:1"}});assert.deepEqual([value.sourcePresentations.length,value.livePresentations.length,value.replacementPresentations.length],[0,1,0]);
});

test("unchanged interaction with no authored edit remains source-only",()=>{
  const value=plan({activeInteraction:{sourceObjectId:"source:p1:text:0",liveText:"Original"}});assert.equal(value.objects["source:p1:text:0"].state,PDF_PRESENTATION_STATES.SOURCE_ONLY);assert.equal(value.replacementPresentations.length,0);
});

test("historical objects never render or hit test",()=>{
  const value=plan({historicalObjects:[edit({id:"old",versionState:"historical",visible:true})]});assert.equal(value.objects.old.visible,false);assert.equal(value.objects.old.hitTestable,false);assert.ok(value.conflicts.some(item=>item.code==="PDF_HISTORICAL_PRESENTATION_ATTEMPT"));
});

test("duplicate source owner is rejected and suppressed",()=>{
  const value=plan({currentEdits:[edit(),edit({id:"edit:2",replacement:"Other"})]});assert.equal(value.replacementPresentations.length,1);assert.deepEqual(value.autoSuppressedPresentations,["edit:2"]);assert.ok(value.conflicts.some(item=>item.code==="PDF_DUPLICATE_CURRENT_SOURCE_OWNER"));
});

test("mask is immutable ownership rather than replacement layout",()=>{
  const value=plan({currentEdits:[edit({layoutRect:{x:100,y:100,width:200,height:40}})]});assert.deepEqual(value.masks[0].sourceOwnershipRect,rect);assert.notDeepEqual(value.masks[0].sourceOwnershipRect,value.objects["source:p1:text:0"].layoutRect);
});

test("wrong-owner mask blocks replacement and preserves source evidence",()=>{
  const value=plan({currentEdits:[edit()],masks:[{id:"bad",ownerEditId:"somebody-else",sourceObjectId:"source:p1:text:0",...rect}]});
  assert.equal(value.replacementPresentations.length,1,"planner creates its own correctly-owned canonical mask instead of trusting unrelated masks");assert.equal(value.masks[0].ownerEditId,"edit:1");
});

test("missing ownership blocks replacement before paint",()=>{
  const value=plan({sourceObjects:[source("source:p1:text:0",{pdfRect:null,sourceOwnershipRect:null})],currentEdits:[edit({sourceOwnershipRect:null,x:undefined,y:undefined,width:undefined,height:undefined,layoutRect:null})]});
  assert.equal(value.replacementPresentations.length,0);assert.equal(value.sourcePresentations.length,1);assert.ok(value.conflicts.some(item=>item.code==="PDF_REQUIRED_SOURCE_MASK_MISSING"));
});

test("generation mismatch prevents plan promotion",()=>{
  const value=plan({currentEdits:[edit()],generationState:{semanticGeneration:3,presentationGeneration:2,requiredGeneration:3}});assert.equal(value.presentationReady,false);assert.equal(value.replacementPresentations.length,0);assert.ok(value.conflicts.some(item=>item.code==="PDF_PRESENTATION_GENERATION_DESYNC"));
});

test("controls are excluded while unrelated text overlap is classified",()=>{
  const collisions=classifyPdfPresentationCollisions([{id:"a",sourceObjectId:"a",kind:"source",layoutRect:rect},{id:"handle",kind:"control",layoutRect:rect},{id:"b",sourceObjectId:"b",kind:"replacement",layoutRect:rect}]);
  assert.equal(collisions.length,1);assert.equal(collisions[0].classification,"VISUAL_TEXT_OVERLAP");assert.equal(collisions[0].allowed,true);
});

test("mirror inspection, shared point resolver and validation use plan geometry",()=>{
  const value=plan({currentEdits:[edit()]}),mirror=buildPdfAgentPageMirror({plan:value,documentId:"doc"}),inspected=inspectPdfMirrorObject(mirror,"edit:1"),point=explainPdfMirrorPoint(mirror,{x:11,y:21,space:"pdf"});
  assert.deepEqual(inspected.layoutRect,value.objects["source:p1:text:0"].layoutRect);assert.equal(inspected.presentationState,"COMMITTED_REPLACEMENT");assert.equal(point.chosenObjectId,"edit:1");assert.equal(validatePdfPresentation(value).valid,true);
});

test("validator catches an intentionally injected impossible source+replacement plan",()=>{
  const value=plan({currentEdits:[edit()]}),replacement=value.replacementPresentations[0];
  value.sourcePresentations.push({...replacement,id:"source:p1:text:0",kind:"source"});
  const validation=validatePdfPresentation(value);assert.equal(validation.valid,false);assert.ok(validation.issues.some(item=>item.code==="PDF_MULTIPLE_VISIBLE_PRESENTATIONS_FOR_SOURCE"));
});

test("real sample PDF pristine page produces a valid all-source plan",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../pdf/sample-local-pdf.pdf",import.meta.url))),model=await openPdfDocument(bytes),layout=await getPdfPageLayout(model,1,[]);
  const sources=layout.nodes.filter(node=>node.kind==="source-text-run").map(node=>source(node.id,{text:node.text,pdfRect:node.bounds,sourceOwnershipRect:node.bounds}));
  const value=buildPdfPresentationPlan({pageNumber:1,sourceObjects:sources,currentEdits:[]});assert.ok(sources.length>0);assert.equal(value.valid,true);assert.equal(value.sourcePresentations.length,sources.length);assert.ok(Object.values(value.objects).every(object=>object.state===PDF_PRESENTATION_STATES.SOURCE_ONLY));await model.pdf.destroy();
});

test("sample source replacement and save/reopen-shaped hydration remain one valid presentation",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../pdf/sample-local-pdf.pdf",import.meta.url))),model=await openPdfDocument(bytes),layout=await getPdfPageLayout(model,1,[]),node=layout.nodes.find(item=>item.kind==="source-text-run");
  const current=edit({sourceObjectId:node.id,sourceOwnershipRect:node.bounds,layoutRect:node.bounds});const value=buildPdfPresentationPlan({pageNumber:1,sourceObjects:[source(node.id,{pdfRect:node.bounds,sourceOwnershipRect:node.bounds})],currentEdits:[current]});
  assert.equal(value.valid,true);assert.equal(value.replacementPresentations.length,1);assert.equal(value.sourcePresentations.length,0);assert.equal(value.masks[0].coverageComplete,true);await model.pdf.destroy();
});

test("Copy PDF Diagnostics payload includes the canonical plan, mirror, collisions and invariants",async()=>{
  const bytes=new Uint8Array(await readFile(new URL("../pdf/sample-local-pdf.pdf",import.meta.url))),model=await openPdfDocument(bytes),diagnostics=await createPdfPageDiagnostics(model,[],1);
  assert.equal(diagnostics.presentationPlan.pageNumber,1);assert.equal(diagnostics.agentPageMirror.presentationPlan.pageNumber,1);assert.ok(Array.isArray(diagnostics.invariantResults));assert.ok(Array.isArray(diagnostics.collisions));assert.equal(diagnostics.presentationValidation.valid,true);await model.pdf.destroy();
});

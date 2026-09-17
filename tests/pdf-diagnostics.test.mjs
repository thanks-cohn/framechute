import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "../src/vendor/pdf-lib.mjs";
import { createPdfPageDiagnostics, extractSemanticPdfText, openPdfDocument, searchCurrentPdfDocument, serializeEditedPdf } from "../src/documents/pdf-document.js";
import {
  buildPdfDiagnosticSnapshot,
  capturePointerHitTest,
  capturePdfElementState,
  compareGeometryFingerprints,
  createBoundedGeometryJournal,
  createGeometryTransformChain,
  comparePdfSnapshots,
  createOwnedMask,
  currentPdfEdits,
  ensurePdfEditIdentity,
  pdfRectThroughViewportTransform,
  reconcileReopenedPdfObjects,
  rectangleDelta,
  transformPointThroughChain,
  verifyTransformRoundTrip
} from "../src/documents/pdf-observability.js";

test("edit identity never aliases its source and current boundary quarantines A/B",()=>{
  let n=0;const make=text=>ensurePdfEditIdentity({kind:"replacement",page:1,index:0,replacement:text,x:20,y:200,width:80,height:14,fontSize:12},{idFactory:()=>`edit:${++n}`});
  const a=make("A"),b=make("B"),c=make("C");
  assert.notEqual(a.id,a.sourceObjectId);assert.equal(a.sourceObjectId,"source:p1:text:0");
  assert.deepEqual(currentPdfEdits([a,b,c]).map(edit=>edit.id),[c.id]);
  assert.equal(a.versionState,"superseded");assert.equal(b.versionState,"superseded");assert.equal(c.versionState,"current");assert.equal(c.supersedes,b.id);
});

test("mask ownership is mandatory and diagnostics preserve corrupt raw geometry",()=>{
  assert.throws(()=>createOwnedMask({maskRole:"source",sourceObjectIds:[],pdfRect:{x:0,y:0,width:2,height:2}}),/ownerEditId/);
  const mask=createOwnedMask({ownerEditId:"edit:1",sourceObjectIds:["source:p1:text:0"],maskRole:"source",pdfRect:{x:1,y:2,width:3,height:4}});
  const snapshot=buildPdfDiagnosticSnapshot({page:1,objects:[{id:"bad",kind:"replacement",page:1,text:"bad",pdfRect:{x:NaN,y:2,width:-3,height:0}}],masks:[mask]});
  assert.equal(snapshot.objects[0].geometry.valid,false);
  assert.ok(snapshot.issues.some(issue=>issue.code==="GEOMETRY_NON_FINITE"&&issue.rawValue==="NaN"));
  assert.ok(snapshot.issues.some(issue=>issue.code==="GEOMETRY_NEGATIVE_DIMENSION"));
  assert.ok(snapshot.issues.some(issue=>issue.code==="GEOMETRY_ZERO_AREA"));
});

test("correspondence uses semantics and geometry, reports drift and ambiguity",()=>{
  const live={objects:[{id:"edit:1",kind:"replacement",page:1,text:"Current",pdfRect:{x:10,y:20,width:50,height:12},fontSize:10}]};
  let result=comparePdfSnapshots(live,{objects:[{id:"source:new",kind:"replacement",page:1,text:"Current",pdfRect:{x:11,y:20,width:50,height:12},fontSize:10}]},{position:.5});
  assert.equal(result.records[0].classification,"geometry-drift");
  result=comparePdfSnapshots(live,{objects:[1,2].map(n=>({id:`candidate:${n}`,kind:"replacement",page:1,text:"Current",pdfRect:{x:10,y:20,width:50,height:12},fontSize:10}))});
  assert.equal(result.records[0].classification,"ambiguous-correspondence");
  assert.ok(result.issues.some(issue=>issue.code==="AMBIGUOUS_CORRESPONDENCE"));
});

test("correspondence cannot hide historical or superseded reopened objects behind its active candidate filter",()=>{
  const live={objects:[{id:"edit:current",kind:"replacement",page:1,text:"C",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10}]};
  const reopened={objects:[
    {id:"edit:current",kind:"replacement",page:1,text:"C",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10,versionState:"current"},
    {id:"source:old",kind:"text",page:1,text:"A",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10,versionState:"historical"},
    {id:"edit:old",kind:"replacement",page:1,text:"B",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10,versionState:"superseded",supersededBy:"edit:current"}
  ]};
  const result=comparePdfSnapshots(live,reopened);
  assert.equal(result.records.find(record=>record.liveObjectId==="edit:current")?.classification,"exact-identity-match");
  assert.deepEqual(result.issues.filter(issue=>issue.code==="RESURRECTED_HISTORICAL_OBJECT").map(issue=>issue.objectId).sort(),["edit:old","source:old"]);
  assert.deepEqual(result.records.filter(record=>record.classification==="resurrected-historical-object").map(record=>record.reopenedObjectId).sort(),["edit:old","source:old"]);
});

test("unmatched legitimate reopened current objects are classified separately from historical resurrection",()=>{
  const live={objects:[{id:"edit:current",kind:"replacement",page:1,text:"C",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10}]};
  const reopened={objects:[
    {id:"edit:current",kind:"replacement",page:1,text:"C",pdfRect:{x:10,y:20,width:30,height:12},fontSize:10,versionState:"current"},
    {id:"edit:extra",kind:"free-text",page:1,text:"note",pdfRect:{x:60,y:20,width:30,height:12},fontSize:10,versionState:"current"}
  ]};
  const result=comparePdfSnapshots(live,reopened);
  assert.equal(result.records.find(record=>record.reopenedObjectId==="edit:extra")?.classification,"unexpected-current-object");
  assert.ok(result.issues.some(issue=>issue.code==="UNEXPECTED_CURRENT_OBJECT"&&issue.objectId==="edit:extra"));
  assert.equal(result.issues.some(issue=>issue.code==="RESURRECTED_HISTORICAL_OBJECT"&&issue.objectId==="edit:extra"),false);
});

test("DOM observation distinguishes layout geometry, glyph ink, identity and text metrics",()=>{
  const element={
    dataset:{objectId:"edit:7",sourceObjectId:"source:p1:text:2",ownerEditId:"edit:7",versionState:"current"},
    classList:["pdf-text-item"],
    textContent:"Coffee",
    querySelector:()=>null,
    getBoundingClientRect:()=>({left:110,top:220,width:80,height:20})
  };
  const style={
    getPropertyValue:name=>({display:"block",visibility:"visible",opacity:"1",transform:"none",position:"absolute","z-index":"2","pointer-events":"auto",overflow:"visible","clip-path":"none","font-family":"Helvetica","font-size":"12px","line-height":"14px","font-weight":"400","font-style":"normal",font:"12px Helvetica"}[name]||"")
  };
  const range={selectNodeContents(){},getClientRects:()=>[{left:112,top:223,width:54,height:11},{left:112,top:234,width:22,height:9}]};
  const context={font:"",measureText:()=>({width:53.5,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2,actualBoundingBoxLeft:0,actualBoundingBoxRight:53})};
  const observation=capturePdfElementState(element,{state:"idle",viewportRect:{left:100,top:200,width:600,height:800},getComputedStyle:()=>style,createRange:()=>range,createCanvas:()=>({getContext:()=>context})});
  assert.equal(observation.objectId,"edit:7");
  assert.equal(observation.sourceObjectId,"source:p1:text:2");
  assert.deepEqual(observation.layoutRect,{space:"pdf-viewport-css",x:10,y:20,width:80,height:20});
  assert.equal(observation.inkRects.length,2);
  assert.deepEqual(observation.clientRect,{space:"client-css",x:110,y:220,width:80,height:20});
  assert.deepEqual(observation.inkUnion,{space:"glyph-ink-client-css",x:112,y:223,width:54,height:20});
  assert.deepEqual(observation.inkViewportUnion,{space:"pdf-viewport-css",x:12,y:23,width:54,height:20});
  assert.equal(observation.textMetrics.width,53.5);
  assert.equal(observation.textMetrics.actualBoundingBoxAscent,8);
  assert.equal(observation.font.size,"12px");
  assert.equal(observation.pointerEvents,"auto");
});

test("diagnostics quantify expected viewport versus observed layout and ink deltas",()=>{
  const transform=[2,0,0,-2,0,600];
  assert.deepEqual(pdfRectThroughViewportTransform({x:10,y:20,width:30,height:10},transform),{space:"pdf-viewport-css",x:20,y:540,width:60,height:20});
  assert.deepEqual(rectangleDelta({x:20,y:540,width:60,height:20},{x:23,y:538,width:62,height:20}),{dx:3,dy:-2,dw:2,dh:0,maxAbs:3});
  const snapshot=buildPdfDiagnosticSnapshot({
    page:1,
    viewport:{transform},
    objects:[{id:"edit:1",kind:"replacement",page:1,text:"C",pdfRect:{x:10,y:20,width:30,height:10},coordinateSpace:"pdf-points"}],
    observations:[{objectId:"edit:1",layoutRect:{space:"viewport-css-pixels",x:23,y:538,width:62,height:20},inkUnion:{space:"glyph-ink-viewport",x:24,y:539,width:58,height:18}}]
  });
  const observation=snapshot.observations[0];
  assert.deepEqual(observation.layoutDelta,{dx:3,dy:-2,dw:2,dh:0,maxAbs:3});
  assert.ok(snapshot.issues.some(issue=>issue.code==="OBSERVED_LAYOUT_DRIFT"&&issue.objectId==="edit:1"));
  assert.ok(snapshot.issues.some(issue=>issue.code==="OBSERVED_INK_DRIFT"&&issue.objectId==="edit:1"));
});

test("explicit transform chains round trip and bounded journals discard old events",()=>{
  const chain=createGeometryTransformChain("pdf-points","client-css",[
    {kind:"pdf-viewport",matrix:[2,0,0,-2,0,600]},
    {kind:"text-layer-origin",matrix:[1,0,0,1,100,40]}
  ]);
  assert.deepEqual(transformPointThroughChain({x:10,y:20},chain),{x:120,y:600});
  assert.equal(verifyTransformRoundTrip({x:10,y:20},chain,1e-8).ok,true);
  const journal=createBoundedGeometryJournal(2);journal.record("pointerdown");journal.record("click");journal.record("dblclick");
  assert.deepEqual(journal.snapshot().map(entry=>entry.event),["click","dblclick"]);
});

test("geometry fingerprints distinguish shared chrome translation from desynchronization",()=>{
  const geometry=(canvasY,textY)=>({canvas:{clientRect:{rect:{x:10,y:canvasY,width:600,height:800}}},textLayer:{clientRect:{rect:{x:10,y:textY,width:600,height:800}}},surface:{scrollLeft:0,scrollTop:0},chrome:{toolbar:{rect:{x:0,y:0,width:800,height:40}},reader:{rect:{x:0,y:40,width:800,height:900}}},alignment:{originDelta:{x:0,y:textY-canvasY},widthDelta:0,heightDelta:0}});
  assert.equal(compareGeometryFingerprints(geometry(50,50),geometry(87,87),{cause:"toolbar-expanded"}).classification,"EXPECTED_SHARED_LAYOUT_SHIFT");
  const broken=compareGeometryFingerprints(geometry(50,50),geometry(87,50),{cause:"toolbar-expanded"});
  assert.equal(broken.classification,"CANVAS_ONLY_SHIFT");
  assert.ok(broken.issues.some(issue=>issue.code==="TOOLBAR_CHANGED_PAGE_COORDINATE_ORIGIN"));
});

test("hit-test dossier reports when chosen DOM object is farther than visible glyph",()=>{
  const target={tagName:"SPAN",classList:[],dataset:{objectId:"far"},closest(){return this;}};
  const dossier=capturePointerHitTest({type:"dblclick",clientX:15,clientY:15,target},null,{document:{elementFromPoint:()=>target,elementsFromPoint:()=>[target]},observations:[
    {objectId:"near",inkUnion:{x:10,y:10,width:10,height:10}},
    {objectId:"far",inkUnion:{x:100,y:100,width:10,height:10}}
  ]});
  assert.equal(dossier.candidatePdfObjects[0].objectId,"near");
  assert.ok(dossier.issues.some(issue=>issue.code==="POINTER_TARGET_DOES_NOT_MATCH_VISIBLE_GLYPH"));
});

test("production Save/fresh-open/search/diagnostics path preserves only C",async()=>{
  const source=await PDFDocument.create(),page=source.addPage([300,300]),font=await source.embedFont(StandardFonts.Helvetica);
  page.drawText("A",{x:20,y:220,size:12,font});
  const originalBytes=new Uint8Array(await source.save());
  const model=await openPdfDocument(originalBytes);
  let reopened;
  try{
    const history=["A","B","C"].map((text,index)=>({kind:"replacement",id:`edit:${index}`,page:1,index:0,original:"A",replacement:text,text,x:20,y:218,width:20,height:16,sourceX:20,sourceY:218,sourceWidth:20,sourceHeight:16,fontSize:12,fontFamily:"Helvetica",sourceObjectId:"source:p1:text:0",versionState:index===2?"current":"historical"}));
    const blob=await serializeEditedPdf(model,history);reopened=await openPdfDocument(await blob.arrayBuffer());
    assert.equal(reopened.reopenedCurrent.objects[0].id,"edit:2","fresh open reads the serializer's current-version manifest");
    assert.equal(await extractSemanticPdfText(reopened,[]),"C","production semantic extraction reconciles the fresh PDF");
    assert.equal((await searchCurrentPdfDocument(reopened,[],"C")).length,1);
    assert.equal((await searchCurrentPdfDocument(reopened,[],"A")).length,0,"old source is absent from current Search");
    assert.equal((await searchCurrentPdfDocument(reopened,[],"B")).length,0,"intermediate edit is absent from current Search");
    const diagnostics=await createPdfPageDiagnostics(reopened,[],1);
    assert.equal(diagnostics.documentVersionId,reopened.documentVersionId);
    assert.equal(diagnostics.objects.some(object=>object.text==="C"&&object.versionState==="current"),true);
    assert.equal(diagnostics.objects.some(object=>object.text==="A"&&object.versionState==="historical"),true);
    assert.equal(diagnostics.invariants.every(invariant=>invariant.ok),true);
    const secondSave=await serializeEditedPdf(reopened,[]),secondReopen=await openPdfDocument(await secondSave.arrayBuffer());
    try{assert.equal(await extractSemanticPdfText(secondReopen,[]),"C","a no-op Save preserves the current-version manifest");}
    finally{await secondReopen.pdf.destroy();}
  } finally {await model.pdf.destroy();await reopened?.pdf.destroy();}
});

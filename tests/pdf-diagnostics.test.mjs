import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "../src/vendor/pdf-lib.mjs";
import { createPdfPageDiagnostics, extractSemanticPdfText, openPdfDocument, searchCurrentPdfDocument, serializeEditedPdf } from "../src/documents/pdf-document.js";
import { buildPdfDiagnosticSnapshot, comparePdfSnapshots, createOwnedMask, currentPdfEdits, ensurePdfEditIdentity, reconcileReopenedPdfObjects } from "../src/documents/pdf-observability.js";

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

import test from "node:test";
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "../src/vendor/pdf-lib.mjs";
import { openPdfDocument, serializeEditedPdf } from "../src/documents/pdf-document.js";
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

test("real Save/reopen preserves only C in reconstructed current semantics",async()=>{
  const source=await PDFDocument.create(),page=source.addPage([300,300]),font=await source.embedFont(StandardFonts.Helvetica);
  page.drawText("A",{x:20,y:220,size:12,font});
  const originalBytes=new Uint8Array(await source.save());
  const model=await openPdfDocument(originalBytes);
  let reopened;
  try{
    const history=["A","B","C"].map((text,index)=>({kind:"replacement",id:`edit:${index}`,page:1,index:0,original:"A",replacement:text,text,x:20,y:218,width:20,height:16,sourceX:20,sourceY:218,sourceWidth:20,sourceHeight:16,fontSize:12,fontFamily:"Helvetica",sourceObjectId:"source:p1:text:0",versionState:index===2?"current":"historical"}));
    const blob=await serializeEditedPdf(model,history);reopened=await openPdfDocument(await blob.arrayBuffer());
    const pdfPage=await reopened.pdf.getPage(1),viewport=pdfPage.getViewport({scale:1}),content=await pdfPage.getTextContent();
    const extracted=content.items.filter(item=>item.str.trim()).map((item,index)=>{
      const x=item.transform[4],baseline=item.transform[5],height=Math.max(1,Math.hypot(item.transform[2],item.transform[3]));
      return {id:`reopened:${index}`,kind:"source-text-run",page:1,text:item.str,paintOrder:index,pdfRect:{x,y:baseline-height*.2,width:Math.max(1,item.width),height:height*1.2},fontSize:height};
    });
    const expected={id:"edit:2",kind:"replacement",page:1,text:"C",pdfRect:{x:20,y:218,width:20,height:16},fontSize:12};
    const reconciled=reconcileReopenedPdfObjects(extracted,[expected],{position:4});
    assert.equal(reconciled.current.some(object=>object.text==="C"),true);
    assert.equal(reconciled.current.some(object=>object.text==="A"||object.text==="B"),false);
    assert.equal(reconciled.historical.some(object=>object.text==="A"),true);
    const comparison=comparePdfSnapshots({objects:[expected]},{objects:reconciled.current.map(object=>({...object,kind:"replacement"}))},{position:4,size:25});
    assert.match(comparison.records[0].classification,/semantic-correspondence|geometry-drift/);
    assert.equal(viewport.scale,1);
  } finally {await model.pdf.destroy();await reopened?.pdf.destroy();}
});

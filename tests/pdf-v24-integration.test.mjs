import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument, StandardFonts } from "../src/vendor/pdf-lib.mjs";
import { createPdfPageLayout } from "../src/documents/pdf-layout.js";
import { buildPdfSourceMarginReconciliation, hydrateReopenedPdfCurrentObjects, remapPdfCurrentManifestForPageOperation } from "../src/documents/pdf-runtime-truth.js";
import { extractPdfPages, mergePdfBytes, openPdfDocument, serializeEditedPdf, transformPdfPages } from "../src/documents/pdf-document.js";

const source=(sourceIndex,text,x,y,width=60,overrides={})=>({sourceIndex,sourceRef:`p1:text:${sourceIndex}`,text,bounds:{x,y,width,height:12},fontSize:12,paintOrder:sourceIndex,...overrides});

test("production page layout ancestry drives coherent block reconciliation and real roles",()=>{
  const layout=createPdfPageLayout({page:1,pageBounds:{x:0,y:0,width:300,height:400},sourceRuns:[
    source(0,"Body",10,250,35),source(1,"first",48,250,32),source(2,"Body",10,236,35),source(3,"second",48,236,42),
    source(4,"12",145,3,10),source(5,"Running title",90,382,80)
  ]});
  const body=layout.nodes.filter(node=>node.kind==="source-text-run"&&node.text.startsWith("Body")||node.kind==="source-text-run"&&["first","second"].includes(node.text));
  assert.equal(body.length,4);
  const lines=body.map(run=>layout.get(run.parentId));
  assert.ok(lines.every(line=>line?.kind==="text-line"));
  assert.equal(new Set(lines.map(line=>line.parentId)).size,1,"both real lines belong to one real block");
  assert.equal(layout.get(lines[0].parentId).kind,"text-block");
  const plan=buildPdfSourceMarginReconciliation({layout,contentRect:{x:30,y:30,width:240,height:330}});
  const moved=plan.results.find(result=>result.memberIds.includes(body[0].id));
  assert.equal(moved.semanticUnit,"block");
  assert.deepEqual(new Set(moved.memberIds),new Set(body.map(run=>run.id)));
  assert.deepEqual(new Set(moved.members.map(member=>member.after.x-member.before.x)),new Set([20]));
  const pageNumber=layout.nodes.find(node=>node.text==="12"),runningTitle=layout.nodes.find(node=>node.text==="Running title");
  assert.equal(pageNumber.semanticRole,"PAGE_NUMBER");assert.equal(pageNumber.allowOutsideContentBounds,true);
  assert.equal(runningTitle.semanticRole,"HEADER");assert.equal(runningTitle.allowOutsideContentBounds,false,"geometry-only header inference is provisional, not a margin exemption");
  assert.ok(runningTitle.roleEvidence.includes("provisional-furniture-role-not-margin-exempt"));
  assert.equal(plan.edits.some(edit=>edit.original==="12"),false);
  assert.equal(plan.edits.some(edit=>edit.original==="Running title"),true,"provisional edge text remains margin-constrained");
});

test("explicit imported page furniture remains exempt from margin reconciliation",()=>{
  const layout=createPdfPageLayout({page:1,pageBounds:{x:0,y:0,width:300,height:400},sourceRuns:[
    source(0,"Explicit header",80,384,100,{semanticRole:"HEADER",roleConfidence:1,allowOutsideContentBounds:true})
  ]});
  const run=layout.nodes.find(node=>node.kind==="source-text-run");
  assert.equal(run.semanticRole,"HEADER");assert.equal(run.allowOutsideContentBounds,true);
  const plan=buildPdfSourceMarginReconciliation({layout,contentRect:{x:30,y:30,width:240,height:330}});
  assert.equal(plan.edits.length,0);
});

test("pure current-manifest remapper covers insertion, deletion, movement, rotation, and clone identity",()=>{
  const manifest={schemaVersion:1,documentVersionId:"d",objects:[{id:"a",page:1},{id:"b",page:2},{id:"c",page:3}]};
  assert.deepEqual(remapPdfCurrentManifestForPageOperation(manifest,3,{type:"add",page:1}).objects.map(o=>o.page),[1,3,4]);
  assert.deepEqual(remapPdfCurrentManifestForPageOperation(manifest,3,{type:"delete",page:2}).objects.map(o=>[o.id,o.page]),[["a",1],["c",2]]);
  assert.deepEqual(remapPdfCurrentManifestForPageOperation(manifest,3,{type:"move",page:1,to:3}).objects.map(o=>o.page),[3,1,2]);
  assert.deepEqual(remapPdfCurrentManifestForPageOperation(manifest,3,{type:"rotate",page:2}).objects.map(o=>o.page),[1,2,3]);
  const duplicated=remapPdfCurrentManifestForPageOperation(manifest,3,{type:"duplicate",page:2});
  assert.equal(new Set(duplicated.objects.map(o=>o.id)).size,4);
  assert.equal(duplicated.objects.find(o=>o.id==="c").page,4,"pages after the duplicate shift forward");
  assert.equal(duplicated.objects.find(o=>o.id==="b").page,2,"original edited page keeps its location");
  const clone=duplicated.objects.find(o=>o.cloneProvenance);
  assert.equal(clone.page,3);
  assert.deepEqual(clone.cloneProvenance,{sourceObjectId:"b",originPage:2,duplicatePage:3,operation:"duplicate-page"});
});

async function savedThreePagePdf(editPage=2){
  const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica);
  for(let page=1;page<=3;page++)pdf.addPage([300,300]).drawText(`Page ${page}`,{x:20,y:240,size:12,font});
  const model=await openPdfDocument(new Uint8Array(await pdf.save()));
  const edit={id:"edit:stable",kind:"replacement",page:editPage,index:0,original:`Page ${editPage}`,replacement:"Edited",x:20,y:238,width:70,height:18,sourceX:20,sourceY:238,sourceWidth:70,sourceHeight:18,fontSize:12,fontFamily:"Helvetica",sourceObjectId:`source:p${editPage}:text:0`,sourceLineId:`line:p${editPage}:origin`,versionState:"current"};
  const blob=await serializeEditedPdf(model,[edit]);await model.pdf.destroy();return new Uint8Array(await blob.arrayBuffer());
}

test("resulting transformed PDF bytes persist current page permutations across reopen",async()=>{
  let bytes=await savedThreePagePdf(2),reopened;
  bytes=await transformPdfPages(bytes,{type:"delete",page:1});reopened=await openPdfDocument(bytes);
  assert.equal(reopened.reopenedCurrent.objects[0].page,1);assert.equal(reopened.reopenedCurrent.objects[0].id,"edit:stable");await reopened.pdf.destroy();
  bytes=await savedThreePagePdf(1);bytes=await transformPdfPages(bytes,{type:"move",page:1,to:3});reopened=await openPdfDocument(bytes);
  assert.equal(reopened.reopenedCurrent.objects[0].page,3);assert.equal(reopened.reopenedCurrent.objects[0].sourceObjectId,"source:p1:text:0","source identity is explicit immutable origin provenance");await reopened.pdf.destroy();
  bytes=await savedThreePagePdf(2);bytes=await transformPdfPages(bytes,{type:"add",page:1});reopened=await openPdfDocument(bytes);assert.equal(reopened.reopenedCurrent.objects[0].page,3);await reopened.pdf.destroy();
  bytes=await savedThreePagePdf(2);bytes=await transformPdfPages(bytes,{type:"delete",page:2});reopened=await openPdfDocument(bytes);assert.equal(reopened.reopenedCurrent.objects.length,0);await reopened.pdf.destroy();
  bytes=await savedThreePagePdf(2);bytes=await transformPdfPages(bytes,{type:"duplicate",page:2});reopened=await openPdfDocument(bytes);
  assert.deepEqual(reopened.reopenedCurrent.objects.map(o=>o.page),[2,3]);assert.equal(new Set(reopened.reopenedCurrent.objects.map(o=>o.id)).size,2);assert.ok(reopened.reopenedCurrent.objects[1].cloneProvenance);
  const duplicateHydration=hydrateReopenedPdfCurrentObjects(reopened);
  assert.deepEqual(duplicateHydration.edits.map(edit=>edit.page),[2,3],"original and duplicate hydrate as separate live current objects");
  assert.equal(new Set(duplicateHydration.edits.map(edit=>edit.id)).size,2);
  await reopened.pdf.destroy();
});

test("duplicate remapping shifts later current objects in persisted bytes",async()=>{
  let bytes=await savedThreePagePdf(3),reopened;
  bytes=await transformPdfPages(bytes,{type:"duplicate",page:1});reopened=await openPdfDocument(bytes);
  assert.equal(reopened.reopenedCurrent.objects.find(object=>object.id==="edit:stable").page,4);
  await reopened.pdf.destroy();
});

test("extract and merge preserve current manifest page truth",async()=>{
  let bytes=await savedThreePagePdf(2),reopened;
  const extracted=await extractPdfPages(bytes,[2]);reopened=await openPdfDocument(extracted);
  assert.equal(reopened.pageCount,1);assert.equal(reopened.reopenedCurrent.objects.length,1);assert.equal(reopened.reopenedCurrent.objects[0].page,1);
  await reopened.pdf.destroy();

  bytes=await savedThreePagePdf(3);
  const addedPdf=await PDFDocument.create();addedPdf.addPage([300,300]);
  const merged=await mergePdfBytes(bytes,new Uint8Array(await addedPdf.save()),1);reopened=await openPdfDocument(merged);
  assert.equal(reopened.pageCount,4);assert.equal(reopened.reopenedCurrent.objects.find(object=>object.id==="edit:stable").page,4,"base current objects after insertion shift by added page count");
  await reopened.pdf.destroy();
});

import test from "node:test";
import assert from "node:assert/strict";
import { buildPdfPageDiagnosticSnapshot, comparePdfDiagnosticSnapshots, validatePdfPageSnapshot } from "../src/documents/pdf-diagnostics.js";
import { cssRectToDevicePixels, normalizePdfRect, pdfBaselineToViewport, pdfRectToViewportRect, viewportLocalRectToClient } from "../src/documents/pdf-geometry.js";

const viewport={scale:2,rotation:0,width:400,height:600,
  convertToViewportRectangle:([x1,y1,x2,y2])=>[x1*2,600-y1*2,x2*2,600-y2*2],
  convertToPdfPoint:(x,y)=>[x/2,(600-y)/2],convertToViewportPoint:(x,y)=>[x*2,600-y*2]};
const run={id:"source:p1:run:terminal",page:1,kind:"source-text-run",bounds:{x:10,y:20,width:30,height:8},sourceRefs:["pdfjs:7"],parentId:"line:1",childIds:[],readingOrder:0,paintOrder:7,provenance:"source",text:"tail"};
const line={id:"line:1",page:1,kind:"text-line",bounds:{x:10,y:20,width:30,height:8},sourceRefs:[run.id],parentId:"block:1",childIds:[run.id],readingOrder:0,paintOrder:7,provenance:"derived",text:"tail"};
const block={id:"block:1",page:1,kind:"text-block",bounds:{x:10,y:20,width:30,height:8},sourceRefs:[run.id],parentId:null,childIds:[line.id],readingOrder:0,paintOrder:7,provenance:"derived",text:"tail"};
const nodes=[run,line,block],byId=new Map(nodes.map(value=>[value.id,value]));
const layout={bounds:{x:0,y:0,width:200,height:300},nodes,get:id=>byId.get(id),neighbors:()=>({above:null,below:null,left:null,right:null,center:{x:0,y:0}})};

test("named geometry conversions identify coordinate space and round trip",()=>{
  assert.deepEqual(normalizePdfRect({x:4,y:8,width:-2,height:-3}),{x:2,y:5,width:2,height:3});
  const expected=pdfRectToViewportRect(viewport,run.bounds);
  assert.deepEqual(expected,{left:20,top:544,width:60,height:16});
  assert.deepEqual(viewportLocalRectToClient(expected,{left:100,top:50}),{left:120,top:594,width:60,height:16});
  assert.deepEqual(cssRectToDevicePixels(expected,1.25),{left:25,top:680,width:75,height:20});
  assert.deepEqual(pdfBaselineToViewport(viewport,{x:10,y:20}),{left:20,top:560});
});

test("one-page snapshot localizes semantic hierarchy, masks, edits, and Save geometry",()=>{
  const edit={id:"edit:terminal",kind:"replacement",page:1,index:7,x:10,y:20,width:35,height:10,fontSize:10,text:"ending",sourceRefs:[run.id]};
  const mask={x:8,y:18,width:34,height:12,maskRole:"source-line",maskIndex:7,maskOwnerId:edit.id};
  const snapshot=buildPdfPageDiagnosticSnapshot({page:1,layout,viewport,edits:[edit],masks:[mask],devicePixelRatio:1.25,state:"committed"});
  assert.doesNotThrow(()=>JSON.stringify(snapshot));
  assert.equal(snapshot.objects.find(value=>value.id===run.id).viewport.expectedRect.left,20);
  assert.equal(snapshot.objects.find(value=>value.id===edit.id).save.fontSize,10);
  assert.equal(snapshot.objects.find(value=>value.kind==="mask").save.ownerId,edit.id);
  assert.deepEqual(snapshot.issues,[]);
});

test("validator quarantines historical objects and reports invalid masks and geometry",()=>{
  const issues=validatePdfPageSnapshot({objects:[{id:"old",kind:"replacement",version:"historical",pdf:{x:0,y:0,width:-1,height:1},viewport:{expectedRect:{left:0,top:0,width:1,height:1}},observed:{layoutRect:{left:0,top:0,width:1,height:1}}},{id:"mask",kind:"mask",version:"current",pdf:{x:0,y:0,width:1,height:1},viewport:{expectedRect:{left:0,top:0,width:1,height:1}},save:{ownerId:null}}]});
  assert.ok(issues.some(value=>value.code==="HISTORICAL_OBJECT_RENDERED"));
  assert.ok(issues.some(value=>value.code==="NON_FINITE_PDF_GEOMETRY"));
  assert.ok(issues.some(value=>value.code==="MASK_WITHOUT_OWNER"));
});

test("live/save comparison detects changed geometry and resurrected objects",()=>{
  const live={objects:[{id:"edit:1",version:"current",pdf:{x:1,y:2,width:3,height:4}}]};
  const reopened={objects:[{id:"edit:1",version:"current",pdf:{x:20,y:2,width:3,height:4}},{id:"old-edit",version:"historical",pdf:{x:1,y:2,width:3,height:4}}]};
  const issues=comparePdfDiagnosticSnapshots(live,reopened);
  assert.ok(issues.some(value=>value.code==="LIVE_SAVE_GEOMETRY_MISMATCH"));
  assert.ok(issues.some(value=>value.code==="SAVE_REOPEN_RESURRECTED_TEXT"&&value.objectIds[0]==="old-edit"));
});

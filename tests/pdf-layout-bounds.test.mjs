import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PDF_MARGINS, createPdfMarginState, normalizePdfMargins,
  derivePdfContentRect, detectLayoutBoundViolations, isRectInsideLayoutBounds,
  constrainRectToLayoutBounds, constrainTranslationToLayoutBounds,
  constrainResizeToLayoutBounds, reconcileEditableGeometryToContentBounds
} from "../src/documents/pdf-layout-bounds.js";
import {
  unionPdfRects, stablePdfContentGroupId, createPdfContentGroup,
  translatePdfContentGroup
} from "../src/documents/pdf-content-groups.js";

const page={x:0,y:0,width:612,height:792};
const bounds={x:36,y:36,width:540,height:720};

test("default margin state separates visibility and enforcement",()=>{
  const state=createPdfMarginState();
  assert.equal(state.guidesVisible,false);
  assert.equal(state.constraintsEnabled,true);
  assert.deepEqual(state.defaultMargins,DEFAULT_PDF_MARGINS);
});

test("derives canonical bottom-left PDF content rectangle",()=>{
  assert.deepEqual(derivePdfContentRect(page,DEFAULT_PDF_MARGINS),bounds);
});

test("normalization preserves a usable region on tiny pages",()=>{
  const tiny={x:10,y:20,width:40,height:30};
  const margins=normalizePdfMargins(tiny,{left:36,right:36,top:36,bottom:36});
  assert.ok(margins.left+margins.right<=40);
  assert.ok(margins.top+margins.bottom<=30);
  assert.deepEqual(derivePdfContentRect(tiny,margins),{x:10,y:20,width:40,height:30});
});

test("active horizontal guide stops before collision",()=>{
  const margins=normalizePdfMargins({x:0,y:0,width:200,height:200},{left:190,right:30,top:0,bottom:0},{minimumWidth:72,activeEdge:"left"});
  assert.deepEqual(margins,{left:98,right:30,top:0,bottom:0});
});

test("active vertical guide stops before collision",()=>{
  const margins=normalizePdfMargins({x:0,y:0,width:200,height:200},{left:0,right:0,top:170,bottom:50},{minimumHeight:72,activeEdge:"top"});
  assert.deepEqual(margins,{left:0,right:0,top:78,bottom:50});
});

test("touching every boundary is legal",()=>{
  assert.equal(isRectInsideLayoutBounds(bounds,bounds),true);
  assert.deepEqual(detectLayoutBoundViolations({x:35,y:35,width:542,height:722},bounds).edges,["left","right","bottom","top"]);
});

test("individual edge and diagonal violations are exact",()=>{
  assert.deepEqual(detectLayoutBoundViolations({x:35,y:40,width:10,height:10},bounds).edges,["left"]);
  assert.deepEqual(detectLayoutBoundViolations({x:570,y:40,width:10,height:10},bounds).edges,["right"]);
  assert.deepEqual(detectLayoutBoundViolations({x:40,y:35,width:10,height:10},bounds).edges,["bottom"]);
  assert.deepEqual(detectLayoutBoundViolations({x:40,y:750,width:10,height:10},bounds).edges,["top"]);
  assert.deepEqual(detectLayoutBoundViolations({x:20,y:20,width:600,height:800},bounds).edges,["left","right","bottom","top"]);
});

test("rect containment translates by the smallest legal delta",()=>{
  const result=constrainRectToLayoutBounds({x:10,y:740,width:80,height:40},bounds);
  assert.deepEqual(result.rect,{x:36,y:716,width:80,height:40});
  assert.deepEqual(result.delta,{dx:26,dy:-24});
  assert.equal(result.status,"constrained");
});

test("oversized object reports overflow and is not shrunk",()=>{
  const source={x:0,y:0,width:600,height:40};
  const result=constrainRectToLayoutBounds(source,bounds);
  assert.equal(result.status,"overflow");
  assert.equal(result.reason,"object-larger-than-content-bounds");
  assert.deepEqual(result.rect,source);
});

test("translation clamps on all axes",()=>{
  const result=constrainTranslationToLayoutBounds({x:100,y:100,width:50,height:50},{dx:-200,dy:1000},bounds);
  assert.deepEqual(result.actualDelta,{dx:-64,dy:606});
  assert.equal(result.constrained,true);
});

test("resize stops at bounds and preserves image aspect ratio",()=>{
  const original={x:100,y:100,width:80,height:40};
  const result=constrainResizeToLayoutBounds(original,{x:100,y:100,width:600,height:200},bounds,{preserveAspectRatio:true});
  assert.equal(result.rect.width/result.rect.height,2);
  assert.equal(isRectInsideLayoutBounds(result.rect,bounds),true);
});

test("reconciliation moves edits but preserves typography and image data",()=>{
  const edits=[
    {id:"text",kind:"text",page:1,x:0,y:100,width:100,height:40,fontSize:19,text:"hello"},
    {id:"image",kind:"image",page:1,x:560,y:0,width:30,height:30,base64:"abc",mime:"image/png"}
  ];
  const result=reconcileEditableGeometryToContentBounds({edits,contentRect:bounds,page:1});
  assert.equal(result.changed,2);
  assert.equal(edits[0].x,36);assert.equal(edits[0].fontSize,19);assert.equal(edits[0].text,"hello");
  assert.equal(edits[1].x,546);assert.equal(edits[1].y,36);assert.equal(edits[1].base64,"abc");
});

test("group union supports text, images, and mixed content",()=>{
  assert.deepEqual(unionPdfRects([{x:10,y:20,width:30,height:40},{x:50,y:5,width:20,height:10}]),{x:10,y:5,width:60,height:55});
  const text=createPdfContentGroup({page:2,kind:"text-block",members:[{id:"a",x:10,y:20,width:30,height:10},{id:"b",x:10,y:5,width:50,height:10}]});
  const image=createPdfContentGroup({page:2,kind:"image-block",members:[{id:"image",x:70,y:5,width:20,height:20}]});
  const mixed=createPdfContentGroup({page:2,kind:"mixed-content-block",members:[...text.members.map(m=>({id:m.id,rect:m.rect})),...image.members.map(m=>({id:m.id,rect:m.rect}))]});
  assert.deepEqual(text.bounds,{x:10,y:5,width:50,height:25});
  assert.deepEqual(image.bounds,{x:70,y:5,width:20,height:20});
  assert.deepEqual(mixed.bounds,{x:10,y:5,width:80,height:25});
});

test("stable group identity ignores member input order",()=>{
  const a=stablePdfContentGroupId({page:1,kind:"image-block",members:[{id:"b"},{id:"a"}]});
  const b=stablePdfContentGroupId({page:1,kind:"image-block",members:[{id:"a"},{id:"b"}]});
  assert.equal(a,b);
});

test("group translation clamps envelope and preserves local geometry",()=>{
  const group=createPdfContentGroup({members:[{id:"a",x:50,y:50,width:20,height:20},{id:"b",x:80,y:70,width:10,height:10}]});
  const local=structuredClone(group.members.map(member=>member.localRect));
  const result=translatePdfContentGroup(group,{dx:-100,dy:-100},bounds);
  assert.deepEqual(result.group.bounds,{x:36,y:36,width:40,height:30});
  assert.deepEqual(result.group.members.map(member=>member.localRect),local);
  assert.deepEqual(result.translatedMembers.map(member=>member.rect),[{x:36,y:36,width:20,height:20},{x:66,y:56,width:10,height:10}]);
});

test("oversized group reports overflow without moving members",()=>{
  const group=createPdfContentGroup({members:[{id:"huge",x:0,y:0,width:600,height:20}]});
  const result=translatePdfContentGroup(group,{dx:20,dy:20},bounds);
  assert.equal(result.status,"overflow");
  assert.deepEqual(result.translatedMembers[0].rect,{x:0,y:0,width:600,height:20});
});

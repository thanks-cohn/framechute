import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyOverlap,
  createPdfLayoutCache,
  createPdfPageLayout,
  layoutRectsIntersect
} from "../src/documents/pdf-layout.js";

const bounds = { x:0, y:0, width:600, height:800 };
const run = (sourceIndex, text, x, y, width=40, height=10, extra={}) => ({
  sourceIndex, sourceRef:`stream:4:item:${sourceIndex}`, text,
  bounds:{ x, y, width, height }, fontSize:10, paintOrder:sourceIndex, ...extra
});

test("semantic IDs and hierarchy are deterministic and retain explicit provenance", () => {
  const input={ page:1, pageBounds:bounds, sourceRuns:[run(0,"Hello",20,700),run(1,"world",72,700)] };
  const first=createPdfPageLayout(input),second=createPdfPageLayout(input);
  assert.deepEqual(first.nodes.map(node=>node.id),second.nodes.map(node=>node.id));
  const line=first.nodes.find(node=>node.kind==="text-line");
  assert.equal(line.provenance,"derived");
  assert.deepEqual(first.children(line.id).map(node=>node.text),["Hello","world"]);
  assert.deepEqual(first.sourceLineage(line.id).map(node=>node.kind),["text-line","source-text-run","source-text-run"]);
});

test("line reconstruction restores geometric spaces without inventing spaces for joined runs", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"This PDF is",20,700,50),run(1,"three",78,700,25),run(2,"pages",103,700,25),run(3," long.",128,700,25)
  ]});
  assert.equal(layout.nodes.find(node=>node.kind==="text-line").text,"This PDF is threepages long.");
  assert.equal(layout.extractText(),"This PDF is threepages long.");
});

test("reading order keeps columns distinct from paint and spatial order", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"Left one",30,700,90),run(1,"Right one",330,700,90),
    run(2,"Left two",30,660,90),run(3,"Right two",330,660,90)
  ]});
  assert.equal(layout.extractText(),"Left one\n\nLeft two\n\nRight one\n\nRight two");
  const paint=layout.nodes.filter(node=>node.kind==="source-text-run").sort((a,b)=>a.paintOrder-b.paintOrder);
  assert.deepEqual(paint.map(node=>node.text),["Left one","Right one","Left two","Right two"]);
});

test("a later-painted replacement inherits its source line semantic position", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"First",20,740,50),run(1,"old middle",20,700,80),run(2,"Last",20,660,40)
  ],edits:[{
    id:"replacement:stable",kind:"replacement",page:1,index:1,replacement:"new middle",
    x:300,y:100,width:100,height:20,paintOrder:99
  }]});
  assert.equal(layout.extractText({applyEdits:false}),"First\n\nold middle\n\nLast");
  assert.equal(layout.extractText({applyEdits:true}),"First\n\nnew middle\n\nLast");
  const replacement=layout.get("replacement:stable"),source=layout.nodes.find(node=>node.metadata?.sourceIndex===1);
  assert.equal(replacement.readingOrder,source.readingOrder);
  assert.ok(replacement.paintOrder>source.paintOrder);
  assert.deepEqual(layout.sourceLineage(replacement.id).map(node=>node.kind),["replacement-text","text-line","source-text-run"]);
});

test("spatial queries return deterministic intersections, containment, and directional neighbors", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"above",100,300),run(1,"left",20,200),run(2,"right",220,200),run(3,"below",100,100)
  ]});
  const target={x:100,y:190,width:80,height:40};
  assert.deepEqual(layout.neighbors(target).above.text,"above");
  assert.deepEqual(layout.neighbors(target).below.text,"below");
  assert.deepEqual(layout.neighbors(target).left.text,"left");
  assert.deepEqual(layout.neighbors(target).right.text,"right");
  assert.equal(layout.intersections({x:15,y:195,width:60,height:20}).some(node=>node.text==="left"),true);
  assert.equal(layout.containing({x:25,y:205}).some(node=>node.text==="left"),true);
  assert.equal(layoutRectsIntersect({x:0,y:0,width:10,height:10},{x:10,y:0,width:10,height:10}),false);
});

test("collisions distinguish ownership, image intent, destructive edits, and uncertainty", () => {
  const box={x:0,y:0,width:20,height:20};
  const source={id:"source",kind:"source-text-run",bounds:box,editable:true};
  assert.equal(classifyOverlap({...source,ownerId:"line"},{id:"mask",ownerId:"line",kind:"replacement-text",bounds:box}),"owned");
  assert.equal(classifyOverlap(source,{id:"image",kind:"inserted-image",bounds:box,metadata:{wrapText:false}}),"intentional-overlay");
  assert.equal(classifyOverlap(source,{id:"image",kind:"inserted-image",bounds:box,metadata:{wrapText:true}}),"warning");
  assert.equal(classifyOverlap(source,{id:"edit",kind:"replacement-text",bounds:box,provenance:"replacement"}),"destructive");
  assert.equal(classifyOverlap(source,{id:"opaque",kind:"unknown-content",bounds:box}),"unknown");
});

test("free space is analytical and never claims completeness around unknown content", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:{x:0,y:0,width:100,height:100},regions:[
    {id:"opaque",kind:"unknown-content",bounds:{x:40,y:40,width:20,height:20},provenance:"unknown"}
  ]});
  const free=layout.freeSpace({minWidth:40,minHeight:40});
  assert.equal(free.complete,false);assert.equal(free.hasUnknown,true);
  assert.ok(free.regions.length>0);
  assert.ok(free.regions.every(rect=>!layoutRectsIntersect(rect,layout.get("opaque").bounds)));
});

test("layout cache is lazy, bounded, and invalidates only the affected page", () => {
  const cache=createPdfLayoutCache({maxPages:2});let builds=0;
  const get=page=>cache.get(page,()=>({page,serial:++builds}));
  assert.equal(get(1),get(1));get(2);get(3);
  assert.equal(cache.size,2);assert.equal(cache.peek(1),null);
  const page2=get(2);cache.invalidate(3);assert.equal(cache.peek(2),page2);assert.equal(cache.peek(3),null);
});

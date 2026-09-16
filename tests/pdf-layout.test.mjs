import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyOverlap,
  createPdfLayoutCache,
  createPdfPageLayout,
  layoutSemanticFlow,
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

test("line reconstruction keeps touching runs joined", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"three",20,700,25),run(1,"pages",45,700,25)
  ]});
  assert.equal(layout.nodes.find(node=>node.kind==="text-line").text,"threepages");
  assert.equal(layout.extractText(),"threepages");
});

test("line reconstruction inserts a space between visibly separated runs", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"three",20,700,25),run(1,"pages",52,700,25)
  ]});
  assert.equal(layout.nodes.find(node=>node.kind==="text-line").text,"three pages");
  assert.equal(layout.extractText(),"three pages");
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

test("full-width headings and footers do not bridge two reading columns", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[
    run(0,"Heading",30,750,540),
    run(1,"Left one",30,700,90),run(2,"Right one",330,700,90),
    run(3,"Left two",30,660,90),run(4,"Right two",330,660,90),
    run(5,"Footer",30,50,540)
  ]});
  assert.equal(layout.extractText(),"Heading\n\nLeft one\n\nLeft two\n\nRight one\n\nRight two\n\nFooter");
});

test("negative-index free text remains user-authored and participates in extraction", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[run(0,"Before",20,700,60),run(1,"After",20,600,60)],edits:[{
    kind:"text",id:"text:stable",page:1,index:-123,text:"Inserted",x:20,y:650,width:80,height:16
  }]});
  const free=layout.get("text:stable");
  assert.equal(free.kind,"free-text");assert.equal(free.provenance,"user-authored");
  assert.equal(layout.extractText(),"Before\n\nInserted\n\nAfter");
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

test("free-space sweep bounds candidates on text-heavy pages", () => {
  const sourceRuns=Array.from({length:500},(_,index)=>run(index,`line ${index}`,20,10+index*1.5,220,1));
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns});
  const free=layout.freeSpace({minWidth:20,minHeight:1,maxCandidates:12});
  assert.ok(free.regions.length<=12);
  assert.ok(free.regions.every(rect=>sourceRuns.every(item=>!layoutRectsIntersect(rect,item.bounds))));
});

test("layout cache is lazy, bounded, and invalidates only the affected page", () => {
  const cache=createPdfLayoutCache({maxPages:2});let builds=0;
  const get=page=>cache.get(page,()=>({page,serial:++builds}));
  assert.equal(get(1),get(1));get(2);get(3);
  assert.equal(cache.size,2);assert.equal(cache.peek(1),null);
  const page2=get(2);cache.invalidate(3);assert.equal(cache.peek(2),page2);assert.equal(cache.peek(3),null);
});

test("canonical flow normalizes source, replacement, and free text provenance", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[run(0,"Original",20,700,100)],edits:[
    {kind:"replacement",id:"edit",page:1,index:0,replacement:"Changed",x:20,y:700,width:100,height:12,fontSize:10},
    {kind:"text",id:"free",page:1,index:-1,text:"Note",x:20,y:100,width:100,height:20,fontSize:12}
  ]});
  assert.equal(layout.flow.id,"flow-page:p1");
  const flowRuns=layout.flow.regions.flatMap(region=>region.blocks).flatMap(block=>block.lines).flatMap(line=>line.runs);
  assert.ok(flowRuns.some(item=>item.text==="Changed"&&item.provenance==="replacement"));
  assert.ok(flowRuns.some(item=>item.text==="Note"&&item.provenance==="user-authored"));
});

test("semantic typesetter preserves font size and pushes same-block lines monotonically", () => {
  const result=layoutSemanticFlow({region:{x:20,y:100,width:180,height:300},blocks:[{id:"body",style:{fontSize:12},runs:[{
    id:"replacement",provenance:"replacement",text:"A substantially longer replacement sentence that wraps into several well spaced lines without shrinking."
  }]}]});
  assert.ok(result.lines.length>2);
  assert.ok(result.lines.every(line=>line.fontSize===12));
  assert.ok(result.lines.every((line,index)=>!index||line.y<result.lines[index-1].y));
  assert.equal(result.status,"fit");
});

test("source and replacement use identical readable lanes around a right image", () => {
  const input=provenance=>layoutSemanticFlow({region:{x:20,y:100,width:300,height:300},obstacles:[{x:220,y:250,width:90,height:100,wrapText:true}],
    blocks:[{id:"body",style:{fontSize:10},runs:[{id:provenance,provenance,text:"One ordinary paragraph uses the same obstacle geometry regardless of where its text originated."}]}]});
  assert.deepEqual(input("source").lines.map(({x,y,width})=>({x,y,width})),input("replacement").lines.map(({x,y,width})=>({x,y,width})));
  assert.ok(input("source").lines.filter(line=>line.y<350&&line.y>240).every(line=>line.x===20&&line.width===194));
});

test("wide centered image forces below flow instead of tiny side fragments", () => {
  const result=layoutSemanticFlow({region:{x:20,y:100,width:300,height:300},obstacles:[{x:70,y:220,width:200,height:130,wrapText:true}],
    blocks:[{id:"body",style:{fontSize:11},runs:[{text:"Words stay intact and begin below a centered publication image."}]}]});
  assert.ok(result.lines.every(line=>line.y+line.height<=214||line.y>=356));
  assert.ok(result.lines.every(line=>line.width===300));
  assert.ok(result.lines.every(line=>!line.text.includes(" ")||line.text.split(" ").every(Boolean)));
});

test("flow regions isolate columns and retain heading/footer roles", () => {
  const layout=createPdfPageLayout({page:1,pageBounds:bounds,sourceRuns:[run(0,"Heading",20,760,540),run(1,"Left",20,700,120),run(2,"Right",330,700,120),run(3,"Footer",20,40,540)]});
  assert.ok(layout.flow.regions.length>=2);
  const roles=layout.flow.regions.flatMap(region=>region.blocks.map(block=>block.role));
  assert.ok(roles.includes("spanning"));
});

test("impossible layout reports overflow without changing the selected size", () => {
  const result=layoutSemanticFlow({region:{x:0,y:0,width:100,height:20},blocks:[{style:{fontSize:18},runs:[{text:"This cannot fit safely"}]}]});
  assert.equal(result.status,"needs-more-space");
  assert.ok(result.fontSizes.every(size=>size===18));
});

import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "../src/vendor/pdf-lib.mjs";
import { wrapPdfText, wrapPdfTextBoxAroundImage, semanticWrapTarget, imageWrapEditsForPage, semanticLiveSourceMasks, pdfPageMaskPlan, clampPdfRectToBox, replacementMasksForEdit, inferPdfSourceFontSize, normalizePdfEdit, PDF_STANDARD_FONTS, resolvePdfStandardFont, serializeEditedPdf, updatePdfFreeText, reflowPdfTextEditGeometry, openPdfDocument, extractSemanticPdfText } from "../src/documents/pdf-document.js";

test("PDF font choices resolve only to packaged standard fonts", () => {
  assert.equal(PDF_STANDARD_FONTS.length, 9);
  assert.equal(resolvePdfStandardFont("not installed"), resolvePdfStandardFont("Helvetica"));
  assert.ok(resolvePdfStandardFont("Times Bold"));
});

test("PDF text layout preserves newlines, repeated spaces, and wraps to width", () => {
  const font = { widthOfTextAtSize: value => value.length * 5 };
  assert.deepEqual(wrapPdfText("one  two\n\nthree", font, 12, 100), ["one  two", "", "three"]);
  assert.deepEqual(wrapPdfText("abcdef", font, 12, 15), ["abc", "def"]);
});

test("free PDF text updates in place without losing identity, geometry, spaces, tabs, or newlines", () => {
  const edit = { kind:"text", id:"text:stable", page:1, index:-1, text:"New text", x:12, y:34, width:180, height:72, fontFamily:"Helvetica", fontSize:12 };
  const beforeGeometry = { x:edit.x, y:edit.y, width:edit.width, height:edit.height };
  assert.equal(updatePdfFreeText(edit, "hello  world\n\tindented"), true);
  assert.equal(edit.text, "hello  world\n\tindented");
  assert.equal(edit.id, "text:stable");
  assert.deepEqual({ x:edit.x, y:edit.y, width:edit.width, height:edit.height }, beforeGeometry);
  assert.equal(updatePdfFreeText(edit, "hello  world\n\tindented"), false);
});

test("long edits grow downward without silently changing the selected font size",()=>{
  const edit={kind:"replacement",text:"A long replacement that requires several ordinary lines of text",x:20,y:200,width:90,height:12,fontSize:10};
  const top=edit.y+edit.height;
  assert.equal(reflowPdfTextEditGeometry(edit),edit);
  assert.equal(edit.fontSize,10);
  assert.equal(edit.y+edit.height,top);
  assert.ok(edit.height>12);
});

test("PDF serialization accepts multiline edits and every offered font", async () => {
  const source = await PDFDocument.create(); source.addPage([300, 300]);
  const bytes = new Uint8Array(await source.save());
  const edits = PDF_STANDARD_FONTS.map(([fontFamily], index) => ({ page: 1, index, replacement: `line 1\nline 2`, x: 10, y: 280-index*25, width: 100, height: 20, fontSize: 8, fontFamily }));
  const blob = await serializeEditedPdf({ bytes }, edits);
  assert.equal(blob.type, "application/pdf");
  assert.ok(blob.size > bytes.length);
  await PDFDocument.load(await blob.arrayBuffer());
});

test("PDF serialization embeds an inserted PNG at canonical geometry", async () => {
  const source = await PDFDocument.create(); source.addPage([300, 300]);
  const bytes = new Uint8Array(await source.save());
  const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAFgAI/ScL9WQAAAABJRU5ErkJggg==";
  const blob = await serializeEditedPdf({ bytes }, [{ kind:"image",id:"image:1",index:-1,page:1,x:25,y:40,width:80,height:60,mime:"image/png",base64:png }]);
  const reopened = await PDFDocument.load(await blob.arrayBuffer());
  assert.equal(reopened.getPageCount(), 1);
  assert.ok(blob.size > bytes.length);
  assert.deepEqual(reopened.getPage(0).getSize(), { width:300, height:300 });
});

test("PDF serialization embeds a JPEG image record", async () => {
  const source=await PDFDocument.create();source.addPage([200,200]);const bytes=new Uint8Array(await source.save());
  const jpeg="/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==";
  const blob=await serializeEditedPdf({bytes},[{kind:"image",page:1,index:-2,x:12,y:15,width:30,height:30,mime:"image/jpeg",base64:jpeg}]);
  assert.equal((await PDFDocument.load(await blob.arrayBuffer())).getPageCount(),1);
});

test("PDF tabs remain canonical but expand at deterministic four-column stops", async()=>{
  const {growPdfTextField}=await import("../src/documents/pdf-document.js");
  const font={widthOfTextAtSize:value=>value.length};
  assert.deepEqual(wrapPdfText("a\tb",font,12,100),["a   b"]);
  const grown=growPdfTextField({kind:"text",page:1,x:2,y:80,width:100,height:12,fontSize:10,text:"a\nb"},2);
  assert.equal(grown.y+grown.height,92);assert.equal(grown.height,24);assert.equal(grown.y,68);
});

test("same-PDF movement mutates the existing image object without duplication",async()=>{
  const {repositionPdfImage}=await import("../src/documents/pdf-document.js");
  const image={kind:"image",id:"image:stable",x:1,y:2,width:3,height:4};const edits=[image];
  assert.equal(repositionPdfImage(image,{x:20,y:30,width:3,height:4}),image);
  assert.equal(edits.length,1);assert.equal(edits[0].id,"image:stable");assert.equal(edits[0].x,20);
  assert.deepEqual(structuredClone(edits),[{kind:"image",id:"image:stable",x:20,y:30,width:3,height:4}]);
});

test("PDF image text wrap chooses a clear lane and leaves nonintersecting text alone",()=>{
  const image={x:100,y:100,width:80,height:80};
  assert.equal(wrapPdfTextBoxAroundImage({x:10,y:200,width:70,height:12,pageWidth:300},image),null);
  const left=wrapPdfTextBoxAroundImage({x:60,y:130,width:80,height:12,pageWidth:300},image);
  assert.ok(left.x+left.width<=94);
  const right=wrapPdfTextBoxAroundImage({x:150,y:130,width:100,height:12,pageWidth:300},image);
  assert.ok(right.x>=186);
});

test("PDF image text wrap moves fully covered source text clear of the image",()=>{
  const image={x:80,y:80,width:120,height:120};
  const wrapped=wrapPdfTextBoxAroundImage({x:110,y:120,width:40,height:12,pageWidth:300},image);
  const overlaps=wrapped.x<image.x+image.width&&wrapped.x+wrapped.width>image.x&&wrapped.y<image.y+image.height&&wrapped.y+wrapped.height>image.y;
  assert.equal(overlaps,false);
});

test("semantic image wrap never teleports text upward and keeps source/replacement lane policy identical",()=>{
  const box={x:60,y:130,width:180,height:14,fontSize:10};
  const image={x:110,y:110,width:90,height:80};
  const source=semanticWrapTarget(box,image,{text:"ordinary paragraph words",fontSize:10});
  const replacement=semanticWrapTarget(box,image,{text:"ordinary paragraph words",fontSize:10});
  assert.deepEqual(replacement,source);
  assert.ok(source.y<=box.y,"forward flow may stay level or move downward, never upward");
  const overlaps=source.x<image.x+image.width&&source.x+source.width>image.x&&source.y<image.y+image.height&&source.y+source.height>image.y;
  assert.equal(overlaps,false);
});

test("explicit PDF replacements participate in the same image-wrap path as source text",()=>{
  const viewport={
    scale:1,width:300,transform:[1,0,0,1,0,0],
    convertToPdfPoint:(x,y)=>[x,y]
  };
  const content={items:[{str:"original words",transform:[1,0,0,10,60,144],width:180}]};
  const replacement={kind:"replacement",id:"replacement:0",page:1,index:0,replacement:"edited words stay with the paragraph",x:60,y:134,width:180,height:14,fontSize:10,fontFamily:"Helvetica"};
  const image={kind:"image",id:"image:1",page:1,index:-1,x:110,y:110,width:90,height:80,wrapText:true};
  const wraps=imageWrapEditsForPage(viewport,content,[replacement,image],1);
  assert.equal(wraps.length,1);
  assert.equal(wraps[0].sourceEditId,"replacement:0");
  assert.equal(wraps[0].replacement,"edited words stay with the paragraph");
  const wrapped=wraps[0];
  const overlaps=wrapped.x<image.x+image.width&&wrapped.x+wrapped.width>image.x&&wrapped.y<image.y+image.height&&wrapped.y+wrapped.height>image.y;
  assert.equal(overlaps,false);
});


test("live PDF masks erase the full semantic line band for changed source ranges",()=>{
  const line={id:"line:1",kind:"text-line",bounds:{x:20,y:100,width:180,height:12},childIds:["run:0","run:1"]};
  const run0={id:"run:0",kind:"source-text-run",bounds:{x:20,y:101,width:70,height:9},metadata:{sourceIndex:0}};
  const run1={id:"run:1",kind:"source-text-run",bounds:{x:95,y:101,width:105,height:9},metadata:{sourceIndex:1}};
  const parents=new Map([["run:0",line],["run:1",line]]);
  const layout={nodes:[run0,run1,line],parent:id=>parents.get(id)||null};
  const partial=semanticLiveSourceMasks(layout,[{kind:"replacement",page:1,index:0,sourceX:20,sourceY:101,sourceWidth:70,sourceHeight:9}],1,0);
  assert.equal(partial.length,1);
  assert.ok(partial[0].y<100&&partial[0].y+partial[0].height>112,"vertical eraser covers the entire semantic line band plus safety");
  assert.ok(partial[0].x<=20&&partial[0].x+partial[0].width<200,"partial edit does not erase the untouched end of the line");
  const full=semanticLiveSourceMasks(layout,[
    {kind:"replacement",page:1,index:0,sourceX:20,sourceY:101,sourceWidth:70,sourceHeight:9},
    {kind:"wrap",page:1,index:1,sourceX:95,sourceY:101,sourceWidth:105,sourceHeight:9}
  ],1,0);
  assert.equal(full.length,1);
  assert.ok(full[0].x<20&&full[0].x+full[0].width>200,"when every source run changed, the live eraser covers the entire semantic line");
});

test("live PDF mask claims the semantic line tail when the last source run is edited",()=>{
  const line={id:"line:tail",kind:"text-line",bounds:{x:20,y:100,width:180,height:12},childIds:["run:0","run:1","run:2"]};
  const run0={id:"run:0",kind:"source-text-run",bounds:{x:20,y:101,width:45,height:9},metadata:{sourceIndex:0}};
  const run1={id:"run:1",kind:"source-text-run",bounds:{x:70,y:101,width:45,height:9},metadata:{sourceIndex:1}};
  const run2={id:"run:2",kind:"source-text-run",bounds:{x:120,y:101,width:55,height:9},metadata:{sourceIndex:2}};
  const parents=new Map([["run:0",line],["run:1",line],["run:2",line]]);
  const layout={nodes:[run0,run1,run2,line],parent:id=>parents.get(id)||null};
  const masks=semanticLiveSourceMasks(layout,[{kind:"replacement",page:1,index:2,sourceX:120,sourceY:101,sourceWidth:55,sourceHeight:9}],1,0);
  assert.equal(masks.length,1);
  assert.ok(masks[0].x<=120,"terminal edit starts at its owned run");
  assert.ok(masks[0].x+masks[0].width>200,"terminal edit clears through the semantic line edge plus safety");
});

test("live PDF mask does not claim the line tail when an untouched source run follows",()=>{
  const line={id:"line:middle",kind:"text-line",bounds:{x:20,y:100,width:180,height:12},childIds:["run:0","run:1","run:2"]};
  const run0={id:"run:0",kind:"source-text-run",bounds:{x:20,y:101,width:45,height:9},metadata:{sourceIndex:0}};
  const run1={id:"run:1",kind:"source-text-run",bounds:{x:70,y:101,width:45,height:9},metadata:{sourceIndex:1}};
  const run2={id:"run:2",kind:"source-text-run",bounds:{x:120,y:101,width:55,height:9},metadata:{sourceIndex:2}};
  const parents=new Map([["run:0",line],["run:1",line],["run:2",line]]);
  const layout={nodes:[run0,run1,run2,line],parent:id=>parents.get(id)||null};
  const masks=semanticLiveSourceMasks(layout,[{kind:"replacement",page:1,index:1,sourceX:70,sourceY:101,sourceWidth:45,sourceHeight:9}],1,0);
  assert.equal(masks.length,1);
  assert.ok(masks[0].x+masks[0].width<120,"middle edit stays bounded before the untouched terminal run");
});

test("PDF Save and live preview share one semantic mask plan",()=>{
  const line={id:"line:save",kind:"text-line",bounds:{x:20,y:100,width:180,height:12},childIds:["run:0","run:1"]};
  const run0={id:"run:0",kind:"source-text-run",bounds:{x:20,y:101,width:70,height:9},metadata:{sourceIndex:0}};
  const run1={id:"run:1",kind:"source-text-run",bounds:{x:95,y:101,width:105,height:9},metadata:{sourceIndex:1}};
  const parents=new Map([["run:0",line],["run:1",line]]);
  const layout={nodes:[run0,run1,line],parent:id=>parents.get(id)||null};
  const edits=[{kind:"replacement",id:"edit:1",page:1,index:1,sourceX:95,sourceY:101,sourceWidth:105,sourceHeight:9,x:120,y:80,width:90,height:22}];
  const plan=pdfPageMaskPlan(layout,edits,[],1);
  const source=plan.find(mask=>mask.maskRole==="source-line");
  const field=plan.find(mask=>mask.maskRole==="field");
  assert.ok(source,"shared plan includes semantic source-line erasure");
  assert.ok(field,"shared plan includes the same replacement-field erasure visible in the editor");
  assert.ok(source.x+source.width>200,"terminal run cleanup reaches the semantic line tail");
});

test("PDF replacement masks clamp to page/CropBox bounds",()=>{
  assert.deepEqual(
    clampPdfRectToBox({x:-40,y:-10,width:500,height:400},{x:0,y:0,width:300,height:200}),
    {x:0,y:0,width:300,height:200}
  );
  assert.deepEqual(
    clampPdfRectToBox({x:30,y:40,width:50,height:60},{x:20,y:30,width:100,height:100}),
    {x:30,y:40,width:50,height:60}
  );
});


test("PDF replacement erases both original source and current field without bridging between them",()=>{
  const masks=replacementMasksForEdit({
    kind:"replacement",index:7,
    sourceX:10,sourceY:20,sourceWidth:40,sourceHeight:12,
    x:120,y:90,width:100,height:24
  });
  assert.equal(masks.length,2);
  const source=masks.find(mask=>mask.maskRole==="source");
  const field=masks.find(mask=>mask.maskRole==="field");
  assert.ok(source.x<10 && source.x+source.width>50);
  assert.ok(field.x<120 && field.x+field.width>220);
  assert.ok(source.x+source.width<field.x, "separate masks must not erase the strip between moved source and field");
});

test("resizing a PDF replacement field enlarges its erasure region",()=>{
  const small=replacementMasksForEdit({kind:"replacement",index:1,sourceX:20,sourceY:20,sourceWidth:30,sourceHeight:10,x:20,y:20,width:30,height:10})
    .find(mask=>mask.maskRole==="field");
  const large=replacementMasksForEdit({kind:"replacement",index:1,sourceX:20,sourceY:20,sourceWidth:30,sourceHeight:10,x:20,y:20,width:160,height:36})
    .find(mask=>mask.maskRole==="field");
  assert.ok(large.width>small.width);
  assert.ok(large.height>small.height);
});


test("PDF source font size is inferred once from the source transform",()=>{
  assert.equal(inferPdfSourceFontSize({transform:[1,0,0,10,0,0]}),10);
  assert.equal(inferPdfSourceFontSize({transform:[1,0,0,0,0,0]},11),11);
});

test("resizing a PDF replacement field never changes its explicit font size",()=>{
  const small=normalizePdfEdit({kind:"replacement",page:1,index:1,x:10,y:10,width:40,height:12,fontSize:10,replacement:"hello"});
  const large=normalizePdfEdit({...small,width:240,height:80});
  assert.equal(small.fontSize,10);
  assert.equal(large.fontSize,10);
});

test("semantic PDF extraction places a later replacement at its source position",async()=>{
  const source=await PDFDocument.create(),page=source.addPage([300,300]);
  page.drawText("First",{x:20,y:250});page.drawText("Middle",{x:20,y:220});page.drawText("Last",{x:20,y:190});
  const model=await openPdfDocument(await source.save());
  try {
    const text=await extractSemanticPdfText(model,[{kind:"replacement",id:"replacement:middle",page:1,index:2,replacement:"Changed",x:180,y:30,width:80,height:16}]);
    assert.equal(text,"First\nChanged\nLast");
    assert.ok(model.layoutCache.size<=3);
  } finally { await model.pdf.destroy(); }
});

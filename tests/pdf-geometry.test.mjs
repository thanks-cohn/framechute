import test from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "../src/vendor/pdf.mjs";
import { PDFDocument, degrees } from "../src/vendor/pdf-lib.mjs";
import { clampPdfZoom, fitPdfScale, pdfRectToViewport, viewportRectToPdf, validateFiniteRect, pdfRectToViewportRect, viewportLocalRectToPdf, cssRectToDevicePixels } from "../src/documents/pdf-geometry.js";

async function viewport(rotation, scale = 1, crop = { x: 17, y: 23, width: 300, height: 420 }) {
  const source = await PDFDocument.create();
  const page = source.addPage([400, 500]);
  page.setCropBox(crop.x, crop.y, crop.width, crop.height);
  page.setRotation(degrees(rotation));
  const loading = getDocument({ data: new Uint8Array(await source.save()) });
  const pdf = await loading.promise;
  const result = (await pdf.getPage(1)).getViewport({ scale });
  return { result, close: () => pdf.destroy() };
}

for (const rotation of [0, 90, 180, 270]) test(`PDF rectangle round trips at ${rotation} degrees with a CropBox offset`, async () => {
  const { result, close } = await viewport(rotation, 1.75);
  const original = { x: 42, y: 61, width: 73, height: 89 };
  const [left, top, right, bottom] = pdfRectToViewport(result, original);
  const actual = viewportRectToPdf(result, { left, top, width: right-left, height: bottom-top });
  for (const key of Object.keys(original)) assert.ok(Math.abs(actual[key] - original[key]) < 1e-8, `${key}: ${actual[key]}`);
  await close();
});

test("PDF geometry is independent of viewer zoom", async () => {
  const one = await viewport(90, 1), three = await viewport(90, 3);
  const original = { x: 40, y: 50, width: 60, height: 70 };
  for (const item of [one, three]) {
    const [left, top, right, bottom] = pdfRectToViewport(item.result, original);
    assert.deepEqual(viewportRectToPdf(item.result, { left, top, width:right-left, height:bottom-top }), original);
    await item.close();
  }
});

test("viewer zoom and fit calculations use bounded logical scales", () => {
  assert.equal(clampPdfZoom(.01), .25);
  assert.equal(clampPdfZoom(99), 5);
  assert.equal(fitPdfScale("width", {width:400,height:800}, {width:200,height:300}), .5);
  assert.equal(fitPdfScale("page", {width:400,height:800}, {width:200,height:300}), .375);
});

test("strict geometry rejects corruption without sanitizing evidence",()=>{
  const result=validateFiniteRect({x:NaN,y:Infinity,width:-2,height:0},{space:"pdf-points"});
  assert.equal(result.ok,false);assert.equal(Number.isNaN(result.raw.x),true);
  assert.deepEqual(result.errors.map(error=>error.code),["NON_FINITE","NON_FINITE","NEGATIVE_DIMENSION","ZERO_AREA"]);
  assert.equal(cssRectToDevicePixels({x:0,y:0,width:1,height:1},0).ok,false);
});

for(const scale of [.25,1,2.5,5])test(`named coordinate contracts round trip fractional tiny rect at ${scale}x`,async()=>{
  const {result,close}=await viewport(270,scale,{x:-17.5,y:23.25,width:300.5,height:420.75});
  const original={x:-3.125,y:41.875,width:.375,height:.625};
  const forward=pdfRectToViewportRect(original,result);assert.equal(forward.ok,true);
  const back=viewportLocalRectToPdf(forward.rect,result);assert.equal(back.ok,true);
  for(const key of Object.keys(original))assert.ok(Math.abs(back.rect[key]-original[key])<1e-7,`${key} round trip`);
  for(const dpr of [1,1.25,1.5,2])assert.equal(cssRectToDevicePixels(forward.rect,dpr).rect.width,forward.rect.width*dpr);
  await close();
});

import test from "node:test";
import assert from "node:assert/strict";
import { getDocument } from "../src/vendor/pdf.mjs";
import { PDFDocument, degrees } from "../src/vendor/pdf-lib.mjs";
import { clampPdfZoom, fitPdfScale, pdfRectToViewport, viewportRectToPdf } from "../src/documents/pdf-geometry.js";

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

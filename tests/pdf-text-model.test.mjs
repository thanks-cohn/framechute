import assert from "node:assert/strict";
import test from "node:test";
import { PDFDocument } from "../src/vendor/pdf-lib.mjs";
import { wrapPdfText, PDF_STANDARD_FONTS, resolvePdfStandardFont, serializeEditedPdf } from "../src/documents/pdf-document.js";

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

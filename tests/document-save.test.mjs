import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDocumentFilename, saveDocument, writeCompleteBlob } from "../src/documents/document-save.js";

test("normalizes native document extensions", () => {
  assert.equal(normalizeDocumentFilename("report", "pdf"), "report.pdf");
  assert.equal(normalizeDocumentFilename("report.PDF", ".pdf"), "report.PDF");
  assert.equal(normalizeDocumentFilename("draft.txt", "docx"), "draft.docx");
});

test("serializes the complete document before opening a writer", async () => {
  const order = [];
  const handle = { async createWritable() { order.push("writer"); return { async write() { order.push("write"); }, async close() { order.push("close"); } }; } };
  const result = await writeCompleteBlob(handle, async () => { order.push("serialize"); return new Blob(["document"]); });
  assert.equal(result.saved, true);
  assert.deepEqual(order, ["serialize", "writer", "write", "close"]);
});

test("serialization failure never opens or truncates the destination", async () => {
  let opened = false;
  const handle = { async createWritable() { opened = true; } };
  await assert.rejects(writeCompleteBlob(handle, async () => { throw new Error("bad document"); }), /bad document/);
  assert.equal(opened, false);
});

test("an unwritable source remains unsaved", async () => {
  const result = await writeCompleteBlob({ __framechuteSyntheticFile: new Blob() }, async () => new Blob(["edit"]));
  assert.deepEqual(result, { saved: false, reason: "unwritable" });
});

test("Save serializes once and writes the current writable handle", async () => {
  let serialized = 0, saveAsCalled = false, written = "";
  const handle = { async createWritable() { return { async write(blob) { written = await blob.text(); }, async close() {} }; } };
  const result = await saveDocument({ handle, serialize: async () => { serialized++; return new Blob(["visible state"]); }, saveAsWriter: async () => { saveAsCalled = true; } });
  assert.equal(result.saved, true); assert.equal(serialized, 1); assert.equal(saveAsCalled, false); assert.equal(written, "visible state");
});

test("Save fallback and Save As reuse the one serialized blob and adopt returned target", async () => {
  for (const saveAs of [false, true]) {
    let serialized = 0, received;
    const target = { name: "new.pdf" };
    const result = await saveDocument({ saveAs, handle: null, serialize: async () => { serialized++; return new Blob(["edited"]); }, saveAsWriter: async (blob) => { received = await blob.text(); return { saved: true, handle: target, blob }; } });
    assert.equal(serialized, 1); assert.equal(received, "edited"); assert.equal(result.handle, target);
  }
});

test("failed writes reject so callers keep dirty state", async () => {
  const handle = { async createWritable() { return { async write() { throw new Error("disk full"); }, async abort() {} }; } };
  await assert.rejects(saveDocument({ handle, serialize: async () => new Blob(["edit"]) }), /disk full/);
});

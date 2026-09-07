import test from "node:test";
import assert from "node:assert/strict";
import { beginInternalDrag, claimDocumentDrop, endInternalDrag, isInternalFrameChuteDrag, shouldGenericWorkspaceIngest, shouldShowGlobalIngest } from "../src/drag-ownership.mjs";
import { customImageSourceBlob } from "../src/custom-image-source.mjs";

const external = () => ({ dataTransfer: { items: [{ kind: "file", type: "image/png" }], files: [{ type: "image/png", name: "a.png" }], types: ["Files"] } });
test("internal image is never global ingest and can be claimed locally", () => {
  const block = { isConnected: true };
  beginInternalDrag({ block, kind: "image" });
  assert.equal(isInternalFrameChuteDrag(external()), true);
  assert.equal(shouldShowGlobalIngest(external()), false);
  assert.equal(claimDocumentDrop("docx", external()), true);
  assert.equal(shouldGenericWorkspaceIngest(external()), false);
  endInternalDrag();
});
test("external files use global ingest until a local editor handles them", () => {
  const event = external();
  assert.equal(shouldShowGlobalIngest(event), true);
  assert.equal(shouldGenericWorkspaceIngest(event), true);
  assert.equal(claimDocumentDrop("pdf", event), true);
  // Leaving the editor has no global claim to clear: workspace is immediately eligible.
  assert.equal(shouldShowGlobalIngest(event), true);
  assert.equal(shouldGenericWorkspaceIngest(event), true);
});

test("a real text-backed custom image resolves image bytes, never its marker text", async () => {
  const image = new Blob([new Uint8Array([137,80,78,71])], { type:"image/png" });
  const store={value:'__FLASHFRAME_CUSTOM_BLOCK_V1__'+JSON.stringify({kind:"image",handleKey:"image:1"})};
  const block={querySelector:()=>store};
  const blob=await customImageSourceBlob(block,{resolveHandle:async()=>({kind:"file",getFile:async()=>image})});
  assert.equal(blob.type,"image/png");assert.deepEqual(new Uint8Array(await blob.arrayBuffer()),new Uint8Array([137,80,78,71]));
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  activeInternalDrag,
  beginInternalDrag,
  claimDocumentDrop,
  endInternalDrag,
  handleInternalDragTermination,
  imageBlobsForDrop,
  isInternalFrameChuteDrag,
  shouldGenericWorkspaceIngest,
  shouldShowGlobalIngest
} from "../src/drag-ownership.mjs";
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

test("native image drag survives pointercancel until dragend and keeps source bytes", async () => {
  const block = { isConnected: true };
  const image = new Blob([new Uint8Array([255,216,255,217])], { type: "image/jpeg" });
  beginInternalDrag({ block, kind: "image", mode: "native-drag", sourceBlobProvider: async () => image });

  assert.equal(handleInternalDragTermination("pointercancel"), false);
  assert.equal(activeInternalDrag()?.block, block);
  assert.equal(shouldShowGlobalIngest(external()), false);

  const blobs = await imageBlobsForDrop(external());
  assert.equal(blobs.length, 1);
  assert.equal(blobs[0], image);

  assert.equal(handleInternalDragTermination("dragend"), true);
  assert.equal(activeInternalDrag(), null);
});

test("pointer-manipulation sessions still clean up on pointercancel", () => {
  const block = { isConnected: true };
  beginInternalDrag({ block, kind: "image", mode: "pointer-manipulation" });
  assert.equal(handleInternalDragTermination("pointercancel"), true);
  assert.equal(activeInternalDrag(), null);
});

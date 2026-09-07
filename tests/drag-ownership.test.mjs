import test from "node:test";
import assert from "node:assert/strict";
import { beginInternalDrag, claimDocumentDrop, endInternalDrag, isInternalFrameChuteDrag, shouldGenericWorkspaceIngest, shouldShowGlobalIngest } from "../src/drag-ownership.mjs";

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
});

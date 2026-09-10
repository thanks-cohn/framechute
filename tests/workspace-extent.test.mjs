import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_EXPANSION_STEP,
  clampBlockToExtent,
  edgePanDelta,
  requiredPositiveExpansion
} from "../src/workspace-extent.js";

test("visible-toolbar bounded canvas clamps blocks inside the frozen extent", () => {
  assert.deepEqual(
    clampBlockToExtent({ left: -80, top: 1700, width: 300, height: 200, workspaceWidth: 2400, workspaceHeight: 1600 }),
    { left: 0, top: 1400 }
  );
  assert.deepEqual(
    clampBlockToExtent({ left: 2350, top: -20, width: 300, height: 200, workspaceWidth: 2400, workspaceHeight: 1600 }),
    { left: 2100, top: 0 }
  );
});

test("hidden-toolbar expandable canvas grows in measured slabs", () => {
  assert.deepEqual(
    requiredPositiveExpansion({ left: 2250, top: 1450, width: 400, height: 300, workspaceWidth: 2400, workspaceHeight: 1600 }),
    { addWidth: WORKSPACE_EXPANSION_STEP, addHeight: WORKSPACE_EXPANSION_STEP }
  );
  assert.deepEqual(
    requiredPositiveExpansion({ left: 3500, top: 100, width: 500, height: 200, workspaceWidth: 2400, workspaceHeight: 1600 }),
    { addWidth: WORKSPACE_EXPANSION_STEP * 3, addHeight: 0 }
  );
});

test("carrying a block near a viewport edge requests pan without implying growth", () => {
  assert.deepEqual(
    edgePanDelta({ clientX: 1195, clientY: 450, viewportWidth: 1200, viewportHeight: 800, scrollX: 400, scrollY: 300 }),
    { dx: 22, dy: 0 }
  );
  assert.deepEqual(
    edgePanDelta({ clientX: 10, clientY: 795, viewportWidth: 1200, viewportHeight: 800, scrollX: 400, scrollY: 300 }),
    { dx: -19, dy: 22 }
  );
});

test("edge panning never asks to scroll past the canvas origin", () => {
  assert.deepEqual(
    edgePanDelta({ clientX: 0, clientY: 0, viewportWidth: 1200, viewportHeight: 800, scrollX: 0, scrollY: 0 }),
    { dx: 0, dy: 0 }
  );
});

import test from "node:test";
import assert from "node:assert/strict";
import {
  WORKSPACE_EXPANSION_STEP,
  WORKSPACE_NEGATIVE_RUNWAY,
  edgePanDelta,
  requiredPositiveExpansion
} from "../src/workspace-extent.js";

test("negative-space runway is preallocated rather than grown during a drag", () => {
  assert.equal(WORKSPACE_NEGATIVE_RUNWAY, 8192);
  assert.ok(WORKSPACE_NEGATIVE_RUNWAY > WORKSPACE_EXPANSION_STEP * 8);
});

test("workspace growth keeps far-right and far-bottom placements reachable", () => {
  assert.deepEqual(
    requiredPositiveExpansion({ left: 2350, top: 1500, width: 500, height: 300, workspaceWidth: 2400, workspaceHeight: 1600 }),
    { addWidth: WORKSPACE_EXPANSION_STEP, addHeight: WORKSPACE_EXPANSION_STEP }
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

import test from "node:test";
import assert from "node:assert/strict";
import { contentBounds, outputDimensions, squareBounds, validateRasterSize } from "../src/workspace-snapshot-bounds.mjs";

test("content bounds include negative, distant, visible objects and padding", () => {
  assert.deepEqual(contentBounds([
    { left: -30, top: -10, width: 100, height: 60 },
    { left: 900, top: 400, width: 200, height: 150 },
    { left: 5000, top: 5000, width: 50, height: 50, visible: false }
  ], 20), { left: -50, top: -30, right: 1120, bottom: 570, width: 1170, height: 600 });
});

test("bounds shrink with an outer object removed and do not depend on viewport", () => {
  const near = { left: 10, top: 10, width: 100, height: 100 };
  const far = { left: 500, top: 10, width: 100, height: 100 };
  assert.ok(contentBounds([near, far]).width > contentBounds([near]).width);
  assert.deepEqual(contentBounds([near, far]), contentBounds([near, far]));
});

test("scale changes pixels without changing geometry and huge rasters fail safely", () => {
  const bounds = contentBounds([{ left: 0, top: 0, width: 100, height: 50 }], 0);
  assert.deepEqual(outputDimensions(bounds, 2), { width: 200, height: 100 });
  assert.equal(validateRasterSize(outputDimensions(bounds, 2)), "");
  assert.match(validateRasterSize({ width: 20000, height: 20000 }), /too large/);
  assert.equal(contentBounds([]), null);
});

test("square framing centers tight bounds without stretching content", () => {
  assert.deepEqual(squareBounds({ left: 10, top: 20, right: 1210, bottom: 820, width: 1200, height: 800 }), {
    left: 10, top: -180, right: 1210, bottom: 1020, width: 1200, height: 1200
  });
  assert.deepEqual(squareBounds({ left: -50, top: -25, right: 350, bottom: 775, width: 400, height: 800 }), {
    left: -250, top: -25, right: 550, bottom: 775, width: 800, height: 800
  });
});

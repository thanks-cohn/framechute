import test from "node:test";
import assert from "node:assert/strict";
import { sourceMaskForEdit, sourceMasksForPage } from "../src/documents/pdf-document.js";

const edit = {
  page: 2, index: 4, replacement: "GOODBYE",
  sourceX: 10, sourceY: 20, sourceWidth: 30, sourceHeight: 12,
  x: 80, y: 90, width: 70, height: 18, fontSize: 10
};

test("source mask geometry is independent of replacement geometry", () => {
  const before = sourceMaskForEdit(edit);
  const movedAndResized = { ...edit, x: 180, y: 190, width: 140, height: 36, fontSize: 30 };
  assert.deepEqual(sourceMaskForEdit(movedAndResized), before);
  assert.deepEqual(before, { x: 10, y: 20, width: 30, height: 12 });
});

test("an empty replacement retains its source mask", () => {
  assert.deepEqual(sourceMaskForEdit({ ...edit, replacement: "" }), sourceMaskForEdit(edit));
});

test("page rerender mask state is derived only from current edit records", () => {
  const otherPage = { ...edit, page: 3, index: 5 };
  assert.deepEqual(sourceMasksForPage([edit, otherPage], 2), [sourceMaskForEdit(edit)]);
  assert.deepEqual(sourceMasksForPage([], 2), []);
  assert.deepEqual(sourceMasksForPage([otherPage], 2), []);
});

test("restored history snapshots determine mask and replacement records together", () => {
  const undo = [];
  const redo = [];
  let current = [];
  undo.push(structuredClone(current));
  current = [structuredClone(edit)];
  redo.push(structuredClone(current));
  current = undo.pop();
  assert.deepEqual(sourceMasksForPage(current, 2), []);
  current = redo.pop();
  assert.deepEqual(current, [edit]);
  assert.deepEqual(sourceMasksForPage(current, 2), [sourceMaskForEdit(edit)]);
});

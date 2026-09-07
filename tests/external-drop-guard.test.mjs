import test from "node:test";
import assert from "node:assert/strict";

import { isExternalDrag } from "../src/external-drop-guard.mjs";

function drag({ types = [], items = [] } = {}) {
  return { dataTransfer: { types, items } };
}

test("external drop recognition accepts files and browser URL payloads", () => {
  assert.equal(isExternalDrag(drag({ types: ["Files"], items: [{ kind: "file" }] })), true);
  assert.equal(isExternalDrag(drag({ types: ["text/uri-list"] })), true);
  assert.equal(isExternalDrag(drag({ types: ["text/html", "text/plain"] })), true);
});

test("empty and application-only drags cannot activate global ingestion", () => {
  assert.equal(isExternalDrag(drag()), false);
  assert.equal(isExternalDrag(drag({ types: ["application/x-unrelated"] })), false);
  assert.equal(isExternalDrag(null), false);
});

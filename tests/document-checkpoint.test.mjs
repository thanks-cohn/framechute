import assert from "node:assert/strict";
import test from "node:test";
import { createDocumentCheckpointCoordinator } from "../src/document-checkpoint.mjs";

const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

test("an edit during a delayed checkpoint is captured before persistence is acknowledged", async () => {
  const document = { text:"first" }, firstWrite = deferred(), writes = [];
  const checkpoints = createDocumentCheckpointCoordinator({
    capture: async value => value.text,
    write: async (_value, text, revision) => {
      writes.push({ text, revision });
      if (writes.length === 1) await firstWrite.promise;
    }
  });

  const pending = checkpoints.checkpoint(document);
  await new Promise(resolve => setTimeout(resolve, 0));
  document.text = "newer";
  checkpoints.markChanged(document);
  firstWrite.resolve();
  await pending;

  assert.deepEqual(writes.map(write => write.text), ["first", "newer"]);
  assert.equal(checkpoints.persistedRevision(document), checkpoints.revision(document));
});

test("concurrent checkpoint callers share ordered writes and finish at the newest revision", async () => {
  const document = { text:"one" }, gate = deferred(), writes = [];
  const checkpoints = createDocumentCheckpointCoordinator({
    capture: async value => value.text,
    write: async (_value, text) => { writes.push(text); if (writes.length === 1) await gate.promise; }
  });
  const first = checkpoints.checkpoint(document);
  await new Promise(resolve => setTimeout(resolve, 0));
  document.text = "two";
  checkpoints.markChanged(document);
  const second = checkpoints.checkpoint(document);
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(writes, ["one", "two"]);
});

test("a failed checkpoint is retryable and never advances the durable revision", async () => {
  const document = {};
  let writes = 0;
  const checkpoints = createDocumentCheckpointCoordinator({
    capture: async () => "state",
    write: async () => { writes += 1; if (writes === 1) throw new DOMException("full", "QuotaExceededError"); }
  });
  await assert.rejects(checkpoints.checkpoint(document), error => error.name === "QuotaExceededError");
  assert.equal(checkpoints.persistedRevision(document), 0);
  await checkpoints.checkpoint(document);
  assert.equal(checkpoints.persistedRevision(document), checkpoints.revision(document));
});

import assert from "node:assert/strict";
import test from "node:test";
import { isTransientSyntheticHandle, resolveHandle, storeHandle } from "../src/file-access.js";
import { getDocumentWorkingCopy, putDocumentWorkingCopy } from "../src/file-access.js";

const memoryDbControl = { failWrites: false };

function installMemoryIndexedDb() {
  const stores = new Map();
  globalThis.indexedDB = {
    open() {
      const request = {};
      queueMicrotask(() => {
        const db = {
          objectStoreNames: { contains: name => stores.has(name) },
          createObjectStore(name) { stores.set(name, new Map()); },
          transaction(name) {
            const transaction = { error: null };
            transaction.objectStore = () => ({
              put(value) {
                if (memoryDbControl.failWrites) throw new DOMException("Storage quota exceeded", "QuotaExceededError");
                stores.get(name).set(value.id, structuredClone(value));
              },
              get(id) {
                const result = {};
                queueMicrotask(() => { result.result = structuredClone(stores.get(name).get(id)); result.onsuccess?.(); });
                return result;
              }
            });
            queueMicrotask(() => transaction.oncomplete?.());
            return transaction;
          },
          close() {}
        };
        request.result = db;
        request.onupgradeneeded?.();
        request.onsuccess?.();
      });
      return request;
    }
  };
}

test("stores and resolves function-bearing FCX directories without IndexedDB", async () => {
  const directory = {
    kind: "directory",
    __framechuteSyntheticDirectory: true,
    async *entries() {},
    async getFileHandle() {}
  };
  assert.equal(isTransientSyntheticHandle(directory), true);
  assert.equal(isTransientSyntheticHandle({ kind: "directory" }), false);
  await storeHandle("fcx:test-directory", directory);
  assert.equal(await resolveHandle("fcx:test-directory"), directory);
});

test("persists and restores a PDF working copy independently of its original handle", async () => {
  installMemoryIndexedDb();
  const bytes = new Blob(["%PDF-working-copy"], { type: "application/pdf" });
  await putDocumentWorkingCopy("pdf:durable", bytes, { name: "example.pdf", lastModified: 42 });
  const restored = await getDocumentWorkingCopy("pdf:durable");
  assert.equal(restored.name, "example.pdf");
  assert.equal(restored.lastModified, 42);
  assert.equal(await restored.blob.text(), "%PDF-working-copy");
});

test("synthetic DOCX ingestion creates a durable working copy", async () => {
  installMemoryIndexedDb();
  const file = new File(["docx package bytes"], "dropped.docx", {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    lastModified: 77
  });
  await storeHandle("docx:dropped", { kind: "file", name: file.name, __framechuteSyntheticFile: file });
  const restored = await getDocumentWorkingCopy("docx:dropped");
  assert.equal(restored.name, "dropped.docx");
  assert.equal(await restored.blob.text(), "docx package bytes");
});

test("a quota failure rejects the document checkpoint instead of claiming persistence", async () => {
  await putDocumentWorkingCopy("pdf:quota", new Blob(["last valid"], { type: "application/pdf" }));
  memoryDbControl.failWrites = true;
  try {
    await assert.rejects(
      putDocumentWorkingCopy("pdf:quota", new Blob(["bytes"], { type: "application/pdf" })),
      error => error?.name === "QuotaExceededError"
    );
  } finally {
    memoryDbControl.failWrites = false;
  }
  assert.equal(await (await getDocumentWorkingCopy("pdf:quota")).blob.text(), "last valid");
});

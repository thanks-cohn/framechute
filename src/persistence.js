const DB_NAME = "flashframe";
const DB_VERSION = 1;

let dbPromise;

function openDatabase() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    let request;
    let settled = false;

    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      callback(value);
    };

    const timeout = setTimeout(() => {
      finish(reject, new Error("FrameChute local database did not respond in time."));
    }, 4000);

    try {
      if (!globalThis.indexedDB) {
        finish(reject, new Error("IndexedDB is unavailable in this browser context."));
        return;
      }
      request = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      finish(reject, error);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;

      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("handles")) {
        db.createObjectStore("handles", { keyPath: "id" });
      }

      if (!db.objectStoreNames.contains("content")) {
        db.createObjectStore("content", { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      if (settled) {
        request.result?.close?.();
        return;
      }
      finish(resolve, request.result);
    };
    request.onerror = () => finish(reject, request.error || new Error("FrameChute local database could not be opened."));
    request.onblocked = () => finish(reject, new Error("FrameChute local database is blocked by another browser context."));
  }).catch((error) => {
    dbPromise = undefined;
    throw error;
  });

  return dbPromise;
}

async function withStore(storeName, mode, work) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;

    try {
      result = work(store);
    } catch (error) {
      reject(error);
      return;
    }

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export async function saveSnapshot(snapshot) {
  await withStore("snapshots", "readwrite", (store) => store.put(snapshot));
}

export async function listSnapshots() {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("snapshots", "readonly");
    const request = transaction.objectStore("snapshots").getAll();

    request.onsuccess = () => {
      const snapshots = request.result ?? [];
      snapshots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      resolve(snapshots);
    };

    request.onerror = () => reject(request.error);
  });
}

export async function getSnapshot(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("snapshots", "readonly");
    const request = transaction.objectStore("snapshots").get(id);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function putHandle(id, handle) {
  await withStore("handles", "readwrite", (store) => store.put({ id, handle }));
}

export async function getHandle(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("handles", "readonly");
    const request = transaction.objectStore("handles").get(id);

    request.onsuccess = () => resolve(request.result?.handle ?? null);
    request.onerror = () => reject(request.error);
  });
}

export async function putContent(id, value) {
  await withStore("content", "readwrite", (store) => store.put({ id, value }));
}

export async function getContent(id) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction("content", "readonly");
    const request = transaction.objectStore("content").get(id);

    request.onsuccess = () => resolve(request.result?.value ?? null);
    request.onerror = () => reject(request.error);
  });
}

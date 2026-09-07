import { storeHandle } from "../file-access.js";

export function normalizeDocumentFilename(name, extension) {
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  const value = String(name || "document").trim() || "document";
  return value.toLowerCase().endsWith(ext.toLowerCase()) ? value : `${value.replace(/\.[^./\\]+$/, "")}${ext}`;
}

async function writableHandle(handle) {
  if (!handle || handle.__framechuteSyntheticFile || typeof handle.createWritable !== "function") return false;
  if (typeof handle.queryPermission !== "function") return true;
  let permission = await handle.queryPermission({ mode: "readwrite" });
  if (permission !== "granted" && typeof handle.requestPermission === "function") {
    permission = await handle.requestPermission({ mode: "readwrite" });
  }
  return permission === "granted";
}

export async function writeBlobToHandle(handle, blob) {
  if (!(blob instanceof Blob)) throw new TypeError("Document serializer did not return a Blob");
  if (!await writableHandle(handle)) return { saved: false, reason: "unwritable" };
  const writer = await handle.createWritable();
  try {
    await writer.write(blob);
    await writer.close();
  } catch (error) {
    try { await writer.abort?.(); } catch { /* Preserve the original error. */ }
    throw error;
  }
  return { saved: true, handle, blob };
}

export async function writeCompleteBlob(handle, serialize) {
  // Serialization deliberately precedes createWritable: a parser/generator
  // failure can never truncate the user's existing document.
  return writeBlobToHandle(handle, await serialize());
}

/** Serialize canonical visible state once, then apply Save/Save As policy. */
export async function saveDocument({ serialize, handle, saveAs = false, saveAsWriter }) {
  const blob = await serialize();
  if (!(blob instanceof Blob)) throw new TypeError("Document serializer did not return a Blob");
  if (!saveAs) {
    const result = await writeBlobToHandle(handle, blob);
    if (result.saved) return result;
  }
  if (typeof saveAsWriter !== "function") return { saved: false, reason: "unwritable" };
  return saveAsWriter(blob);
}

export async function saveDocumentAs({ serialize, blob: suppliedBlob, filename, extension, mimeType, handleKey }) {
  const suggestedName = normalizeDocumentFilename(filename, extension);
  const blob = suppliedBlob || await serialize();
  if (!(blob instanceof Blob)) throw new TypeError("Document serializer did not return a Blob");

  if (typeof window.showSaveFilePicker === "function") {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        suggestedName,
        types: [{ description: `${extension.toUpperCase()} document`, accept: { [mimeType]: [`.${extension.replace(/^\./, "")}`] } }]
      });
    } catch (error) {
      if (error?.name === "AbortError") return { saved: false, cancelled: true };
      throw error;
    }
    const result = await writeBlobToHandle(handle, blob);
    if (result.saved && handleKey) await storeHandle(handleKey, handle);
    return result;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return { saved: true, downloaded: true, blob };
}

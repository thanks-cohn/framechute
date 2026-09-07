export const CUSTOM_BLOCK_MARKER = "__FLASHFRAME_CUSTOM_BLOCK_V1__";

export function customBlockPayload(block) {
  const store = block?.querySelector?.(".custom-state-store, .text-editor");
  if (!store?.value?.startsWith(CUSTOM_BLOCK_MARKER)) return null;
  try { return JSON.parse(store.value.slice(CUSTOM_BLOCK_MARKER.length)); }
  catch { return null; }
}

function isImageBlob(blob) { return blob instanceof Blob && /^image\//i.test(blob.type); }

/** Resolve custom image bytes from canonical persisted state, never marker text. */
export async function customImageSourceBlob(block, { resolveHandle, fetchBlob = globalThis.fetch } = {}) {
  const payload = customBlockPayload(block);
  if (!payload || !["image", "canvas"].includes(payload.kind)) return null;
  if (payload.handleKey && resolveHandle) {
    try {
      const handle = await resolveHandle(payload.handleKey);
      const file = handle?.kind === "file" ? await handle.getFile() : null;
      if (isImageBlob(file)) return file;
    } catch {}
  }
  const source = payload.dataUrl || payload.url;
  if (source && fetchBlob) {
    try {
      const response = await fetchBlob(source);
      const blob = response instanceof Blob ? response : response?.ok ? await response.blob() : null;
      if (isImageBlob(blob)) return blob;
    } catch {}
  }
  return null;
}

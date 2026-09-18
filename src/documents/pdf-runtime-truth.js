import { currentPdfEdits, ensurePdfEditIdentity } from "./pdf-observability.js";
import { createPdfCausalJournal, createPdfGenerationClock } from "./pdf-forensics.js";

const HISTORICAL_STATES = new Set(["historical", "superseded"]);
const finite = value => Number.isFinite(Number(value));
const rect = value => ({
  x: Number(value?.x) || 0,
  y: Number(value?.y) || 0,
  width: Math.max(2, Number(value?.width) || 2),
  height: Math.max(2, Number(value?.height) || 2)
});
const sourceKey = value => value?.sourceObjectId ? `source:${value.sourceObjectId}` : `object:${value?.id}`;

/** Convert the saved current-version manifest into the same mutable object
 * contract used by newly-created editor fields. Manifest objects are not
 * anonymous PDF.js runs: they retain identity, ownership and manipulation
 * capability immediately after open. */
export function hydrateReopenedPdfCurrentObjects(model, workspaceEdits = []) {
  const restored = currentPdfEdits((workspaceEdits || []).map(edit =>
    ensurePdfEditIdentity(structuredClone(edit))));
  const byIdentity = new Map();
  for (const edit of restored) {
    byIdentity.set(`id:${edit.id}`, edit);
    byIdentity.set(sourceKey(edit), edit);
  }

  const hydrated = [];
  for (const saved of model?.reopenedCurrent?.objects || []) {
    if (!saved || HISTORICAL_STATES.has(saved.versionState)) continue;
    const duplicate = byIdentity.get(`id:${saved.id}`) || byIdentity.get(sourceKey(saved));
    if (duplicate) continue;
    const geometry = rect(saved.pdfRect || saved.layoutRect || saved);
    const ownership = rect(saved.sourceOwnershipRect || saved.sourceRect || geometry);
    const kind = saved.kind === "text" ? "text" : "replacement";
    const edit = ensurePdfEditIdentity({
      id: saved.id,
      kind,
      page: Math.max(1, Number(saved.page) || 1),
      index: finite(saved.index) ? Number(saved.index) : sourceIndex(saved.sourceObjectId),
      sourceObjectId: saved.sourceObjectId || null,
      sourceLineId: saved.sourceLineId || null,
      original: saved.original ?? "",
      ...(kind === "text" ? { text: String(saved.text ?? "") } : { replacement: String(saved.text ?? saved.replacement ?? "") }),
      ...geometry,
      sourceX: ownership.x,
      sourceY: ownership.y,
      sourceWidth: ownership.width,
      sourceHeight: ownership.height,
      fontSize: Math.max(4, Number(saved.fontSize) || 12),
      fontFamily: saved.fontFamily || "Helvetica",
      rotation: Number(saved.rotation) || 0,
      versionState: "current",
      reopened: true,
      manipulationCapability: Object.freeze({ move: true, resize: true, editText: true })
    });
    hydrated.push(edit);
    byIdentity.set(`id:${edit.id}`, edit);
    byIdentity.set(sourceKey(edit), edit);
  }
  return {
    edits: currentPdfEdits([...restored, ...hydrated]),
    hydrated,
    deduplicated: (model?.reopenedCurrent?.objects?.length || 0) - hydrated.length,
    documentVersionId: model?.reopenedCurrent?.documentVersionId || null
  };
}

function sourceIndex(sourceObjectId) {
  const match = String(sourceObjectId || "").match(/:text:(\d+)$/);
  return match ? Number(match[1]) : -1;
}

/** The single runtime state owner. OFF mode receives the forensic module's
 * allocation-free journals; DEBUG/DEEP get bounded causality and generations. */
export function createPdfRuntimeTruth({ model, workspaceEdits = [], mode = "off", journalLimit = 160 } = {}) {
  const hydration = hydrateReopenedPdfCurrentObjects(model, workspaceEdits);
  const generations = createPdfGenerationClock();
  const journal = createPdfCausalJournal({ mode, limit: journalLimit });
  const state = {
    interaction: "idle",
    editingObjectId: null,
    manipulatingObjectId: null,
    liveText: null,
    committedText: null,
    activeElement: null,
    activeSpan: null,
    activeContext: null
  };
  const record = (event, data = {}) => journal.record(event, {
    ...data,
    generations: generations.snapshot()
  });
  for (const edit of hydration.hydrated) {
    generations.advance("semantic");
    generations.advance("replacement");
    record("reopen-hydration", { objectId: edit.id, actual: snapshotEdit(edit), cause: "saved-current-manifest" });
  }
  return { edits: hydration.edits, hydration, generations, journal, state, record };
}

export function snapshotEdit(edit) {
  if (!edit) return null;
  return {
    id: edit.id,
    kind: edit.kind,
    page: edit.page,
    index: edit.index,
    text: String(edit.text ?? edit.replacement ?? ""),
    versionState: edit.versionState || "current",
    sourceObjectId: edit.sourceObjectId || null,
    sourceOwnershipRect: rect({ x: edit.sourceX, y: edit.sourceY, width: edit.sourceWidth, height: edit.sourceHeight }),
    layoutRect: rect(edit)
  };
}

export function beginPdfTextInteraction(truth, { element, span, edit = null, context = null } = {}) {
  if (!truth || !element || !span) return null;
  const id = edit?.id || span.dataset.objectId || null;
  const text = String(element.innerText ?? element.textContent ?? "").replace(/\r\n?/g, "\n");
  truth.state.interaction = "editing";
  truth.state.editingObjectId = id;
  truth.state.manipulatingObjectId = null;
  truth.state.liveText = text;
  truth.state.committedText = String(edit?.text ?? edit?.replacement ?? text);
  truth.state.activeElement = element;
  truth.state.activeSpan = span;
  truth.state.activeContext = context;
  truth.record("edit-begin", { objectId: id, before: snapshotEdit(edit), actual: { text, interaction: "editing" } });
  return truth.state;
}

export function updatePdfLiveText(truth, text, { rect: layoutRect = null, cause = "input" } = {}) {
  if (!truth || truth.state.interaction !== "editing") return null;
  const before = truth.state.liveText;
  truth.state.liveText = String(text ?? "").replace(/\r\n?/g, "\n");
  truth.generations.advance("semantic");
  truth.generations.advance("replacement");
  truth.record(cause, {
    objectId: truth.state.editingObjectId,
    before: { text: before },
    requested: { text: truth.state.liveText },
    actual: { text: truth.state.liveText, layoutRect }
  });
  return truth.state.liveText;
}

/** Canonical edit commit. Every exit (focusout, Enter, manipulation, Save and
 * page navigation) calls this function. The adapter owns DOM/PDF conversion,
 * history and rerender policy while this function owns ordering and state. */
export function commitPdfTextEdit(truth, { cause = "commit", cancel = false } = {}) {
  const state = truth?.state;
  if (!truth || state.interaction !== "editing" || !state.activeElement) return { changed: false, reason: "not-editing" };
  const element = state.activeElement;
  const span = state.activeSpan;
  const context = state.activeContext || {};
  const objectId = state.editingObjectId;
  const before = context.getEdit?.() || null;
  let live = String(element.innerText ?? element.textContent ?? state.liveText ?? "").replace(/\r\n?/g, "\n");
  if (cancel) live = String(element.dataset?.before ?? state.committedText ?? "");
  const layoutRect = context.readLayoutRect?.(span) || null;
  const result = cancel
    ? { changed: false, cancelled: true, edit: before }
    : context.apply?.({ text: live, layoutRect, before, objectId }) || { changed: live !== state.committedText, edit: before };
  element.removeAttribute?.("contenteditable");
  span?.classList?.remove?.("is-editing");
  context.removeLiveMask?.();
  if (!cancel && result.changed) {
    truth.generations.advance("semantic");
    truth.generations.advance("replacement");
    truth.generations.advance("mask");
  }
  truth.record(cancel ? "cancel" : "commit", {
    objectId,
    cause,
    before: snapshotEdit(before) || { text: state.committedText },
    requested: { text: live, layoutRect },
    actual: snapshotEdit(result.edit) || { text: live, layoutRect },
    downstreamEffects: result.changed ? ["semantic-model", "replacement", "source-mask"] : []
  });
  state.interaction = "idle";
  state.editingObjectId = null;
  state.liveText = null;
  state.committedText = live;
  state.activeElement = null;
  state.activeSpan = null;
  state.activeContext = null;
  return { ...result, text: live, objectId };
}

export function beginPdfManipulation(truth, { objectId, cause = "double-click" } = {}) {
  if (!truth) return null;
  if (truth.state.interaction === "editing") commitPdfTextEdit(truth, { cause: `${cause}:commit` });
  truth.state.interaction = "manipulating";
  truth.state.manipulatingObjectId = objectId || null;
  truth.state.editingObjectId = null;
  truth.record("manipulation-begin", { objectId, cause, actual: { interaction: "manipulating" } });
  return truth.state;
}

export function endPdfManipulation(truth, { objectId, kind = "move", before = null, actual = null, constraints = [] } = {}) {
  if (!truth) return;
  truth.generations.advance("semantic");
  truth.generations.advance("replacement");
  truth.generations.advance("mask");
  truth.record(`${kind}-end`, { objectId, before, actual, constraints, downstreamEffects: ["replacement", "fixed-source-mask"] });
}

/** Project the canonical PDF content rectangle through the active viewport.
 * Consumers receive local CSS coordinates, exactly the coordinate system used
 * by the live autofit field. */
export function projectPdfContentRect(viewport, contentRect) {
  if (!viewport || !contentRect) return null;
  const points = viewport.convertToViewportRectangle
    ? viewport.convertToViewportRectangle([contentRect.x, contentRect.y, contentRect.x + contentRect.width, contentRect.y + contentRect.height])
    : null;
  if (!points || points.length < 4) return null;
  const left = Math.min(points[0], points[2]);
  const top = Math.min(points[1], points[3]);
  return { x: left, y: top, width: Math.abs(points[2] - points[0]), height: Math.abs(points[3] - points[1]) };
}

export function runtimeTruthDiagnostics(truth) {
  if (!truth) return null;
  return {
    interactionState: truth.state.interaction,
    editingObjectId: truth.state.editingObjectId,
    manipulatingObjectId: truth.state.manipulatingObjectId,
    liveText: truth.state.liveText,
    committedText: truth.state.committedText,
    generations: truth.generations.snapshot(),
    hydration: {
      documentVersionId: truth.hydration.documentVersionId,
      hydratedObjectIds: truth.hydration.hydrated.map(edit => edit.id),
      deduplicated: truth.hydration.deduplicated
    },
    recentCausalEvents: truth.journal.snapshot()
  };
}

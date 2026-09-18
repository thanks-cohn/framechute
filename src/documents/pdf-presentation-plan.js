/**
 * The presentation control plane for an active PDF page.
 *
 * This module is deliberately DOM-free.  Canvas, mask, text, diagnostics and
 * agent inspection consumers receive the same already-enforced decision.  A
 * consumer must never "fix up" visibility after this plan has been built.
 */

export const PDF_PRESENTATION_STATES = Object.freeze({
  SOURCE_ONLY: "SOURCE_ONLY",
  LIVE_EDIT: "LIVE_EDIT",
  COMMITTED_REPLACEMENT: "COMMITTED_REPLACEMENT",
  DELETED: "DELETED",
  HISTORICAL: "HISTORICAL",
  INVALID: "INVALID"
});

const HARD = "hard";
const historical = value => ["historical", "superseded"].includes(String(value || "").toLowerCase());
const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const cleanRect = value => value ? Object.freeze({
  x: number(value.x ?? value.left), y: number(value.y ?? value.top),
  width: Math.max(0, number(value.width)), height: Math.max(0, number(value.height))
}) : null;
const sameRect = (a, b, tolerance = .01) => a && b && ["x", "y", "width", "height"].every(key => Math.abs(number(a[key]) - number(b[key])) <= tolerance);
const area = rect => Math.max(0, number(rect?.width)) * Math.max(0, number(rect?.height));
const intersection = (a, b) => {
  if (!a || !b) return null;
  const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width), bottom = Math.min(a.y + a.height, b.y + b.height);
  return right > x && bottom > y ? { x, y, width: right - x, height: bottom - y } : null;
};
const paddedRect = (value, padding = 0) => value && ({ x:value.x-padding, y:value.y-padding, width:value.width+padding*2, height:value.height+padding*2 });
const sourceIdFor = object => object?.sourceObjectId || object?.id || null;
const layoutRectFor = object => {
  const explicit = object?.layoutRect || object?.pdfRect || object?.bounds;
  if (explicit) return cleanRect(explicit);
  return object && [object.x, object.y, object.width, object.height].some(value => value != null) ? cleanRect(object) : null;
};
const ownershipFor = object => {
  if (object?.sourceOwnershipRect) return cleanRect(object.sourceOwnershipRect);
  if (!object || [object.sourceX, object.sourceY, object.sourceWidth, object.sourceHeight, object.x, object.y, object.width, object.height].every(value => value == null)) return null;
  return cleanRect({ x: object.sourceX ?? object.x, y: object.sourceY ?? object.y, width: object.sourceWidth ?? object.width, height: object.sourceHeight ?? object.height });
};
const serializable = value => value == null ? value : JSON.parse(JSON.stringify(value));

function issue(code, sourceObjectId, details = {}, severity = HARD) {
  return { code, severity, sourceObjectId, ...details };
}

/** Classify only presentations. Controls are intentionally excluded. */
export function classifyPdfPresentationCollisions(presentations = []) {
  const content = presentations.filter(item => item?.visible !== false && item.kind !== "control" && item.kind !== "mask");
  const collisions = [];
  for (let index = 0; index < content.length; index++) for (let other = index + 1; other < content.length; other++) {
    const a = content[index], b = content[other], overlap = intersection(a.layoutRect, b.layoutRect);
    if (!overlap) continue;
    const semantic = sourceIdFor(a) && sourceIdFor(a) === sourceIdFor(b);
    collisions.push({
      aId: a.id, bId: b.id, aKind: a.kind, bKind: b.kind,
      overlapArea: area(overlap), overlapRatioA: area(overlap) / Math.max(1, area(a.layoutRect)),
      overlapRatioB: area(overlap) / Math.max(1, area(b.layoutRect)),
      semanticRelationship: semantic ? "same-source" : "unrelated",
      classification: semantic ? "SEMANTIC_COLLISION" : "VISUAL_TEXT_OVERLAP",
      allowed: !semantic, reason: semantic ? "one-source-one-presentation" : "unrelated-text-overlap"
    });
  }
  return collisions;
}

/**
 * Build and enforce the sole visibility authority for an active PDF page.
 * Required masks are derived only from immutable sourceOwnershipRect.  When a
 * supplied mask/generation cannot prove coverage, replacement/live text is not
 * emitted; source evidence remains the last valid presentation.
 */
export function buildPdfPresentationPlan({
  pageNumber = 1, sourceObjects = [], currentEdits = [], activeInteraction = null,
  selectedObjectId = null, viewport = null, historicalObjects = [],
  generationState = {}, uiState = {}, masks: suppliedMasks = null
} = {}) {
  const page = Math.max(1, number(pageNumber) || 1), conflicts = [], objects = {}, autoSuppressedPresentations = [];
  const sources = sourceObjects.filter(item => number(item.page || page) === page);
  const sourceById = new Map(sources.map(source => [sourceIdFor(source), source]));
  const history = [...historicalObjects, ...currentEdits.filter(item => historical(item.versionState))];
  const current = currentEdits.filter(item => number(item.page || page) === page && !historical(item.versionState));
  const owners = new Map();
  for (const edit of current) {
    const sourceId = sourceIdFor(edit);
    if (!sourceId) continue;
    if (owners.has(sourceId)) {
      conflicts.push(issue("PDF_DUPLICATE_CURRENT_SOURCE_OWNER", sourceId, { currentObjectId: edit.id, participatingIds: [owners.get(sourceId).id, edit.id] }));
      autoSuppressedPresentations.push(edit.id);
      continue;
    }
    owners.set(sourceId, edit);
  }

  const semanticGeneration = number(generationState.semanticGeneration ?? generationState.semantic);
  const presentationGeneration = number(generationState.presentationGeneration ?? generationState.presentation ?? semanticGeneration);
  const requiredGeneration = number(generationState.requiredGeneration ?? semanticGeneration);
  const generationCoherent = generationState.presentationReady !== false && presentationGeneration >= requiredGeneration;
  if (!generationCoherent) conflicts.push(issue("PDF_PRESENTATION_GENERATION_DESYNC", null, { generationState: serializable(generationState) }));

  const masks = [], sourcePresentations = [], livePresentations = [], replacementPresentations = [];
  const allSourceIds = new Set([...sourceById.keys(), ...owners.keys()]);
  for (const sourceObjectId of allSourceIds) {
    const source = sourceById.get(sourceObjectId) || {}, edit = owners.get(sourceObjectId) || null;
    const interactionOwnsSource = Boolean(activeInteraction && (
      activeInteraction.sourceObjectId === sourceObjectId ||
      activeInteraction.editingObjectId === sourceObjectId ||
      (edit && activeInteraction.editingObjectId === edit.id)
    ));
    const sourceRect = ownershipFor(edit) || cleanRect(activeInteraction?.sourceOwnershipRect) || ownershipFor(source) || layoutRectFor(source);
    const layoutRect = interactionOwnsSource
      ? (cleanRect(activeInteraction?.layoutRect) || layoutRectFor(edit) || layoutRectFor(source))
      : (layoutRectFor(edit) || layoutRectFor(source));
    const isLive = interactionOwnsSource;
    const deleted = edit?.deleted === true || edit?.presentationState === PDF_PRESENTATION_STATES.DELETED;
    let state = deleted ? PDF_PRESENTATION_STATES.DELETED : isLive ? PDF_PRESENTATION_STATES.LIVE_EDIT : edit ? PDF_PRESENTATION_STATES.COMMITTED_REPLACEMENT : PDF_PRESENTATION_STATES.SOURCE_ONLY;
    let sourceVisible = state === PDF_PRESENTATION_STATES.SOURCE_ONLY;
    let liveVisible = state === PDF_PRESENTATION_STATES.LIVE_EDIT;
    let replacementVisible = state === PDF_PRESENTATION_STATES.COMMITTED_REPLACEMENT;
    const requiresMask = liveVisible || replacementVisible || deleted;
    const expectedOwner = edit?.id || (isLive ? (activeInteraction?.editingObjectId || sourceObjectId) : null);
    const supplied = suppliedMasks?.find(mask => mask.ownerEditId === expectedOwner || (!expectedOwner && mask.sourceObjectId === sourceObjectId));
    const maskRect = sourceRect;
    const correctMask = !requiresMask || (maskRect && (!supplied || ((supplied.ownerEditId === expectedOwner || supplied.sourceObjectId === sourceObjectId) && sameRect(cleanRect(supplied.sourceOwnershipRect || supplied.rect || supplied), maskRect))));
    if (supplied && !correctMask) conflicts.push(issue("PDF_SOURCE_MASK_GEOMETRY_MISMATCH", sourceObjectId, { currentObjectId: edit?.id || null, maskId: supplied.id || null }));
    const coverageComplete = requiresMask && correctMask && Boolean(maskRect) && generationCoherent;
    if (requiresMask && !coverageComplete) {
      conflicts.push(issue("PDF_REQUIRED_SOURCE_MASK_MISSING", sourceObjectId, { currentObjectId: edit?.id || null, requiredMaskRect: maskRect }));
      if (edit?.id) autoSuppressedPresentations.push(edit.id);
      // Keep immutable canvas source as the previous valid presentation.
      state = PDF_PRESENTATION_STATES.INVALID; sourceVisible = true; liveVisible = false; replacementVisible = false;
    }
    const maskId = coverageComplete ? (supplied?.id || `mask:${expectedOwner || sourceObjectId}`) : null;
    if (maskId) {
      const padding=Math.max(0,number(uiState.maskPadding ?? 1.5));
      masks.push({ id: maskId, kind: "mask", ownerEditId: expectedOwner, sourceObjectId, sourceObjectIds: [sourceObjectId], sourceOwnershipRect: maskRect, requiredMaskRect: maskRect, layoutRect: cleanRect(paddedRect(maskRect,padding)), paddingPolicy:{kind:"bounded-antialias",points:padding}, coverageComplete: true, generation: presentationGeneration });
    }
    const record = {
      id: edit?.id || (isLive ? (activeInteraction?.editingObjectId || sourceObjectId) : sourceObjectId), sourceObjectId, currentObjectId: edit?.id || null, kind: isLive ? "live-text" : (edit?.kind || "source-text-run"),
      semanticRole: edit?.semanticRole || source?.semanticRole || "BODY_CONTENT", text: String(isLive ? activeInteraction?.liveText ?? edit?.replacement ?? edit?.text ?? source?.text ?? "" : edit?.replacement ?? edit?.text ?? source?.text ?? ""),
      sourceText: String(source?.text ?? edit?.original ?? ""), state, presentationState: state,
      sourceVisible, liveVisible, replacementVisible, visible: sourceVisible || liveVisible || replacementVisible,
      hitTestable: state !== PDF_PRESENTATION_STATES.HISTORICAL && state !== PDF_PRESENTATION_STATES.DELETED,
      sourceOwnershipRect: sourceRect, layoutRect, interactiveRect: cleanRect(edit?.interactiveRect) || layoutRect,
      viewportRect: cleanRect(edit?.viewportRect || source?.viewportRect), clientRect: cleanRect(edit?.clientRect || source?.clientRect), glyphInkRect: cleanRect(edit?.glyphInkRect || source?.glyphInkRect),
      maskIds: maskId ? [maskId] : [], controlIds: selectedObjectId === (edit?.id || sourceObjectId) ? (uiState.controlIds || []) : [],
      maskRequired: requiresMask, coverageComplete: !requiresMask || coverageComplete,
      geometryAncestry: { sourcePdfRect: layoutRectFor(source), sourceOwnershipRect: sourceRect, layoutRect, viewportRect: cleanRect(edit?.viewportRect || source?.viewportRect), clientRect: cleanRect(edit?.clientRect || source?.clientRect), glyphInkRect: cleanRect(edit?.glyphInkRect || source?.glyphInkRect) },
      reasons: [edit ? "current-edit-owns-source" : "no-current-edit", coverageComplete ? "immutable-source-covered" : "canvas-source-evidence"]
    };
    objects[sourceObjectId] = record;
    if (sourceVisible) sourcePresentations.push({ ...record, id: sourceObjectId, kind: "source", visible: true });
    if (liveVisible) livePresentations.push({ ...record, id: edit?.id || activeInteraction?.editingObjectId || sourceObjectId, kind: "live", visible: true });
    if (replacementVisible) replacementPresentations.push({ ...record, id: edit.id, kind: "replacement", visible: true });
  }

  for (const item of history) {
    const id = item.id || `historical:${Object.keys(objects).length}`;
    objects[id] = { id, sourceObjectId: sourceIdFor(item), currentObjectId: null, kind: item.kind || "historical", text: String(item.text ?? item.replacement ?? ""), state: PDF_PRESENTATION_STATES.HISTORICAL, presentationState: PDF_PRESENTATION_STATES.HISTORICAL, sourceVisible: false, liveVisible: false, replacementVisible: false, visible: false, hitTestable: false, saveCurrent: false, sourceOwnershipRect: ownershipFor(item), layoutRect: layoutRectFor(item), maskIds: [], controlIds: [], reasons: ["historical-never-presents"] };
    if (item.visible || item.hitTestable) conflicts.push(issue("PDF_HISTORICAL_PRESENTATION_ATTEMPT", sourceIdFor(item), { currentObjectId: id }));
  }
  const visibleText = [...sourcePresentations, ...livePresentations, ...replacementPresentations];
  const collisions = classifyPdfPresentationCollisions(visibleText);
  for (const collision of collisions.filter(item => !item.allowed)) conflicts.push(issue("PDF_MULTIPLE_VISIBLE_PRESENTATIONS_FOR_SOURCE", sourceIdFor(visibleText.find(item => item.id === collision.aId)), { participatingIds: [collision.aId, collision.bId] }));
  for (const collision of collisions.filter(item => item.classification === "VISUAL_TEXT_OVERLAP")) conflicts.push(issue("PDF_UNEXPECTED_TEXT_OVERLAP", null, collision, "warning"));
  const invariantResults = [
    { name: "PDF_ONE_CURRENT_TEXT_PRESENTATION_PER_SOURCE", ok: Object.values(objects).every(object => Number(object.sourceVisible) + Number(object.liveVisible) + Number(object.replacementVisible) <= 1) },
    { name: "PDF_SOURCE_COVERAGE_REQUIRED", ok: Object.values(objects).every(object => !object.maskRequired || object.coverageComplete || object.state === PDF_PRESENTATION_STATES.INVALID) },
    { name: "PDF_HISTORICAL_NEVER_PRESENTS", ok: history.every(item => !objects[item.id]?.visible) },
    { name: "PDF_PRESENTATION_GENERATION_COHERENT", ok: generationCoherent }
  ];
  return Object.freeze({ schemaVersion: 1, pageNumber: page, generation: presentationGeneration, presentationReady: generationCoherent,
    objects, sourcePresentations, livePresentations, replacementPresentations, masks, controls: uiState.controls || [], collisions,
    invariantResults, conflicts, issues: conflicts, autoSuppressedPresentations, viewport: serializable(viewport), valid: !conflicts.some(item => item.severity === HARD) });
}

export function validatePdfPresentation(plan) {
  const injected = classifyPdfPresentationCollisions([...(plan?.sourcePresentations || []), ...(plan?.livePresentations || []), ...(plan?.replacementPresentations || [])]);
  const issues = [...(plan?.conflicts || [])];
  for (const collision of injected.filter(item => !item.allowed)) if (!issues.some(item => item.code === "PDF_MULTIPLE_VISIBLE_PRESENTATIONS_FOR_SOURCE" && item.participatingIds?.includes(collision.aId))) issues.push(issue("PDF_MULTIPLE_VISIBLE_PRESENTATIONS_FOR_SOURCE", null, { participatingIds: [collision.aId, collision.bId] }));
  const invariants = [...(plan?.invariantResults || [])];
  if (injected.some(item => !item.allowed)) invariants.push({ name: "PDF_ONE_CURRENT_TEXT_PRESENTATION_PER_SOURCE", ok: false });
  return { valid: !issues.some(item => item.severity === HARD) && invariants.every(item => item.ok), issues, invariantResults: invariants, autoSuppressedPresentations: [...(plan?.autoSuppressedPresentations || [])], generationState: { presentationGeneration: plan?.generation, presentationReady: plan?.presentationReady !== false } };
}

export function buildPdfAgentPageMirror({ plan, documentId = null, pageBounds = null, contentRect = null, interaction = {}, recentCausalEvents = [] } = {}) {
  const collisions = plan?.collisions || [], validation = validatePdfPresentation(plan);
  return { schemaVersion: 1, documentId, pageNumber: plan?.pageNumber || 1, viewport: serializable(plan?.viewport), pageBounds: cleanRect(pageBounds), contentRect: cleanRect(contentRect), interaction: serializable(interaction),
    objects: Object.values(plan?.objects || {}).map(object => ({ ...serializable(object), relationships: [], collisions: collisions.filter(item => item.aId === object.id || item.bId === object.id), provenance: { sourceObjectId: object.sourceObjectId } })),
    masks: serializable(plan?.masks || []), presentationPlan: serializable(plan), collisions: serializable(collisions), generations: { presentationGeneration: plan?.generation }, recentCausalEvents: serializable(recentCausalEvents).slice(-40), invariantResults: serializable(validation.invariantResults), issues: serializable(validation.issues), valid: validation.valid };
}

export function inspectPdfMirrorObject(mirror, objectId) {
  const object = mirror?.objects?.find(item => item.id === objectId || item.sourceObjectId === objectId || item.currentObjectId === objectId);
  if (!object) return null;
  return { ...serializable(object), masks: (mirror.masks || []).filter(mask => object.maskIds?.includes(mask.id)), generations: serializable(mirror.generations), invariantStatus: (mirror.issues || []).some(item => item.sourceObjectId === object.sourceObjectId && item.severity === HARD) ? "invalid" : "valid" };
}

/** The UI and diagnostics call this same resolver; candidates use interactiveRect. */
export function explainPdfMirrorPoint(mirror, { x, y, space = "client" } = {}) {
  const point = { x: number(x), y: number(y) };
  const candidates = (mirror?.objects || []).filter(object => object.visible && object.hitTestable !== false).filter(object => {
    const rect = space === "pdf" ? object.layoutRect : object.interactiveRect || object.clientRect || object.viewportRect || object.layoutRect;
    return rect && point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
  }).sort((a, b) => area(a.interactiveRect || a.layoutRect) - area(b.interactiveRect || b.layoutRect));
  const chosen = candidates[0] || null;
  return { point, coordinateSpace: space, candidates: candidates.map(item => item.id), chosenObjectId: chosen?.id || null, chosenReason: chosen ? "smallest-current-interactive-rect" : "no-current-presentation-at-point", presentationState: chosen?.presentationState || null, sourceObjectId: chosen?.sourceObjectId || null, interactiveRect: chosen?.interactiveRect || null, glyphInkRect: chosen?.glyphInkRect || null, sourceOwnershipRect: chosen?.sourceOwnershipRect || null };
}

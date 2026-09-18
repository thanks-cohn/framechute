export const PDF_FORENSIC_SCHEMA_VERSION = "1.0.0";
export const PDF_FORENSIC_ISSUES = Object.freeze({
  LIVE_TEXT: "PDF_LIVE_EDIT_TEXT_NOT_RENDERING_CURRENT_INPUT",
  ERASE_AUTHORITY: "EDIT_MAY_ONLY_ERASE_OWNED_SOURCE",
  OWNERSHIP_EXPANSION: "LAYOUT_EXPANSION_DOES_NOT_EXPAND_SOURCE_OWNERSHIP",
  OWNERSHIP_MOVE: "MOVING_EDIT_DOES_NOT_CHANGE_SOURCE_OWNERSHIP",
  UNRELATED_ERASURE: "UNRELATED_SOURCE_OBJECT_MUST_NOT_BE_ERASED",
  MASK_UNDER: "PDF_SOURCE_MASK_UNDERCOVERAGE",
  MASK_OVER: "PDF_SOURCE_MASK_OVERCOVERAGE",
  TERMINAL_REMNANT: "PDF_TERMINAL_GLYPH_REMNANT",
  MOVE_REVEAL: "PDF_MOVE_REVEALS_STALE_SOURCE",
  MASK_DESYNC: "PDF_MOVE_MASK_DESYNCHRONIZED",
  FUTURE_RERENDER: "PDF_LIVE_STATE_WAITING_FOR_FUTURE_RERENDER",
  BODY_LEFT: "PDF_BODY_CONTENT_LEFT_OF_MARGIN",
  BODY_RIGHT: "PDF_BODY_CONTENT_RIGHT_OF_MARGIN",
  BODY_TOP: "PDF_BODY_CONTENT_ABOVE_TOP_MARGIN",
  BODY_BOTTOM: "PDF_BODY_CONTENT_BELOW_BOTTOM_MARGIN",
  PARTIAL_GLYPH: "PDF_PARTIAL_GLYPH_OUTSIDE_CONTENT_BOUNDS",
  HISTORICAL_LIVE: "PDF_HISTORICAL_OBJECT_RENDERED_IN_CURRENT_VIEW",
  MULTIPLE_CURRENT: "PDF_MULTIPLE_CURRENT_OBJECTS_FOR_ONE_SOURCE",
});

const round = (value, digits = 3) =>
  Number.isFinite(Number(value))
    ? Math.round(Number(value) * 10 ** digits) / 10 ** digits
    : null;
const clone = (value) =>
  value == null ? value : JSON.parse(JSON.stringify(value));
const rectOf = (value) => value?.rect || value;
const area = (rect) =>
  Math.max(0, rect?.width || 0) * Math.max(0, rect?.height || 0);
const stable = (values = []) =>
  [...new Set(values.filter((value) => value != null).map(String))].sort();
const current = (object) =>
  !["historical", "superseded"].includes(object?.versionState);
const namedRect = (value, space = "pdf-points") =>
  value
    ? {
        space,
        ...Object.fromEntries(
          ["x", "y", "width", "height"].map((key) => [
            key,
            round(rectOf(value)[key]),
          ]),
        ),
      }
    : null;
const intersects = (a, b) =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
const contains = (outer, inner, tolerance = 0.01) =>
  inner.x >= outer.x - tolerance &&
  inner.y >= outer.y - tolerance &&
  inner.x + inner.width <= outer.x + outer.width + tolerance &&
  inner.y + inner.height <= outer.y + outer.height + tolerance;

/** A bounded structured causal journal. OFF returns a frozen no-op instance so
 * call sites need no conditional allocations or snapshots. DEBUG records state
 * transitions; DEEP additionally retains sampled move updates. */
export function createPdfCausalJournal({
  mode = "off",
  limit = 160,
  pointerSampleEvery = 4,
  clock = () => Date.now(),
} = {}) {
  if (mode === "off")
    return Object.freeze({
      mode,
      record: () => null,
      snapshot: () => [],
      traceObject: () => [],
      explain: () => null,
      size: 0,
    });
  let sequence = 0,
    pointerMoves = 0;
  const records = [];
  const record = (event, data = {}) => {
    if (event === "move-update" && mode !== "deep") return null;
    if (
      event === "move-update" &&
      ++pointerMoves % Math.max(1, pointerSampleEvery) !== 0
    )
      return null;
    sequence += 1;
    const entry = Object.freeze({
      sequence,
      eventId: `pdf-event:${sequence}`,
      parentEventId: data.parentEventId || null,
      initiator: data.initiator || "system",
      event,
      cause: data.cause || event,
      timestamp: Number(data.timestamp ?? clock()),
      objectId: data.objectId || null,
      pointer: clone(data.pointer) || null,
      keyboard: clone(data.keyboard) || null,
      candidateObjectIds: stable(data.candidateObjectIds),
      chosenObjectId: data.chosenObjectId || data.objectId || null,
      choiceReason: data.choiceReason || null,
      before: clone(data.before) || null,
      requested: clone(data.requested) || null,
      actual: clone(data.actual) || null,
      constraints: clone(data.constraints) || [],
      collisions: clone(data.collisions) || [],
      downstreamEffects: clone(data.downstreamEffects) || [],
      generations: clone(data.generations) || null,
    });
    records.push(entry);
    if (records.length > limit) records.splice(0, records.length - limit);
    return entry;
  };
  return {
    mode,
    record,
    snapshot: () => records.map(clone),
    traceObject: (id) =>
      records
        .filter(
          (record) =>
            record.objectId === id ||
            record.chosenObjectId === id ||
            record.candidateObjectIds.includes(String(id)),
        )
        .map(clone),
    explain: (value) =>
      clone(
        records.find(
          (record) => record.sequence === value || record.eventId === value,
        ) || null,
      ),
    get size() {
      return records.length;
    },
  };
}

export function createPdfGenerationClock(seed = 0) {
  let semantic = seed,
    render = seed,
    mask = seed,
    replacement = seed;
  return {
    tick(kind) {
      return this.advance(kind)[kind];
    },
    advance(kind) {
      if (kind === "semantic") semantic++;
      else if (kind === "render") render++;
      else if (kind === "mask") mask++;
      else if (kind === "replacement") replacement++;
      else throw new TypeError(`Unknown PDF generation: ${kind}`);
      return this.snapshot();
    },
    synchronize() {
      const next=Math.max(semantic,render,mask,replacement)+1;
      semantic=render=mask=replacement=next;
      return this.snapshot();
    },
    snapshot: () => ({
      semantic,
      render,
      mask,
      replacement,
      inSync: render === mask && mask === replacement,
    }),
  };
}

/** Deterministic bidirectional field sizing. The original/source width is never
 * a minimum; only explicit user locks and the small interaction floor are. */
export function calculatePdfTextAutofit({
  text = "",
  previousText = "",
  fontSize = 12,
  lineHeight = fontSize * 1.2,
  measureText,
  previousRect,
  contentRect,
  minWidth = 16,
  minHeight = lineHeight + 2,
  userWidth = null,
  userHeight = null,
  padding = 4,
} = {}) {
  const measure =
    typeof measureText === "function"
      ? measureText
      : (value) => String(value).length * fontSize * 0.55;
  const normalized = String(text).replace(/\r\n?/g, "\n"),
    prior = String(previousText).replace(/\r\n?/g, "\n");
  const left = Number(previousRect?.x) || Number(contentRect?.x) || 0,
    top = Number(previousRect?.y) || Number(contentRect?.y) || 0;
  const available = Math.max(
    minWidth,
    Number(contentRect?.x + contentRect?.width - left) ||
      Number(previousRect?.width) ||
      minWidth,
  );
  const paragraphs = normalized.split("\n"),
    lines = [];
  for (const paragraph of paragraphs) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let line = "";
    for (const token of paragraph.split(/(?<=\s)/)) {
      if (line && measure(line + token) + padding > available) {
        lines.push(line.replace(/\s+$/, ""));
        line = token.replace(/^\s+/, "");
      } else line += token;
      while (measure(line) + padding > available && line.length > 1) {
        let cut = line.length - 1;
        while (cut > 1 && measure(line.slice(0, cut)) + padding > available)
          cut--;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  const desiredWidth = Math.max(
    minWidth,
    Math.ceil(Math.max(0, ...lines.map(measure)) + padding),
  );
  const desiredHeight = Math.max(
    minHeight,
    Math.ceil(lines.length * lineHeight + 2),
  );
  const width =
    userWidth == null
      ? Math.min(available, desiredWidth)
      : Math.max(minWidth, Math.min(available, userWidth));
  const bottomLimit = contentRect
    ? contentRect.y + contentRect.height
    : Infinity;
  const maxHeight = Math.max(minHeight, bottomLimit - top);
  const height =
    userHeight == null
      ? Math.min(maxHeight, desiredHeight)
      : Math.max(minHeight, Math.min(maxHeight, userHeight));
  const previousWidth = Number(previousRect?.width) || minWidth,
    previousHeight = Number(previousRect?.height) || minHeight;
  const priorLines = Math.max(
    1,
    prior.split("\n").length,
    Math.round((Number(previousRect?.height) || minHeight) / lineHeight),
  );
  return {
    rect: { x: left, y: top, width, height },
    trace: {
      previousTextLength: prior.length,
      newTextLength: normalized.length,
      previousWidth,
      previousHeight,
      desiredWidth,
      desiredHeight,
      actualWidth: width,
      actualHeight: height,
      previousLineCount: priorLines,
      newLineCount: lines.length,
      wrapped: lines.length > paragraphs.length,
      unwrapped: lines.length < priorLines,
      grew: width > previousWidth || height > previousHeight,
      shrank: width < previousWidth || height < previousHeight,
      constraintReason:
        width < desiredWidth
          ? "right-margin"
          : height < desiredHeight
            ? "bottom-margin"
            : userWidth != null || userHeight != null
              ? "user-size-lock"
              : null,
      lines,
    },
  };
}

export function sourceOwnershipRectForEdit(edit) {
  if (!edit) return null;
  return {
    x: Number(edit.sourceX ?? edit.sourceOwnershipRect?.x ?? edit.x) || 0,
    y: Number(edit.sourceY ?? edit.sourceOwnershipRect?.y ?? edit.y) || 0,
    width: Math.max(
      0,
      Number(
        edit.sourceWidth ?? edit.sourceOwnershipRect?.width ?? edit.width,
      ) || 0,
    ),
    height: Math.max(
      0,
      Number(
        edit.sourceHeight ?? edit.sourceOwnershipRect?.height ?? edit.height,
      ) || 0,
    ),
  };
}
export function layoutRectForEdit(edit) {
  return edit
    ? {
        x: Number(edit.x) || 0,
        y: Number(edit.y) || 0,
        width: Math.max(0, Number(edit.width) || 0),
        height: Math.max(0, Number(edit.height) || 0),
      }
    : null;
}

export function auditPdfMaskOwnership({ masks = [], objects = [] } = {}) {
  const issues = [],
    records = [];
  for (const mask of masks) {
    const rect = rectOf(mask.pdfRect || mask),
      owned = new Set((mask.sourceObjectIds || []).map(String));
    const covered = objects.filter(
      (object) =>
        intersects(
          rect,
          rectOf(object.sourceOwnershipRect || object.pdfRect || object.rect),
        ) > 0,
    );
    const unrelated = covered.filter(
      (object) => !owned.has(String(object.objectId || object.id)),
    );
    const missing = objects.filter(
      (object) =>
        owned.has(String(object.objectId || object.id)) &&
        !contains(
          rect,
          rectOf(object.sourceOwnershipRect || object.pdfRect || object.rect),
        ),
    );
    if (unrelated.length)
      issues.push({
        severity: "error",
        code: PDF_FORENSIC_ISSUES.UNRELATED_ERASURE,
        maskId: mask.maskId || mask.id,
        objectIds: stable(
          unrelated.map((object) => object.objectId || object.id),
        ),
      });
    if (missing.length)
      issues.push({
        severity: "error",
        code: PDF_FORENSIC_ISSUES.MASK_UNDER,
        maskId: mask.maskId || mask.id,
        objectIds: stable(
          missing.map((object) => object.objectId || object.id),
        ),
      });
    const ownedArea = covered
      .filter((object) => owned.has(String(object.objectId || object.id)))
      .reduce(
        (sum, object) =>
          sum +
          intersects(
            rect,
            rectOf(object.sourceOwnershipRect || object.pdfRect || object.rect),
          ),
        0,
      );
    if (area(rect) > 0 && ownedArea / area(rect) < 0.5 && covered.length)
      issues.push({
        severity: "warning",
        code: PDF_FORENSIC_ISSUES.MASK_OVER,
        maskId: mask.maskId || mask.id,
        coverageRatio: round(ownedArea / area(rect), 4),
      });
    records.push({
      maskId: mask.maskId || mask.id,
      ownerEditId: mask.ownerEditId || null,
      sourceObjectIds: [...owned].sort(),
      coveredObjectIds: stable(
        covered.map((object) => object.objectId || object.id),
      ),
      unrelatedObjectIds: stable(
        unrelated.map((object) => object.objectId || object.id),
      ),
      complete: missing.length === 0,
      createdBy: mask.createdBy || "mask-plan",
      persistence: mask.persistence || "persistent",
      pdfRect: namedRect(rect),
    });
  }
  return { records, issues };
}

export function reconcileSemanticPageToContentBounds({
  layout,
  contentRect,
  policy = {},
} = {}) {
  const tolerance = Number(policy.tolerance ?? 0.01),
    objects = layout?.objects || layout?.children || [],
    results = [],
    issues = [];
  const candidates = objects.filter(
    (object) =>
      (object.semanticRole || "BODY_CONTENT") === "BODY_CONTENT" &&
      !object.allowOutsideContentBounds,
  );
  const groups = new Map();
  for (const object of candidates) {
    const key = object.blockId || object.lineId || object.id || object.objectId;
    const list = groups.get(key) || [];
    list.push(object);
    groups.set(key, list);
  }
  for (const [groupId, members] of groups) {
    const rects = members.map((object) =>
      rectOf(object.canonicalPdfRect || object.pdfRect || object.bounds),
    );
    const left = Math.min(...rects.map((rect) => rect.x)),
      bottom = Math.min(...rects.map((rect) => rect.y)),
      right = Math.max(...rects.map((rect) => rect.x + rect.width)),
      top = Math.max(...rects.map((rect) => rect.y + rect.height));
    const envelope = {
        x: left,
        y: bottom,
        width: right - left,
        height: top - bottom,
      },
      violatedEdges = [];
    if (left < contentRect.x - tolerance) violatedEdges.push("left");
    if (right > contentRect.x + contentRect.width + tolerance)
      violatedEdges.push("right");
    if (bottom < contentRect.y - tolerance) violatedEdges.push("bottom");
    if (top > contentRect.y + contentRect.height + tolerance)
      violatedEdges.push("top");
    let dx =
        Math.max(0, contentRect.x - left) +
        Math.min(0, contentRect.x + contentRect.width - right),
      dy =
        Math.max(0, contentRect.y - bottom) +
        Math.min(0, contentRect.y + contentRect.height - top);
    const fits =
      envelope.width <= contentRect.width + tolerance &&
      envelope.height <= contentRect.height + tolerance;
    if (!fits) {
      dx = 0;
      dy = 0;
      issues.push({
        severity: "error",
        code: "PDF_SEMANTIC_CONTENT_OVERFLOW",
        groupId,
        envelope: namedRect(envelope),
        contentRect: namedRect(contentRect),
      });
    }
    for (const edge of violatedEdges)
      issues.push({
        severity: "error",
        code:
          edge === "left"
            ? PDF_FORENSIC_ISSUES.BODY_LEFT
            : edge === "right"
              ? PDF_FORENSIC_ISSUES.BODY_RIGHT
              : edge === "top"
                ? PDF_FORENSIC_ISSUES.BODY_TOP
                : PDF_FORENSIC_ISSUES.BODY_BOTTOM,
        groupId,
      });
    if (violatedEdges.length)
      issues.push({
        severity: "error",
        code: PDF_FORENSIC_ISSUES.PARTIAL_GLYPH,
        groupId,
        violatedEdges,
      });
    results.push({
      groupId,
      memberIds: stable(members.map((object) => object.id || object.objectId)),
      semanticUnit: members[0]?.blockId
        ? "block"
        : members[0]?.lineId
          ? "line"
          : "run",
      before: namedRect(envelope),
      requestedDelta: { dx: round(dx), dy: round(dy) },
      actualDelta: fits ? { dx: round(dx), dy: round(dy) } : { dx: 0, dy: 0 },
      violatedEdges,
      fits,
      disposition: !violatedEdges.length
        ? "KEEP"
        : fits
          ? "MOVE"
          : "OVERFLOW_ERROR",
      members: members.map((object) => ({
        objectId: object.id || object.objectId,
        before: namedRect(
          rectOf(object.canonicalPdfRect || object.pdfRect || object.bounds),
        ),
        after: fits
          ? namedRect({
              ...rectOf(
                object.canonicalPdfRect || object.pdfRect || object.bounds,
              ),
              x:
                rectOf(
                  object.canonicalPdfRect || object.pdfRect || object.bounds,
                ).x + dx,
              y:
                rectOf(
                  object.canonicalPdfRect || object.pdfRect || object.bounds,
                ).y + dy,
            })
          : null,
      })),
    });
  }
  return { contentRect: namedRect(contentRect), results, issues };
}

export function buildPdfSaveIntentLedger({
  objects = [],
  masks = [],
  contentRect,
} = {}) {
  const maskBySource = new Map();
  for (const mask of masks)
    for (const id of mask.sourceObjectIds || []) {
      const list = maskBySource.get(String(id)) || [];
      list.push(mask);
      maskBySource.set(String(id), list);
    }
  const entries = objects
    .map((object) => {
      const id = String(object.objectId || object.id),
        versionState = object.versionState || "current",
        ownedMasks = maskBySource.get(id) || [],
        isCurrent = current(object),
        replacement = ["replacement", "replacement-text", "free-text"].includes(
          object.kind,
        );
      let disposition = "KEEP";
      if (!isCurrent) disposition = "MASK";
      else if (replacement) disposition = "REDRAW";
      else if (object.allowOutsideContentBounds)
        disposition = "ALLOW_PAGE_FURNITURE";
      const rect = rectOf(
          object.layoutRect ||
            object.canonicalPdfRect ||
            object.pdfRect ||
            object.rect,
        ),
        outside =
          contentRect && rect
            ? [
                rect.x < contentRect.x && "left",
                rect.x + rect.width > contentRect.x + contentRect.width &&
                  "right",
                rect.y < contentRect.y && "bottom",
                rect.y + rect.height > contentRect.y + contentRect.height &&
                  "top",
              ].filter(Boolean)
            : [];
      if (outside.length && disposition === "KEEP") disposition = "MOVE";
      return {
        objectId: id,
        kind: object.kind || "unknown",
        semanticRole: object.semanticRole || "BODY_CONTENT",
        provenance: object.provenance || "unknown",
        versionState,
        sourceRect: namedRect(
          object.sourceOriginalRect || object.sourceOwnershipRect,
        ),
        sourceOwnershipRect: namedRect(object.sourceOwnershipRect),
        currentRect: namedRect(rect),
        contentRect: namedRect(contentRect),
        liveVisible: isCurrent && object.liveVisible !== false,
        outsideMarginEdges: outside,
        shouldExistInSavedOutput: isCurrent,
        maskIds: stable(ownedMasks.map((mask) => mask.maskId || mask.id)),
        disposition,
        expectedReopenDisposition: isCurrent
          ? "current"
          : "historical-data-only",
      };
    })
    .sort((a, b) => a.objectId.localeCompare(b.objectId));
  return {
    schemaVersion: PDF_FORENSIC_SCHEMA_VERSION,
    entries,
    summary: Object.fromEntries(
      [
        "KEEP",
        "MASK",
        "REDRAW",
        "MOVE",
        "REFLOW",
        "ALLOW_PAGE_FURNITURE",
        "OVERFLOW_ERROR",
      ].map((disposition) => [
        disposition,
        entries.filter((entry) => entry.disposition === disposition).length,
      ]),
    ),
  };
}

export function buildPdfRelationshipGraph(objects = []) {
  const relationships = [],
    collisions = [];
  const sorted = [...objects].sort((a, b) =>
    String(a.objectId || a.id).localeCompare(String(b.objectId || b.id)),
  );
  for (const object of sorted) {
    const id = object.objectId || object.id;
    if (object.semanticParentId)
      relationships.push({
        type: "child-of",
        from: id,
        to: object.semanticParentId,
      });
    if (object.sourceObjectId)
      relationships.push({
        type: "replacement-for",
        from: id,
        to: object.sourceObjectId,
      });
    if (object.ownerEditId)
      relationships.push({
        type: "owned-by",
        from: id,
        to: object.ownerEditId,
      });
  }
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length; j++) {
      const left = sorted[i],
        right = sorted[j],
        a = rectOf(
          left.layoutRect || left.canonicalPdfRect || left.pdfRect || left.rect,
        ),
        b = rectOf(
          right.layoutRect ||
            right.canonicalPdfRect ||
            right.pdfRect ||
            right.rect,
        );
      if (!a || !b) continue;
      const overlap = intersects(a, b),
        leftId = left.objectId || left.id,
        rightId = right.objectId || right.id;
      if (overlap) {
        const owned =
            left.ownerEditId && left.ownerEditId === right.ownerEditId,
          sourcePair =
            left.sourceObjectId === rightId || right.sourceObjectId === leftId;
        const classification =
          owned || sourcePair
            ? "owned-overlap"
            : [left.kind, right.kind].includes("mask")
              ? "intentional-overlay"
              : "destructive-unrelated-overlap";
        relationships.push({
          type: "overlaps",
          from: leftId,
          to: rightId,
          confidence: 1,
        });
        collisions.push({
          leftObjectId: leftId,
          rightObjectId: rightId,
          intersectionArea: round(overlap),
          classification,
          ownershipRelationship: owned ? "same-owner" : "different-owner",
        });
      } else
        relationships.push({
          type:
            a.x + a.width <= b.x
              ? "left-of"
              : b.x + b.width <= a.x
                ? "right-of"
                : a.y + a.height <= b.y
                  ? "below"
                  : "above",
          from: leftId,
          to: rightId,
          confidence: 0.9,
        });
    }
  return {
    relationships: relationships.sort((a, b) =>
      `${a.from}:${a.type}:${a.to}`.localeCompare(
        `${b.from}:${b.type}:${b.to}`,
      ),
    ),
    collisions,
  };
}

export function explainPdfPoint(scene, point) {
  const candidates = (scene.objects || [])
    .map((object) => {
      const rect = rectOf(
          object.interactiveRect ||
            object.geometry?.interactiveRect ||
            object.layoutRect ||
            object.pdfRect,
        ),
        inside =
          rect &&
          point.x >= rect.x &&
          point.x <= rect.x + rect.width &&
          point.y >= rect.y &&
          point.y <= rect.y + rect.height;
      return {
        objectId: object.objectId || object.id,
        inside: Boolean(inside),
        paintOrder: Number(object.paintOrder) || 0,
        rect: namedRect(
          rect,
          object.coordinateSpace || rect?.space || "client-css",
        ),
        versionState: object.versionState || "current",
        pointerEvents: object.pointerEvents || "auto",
      };
    })
    .filter(
      (candidate) =>
        candidate.inside &&
        candidate.pointerEvents !== "none" &&
        current(candidate),
    )
    .sort(
      (a, b) =>
        b.paintOrder - a.paintOrder || a.objectId.localeCompare(b.objectId),
    );
  return {
    point: {
      space: point.space || "client-css",
      x: round(point.x),
      y: round(point.y),
    },
    candidates,
    chosen: candidates[0] || null,
    reason: candidates.length
      ? "highest-current-paint-order-containing-point"
      : "no-current-interactive-candidate",
    issues: [],
  };
}

export const getPdfObjectDossier = (scene, id) =>
  (scene.objects || []).find(
    (object) => String(object.objectId || object.id) === String(id),
  ) || null;
export const getPdfObjectRelationships = (scene, id) =>
  (scene.relationships || []).filter(
    (item) => item.from === id || item.to === id,
  );
export const getPdfObjectCollisions = (scene, id) =>
  (scene.collisions || []).filter(
    (item) => item.leftObjectId === id || item.rightObjectId === id,
  );
export const getPdfObjectMasks = (scene, id) =>
  (scene.masks || []).filter(
    (mask) =>
      mask.ownerEditId === id || (mask.sourceObjectIds || []).includes(id),
  );
export const getPdfObjectConstraints = (scene, id) =>
  getPdfObjectDossier(scene, id)?.constraints || [];
export const tracePdfObject = (journal, id) =>
  typeof journal.traceObject === "function"
    ? journal.traceObject(id)
    : (journal || []).filter(
        (record) => record.objectId === id || record.chosenObjectId === id,
      );
export const explainPdfMutation = (journal, sequence) =>
  typeof journal.explain === "function"
    ? journal.explain(sequence)
    : (journal || []).find(
        (record) => record.sequence === sequence || record.eventId === sequence,
      ) || null;
export function comparePdfObjectBeforeAfter(before, after) {
  return {
    objectId: after?.objectId || after?.id || before?.objectId || before?.id,
    before: clone(before),
    after: clone(after),
    geometryChanged:
      JSON.stringify(rectOf(before?.layoutRect || before?.pdfRect)) !==
      JSON.stringify(rectOf(after?.layoutRect || after?.pdfRect)),
    ownershipChanged:
      JSON.stringify(rectOf(before?.sourceOwnershipRect)) !==
      JSON.stringify(rectOf(after?.sourceOwnershipRect)),
    textChanged: String(before?.text ?? "") !== String(after?.text ?? ""),
  };
}

export function buildPdfForensicPage({
  pageId,
  pageNumber,
  mode = "debug",
  objects = [],
  masks = [],
  contentRect = null,
  journal = null,
  generations = null,
  transient = [],
} = {}) {
  if (mode === "off") return null;
  const currentObjects = objects.filter(current),
    history = objects.filter((object) => !current(object)),
    graph = buildPdfRelationshipGraph(currentObjects),
    maskAudit = auditPdfMaskOwnership({ masks, objects: currentObjects }),
    issues = [...maskAudit.issues];
  const bySource = new Map();
  for (const object of currentObjects) {
    if (!object.sourceObjectId) continue;
    const list = bySource.get(object.sourceObjectId) || [];
    list.push(object);
    bySource.set(object.sourceObjectId, list);
  }
  for (const [sourceObjectId, list] of bySource)
    if (list.length > 1)
      issues.push({
        severity: "error",
        code: PDF_FORENSIC_ISSUES.MULTIPLE_CURRENT,
        sourceObjectId,
        objectIds: stable(list.map((object) => object.objectId || object.id)),
      });
  const dossiers = currentObjects.map((object, index) => ({
    objectId: object.objectId || object.id,
    sourceObjectId: object.sourceObjectId || null,
    editId: object.editId || object.ownerEditId || null,
    pageId: pageId || `page:${pageNumber}`,
    lineId: object.lineId || null,
    blockId: object.blockId || null,
    groupId: object.groupId || null,
    kind: object.kind || "unknown",
    semanticRole: object.semanticRole || "BODY_CONTENT",
    provenance: object.provenance || "unknown",
    versionState: "current",
    semanticParentId: object.semanticParentId || null,
    layoutGroupId: object.layoutGroupId || null,
    ownerEditId: object.ownerEditId || null,
    readingOrder: object.readingOrder ?? index,
    spatialOrder: object.spatialOrder ?? index,
    paintOrder: object.paintOrder ?? index,
    geometry: {
      sourceOwnershipRect: namedRect(object.sourceOwnershipRect),
      sourceOriginalRect: namedRect(object.sourceOriginalRect),
      canonicalPdfRect: namedRect(object.canonicalPdfRect || object.pdfRect),
      layoutRect: namedRect(object.layoutRect || object.pdfRect),
      contentBounds: namedRect(contentRect),
      groupUnionRect: namedRect(object.groupUnionRect),
      memberLocalRect: namedRect(object.memberLocalRect, "group-local"),
      expectedViewportRect: namedRect(
        object.expectedViewportRect,
        "pdf-viewport-css",
      ),
      observedDomRect: namedRect(object.observedDomRect, "client-css"),
      glyphInkRect:
        mode === "deep"
          ? namedRect(object.glyphInkRect, "glyph-ink-client-css")
          : null,
      interactiveRect: namedRect(object.interactiveRect, "client-css"),
      editableRect: namedRect(object.editableRect, "editable-field-client-css"),
      hoverRect: namedRect(object.hoverRect, "client-css"),
      liveMaskRect: namedRect(object.liveMaskRect, "pdf-viewport-css"),
      sourceMaskRects: (object.sourceMaskRects || []).map((rect) =>
        namedRect(rect),
      ),
    },
    masks: getPdfObjectMasks({ masks }, object.objectId || object.id).map(
      (mask) => mask.maskId || mask.id,
    ),
    constraints: clone(object.constraints) || [],
    collisions: graph.collisions.filter(
      (collision) =>
        collision.leftObjectId === (object.objectId || object.id) ||
        collision.rightObjectId === (object.objectId || object.id),
    ),
    neighbors: graph.relationships.filter(
      (relation) =>
        (relation.from === (object.objectId || object.id) ||
          relation.to === (object.objectId || object.id)) &&
        ["left-of", "right-of", "above", "below"].includes(relation.type),
    ),
    relationships: graph.relationships.filter(
      (relation) =>
        relation.from === (object.objectId || object.id) ||
        relation.to === (object.objectId || object.id),
    ),
    lifecycle: clone(object.lifecycle) || {},
    transientState: clone(object.transientState) || {},
  }));
  return {
    schemaVersion: PDF_FORENSIC_SCHEMA_VERSION,
    mode,
    pageId: pageId || `page:${pageNumber}`,
    pageNumber,
    coordinateSpaceRegistry: [
      "raw-pdf-source",
      "pdf-points",
      "page-local-pdf-points",
      "group-local",
      "pdf-viewport-css",
      "client-css",
      "glyph-ink-client-css",
      "editable-field-client-css",
      "hover-hit-test-client-css",
      "mask-pdf-points",
    ],
    objects: dossiers,
    history: {
      objects: history.map(clone),
      live: false,
      hitTestable: false,
      editable: false,
    },
    masks: maskAudit.records,
    relationships: graph.relationships,
    collisions: graph.collisions,
    transient:
      mode === "deep"
        ? clone(transient)
        : transient.map((item) => ({
            id: item.id,
            kind: item.kind,
            ownerObjectId: item.ownerObjectId,
            bounds: item.bounds,
          })),
    generations: clone(generations),
    saveIntent: buildPdfSaveIntentLedger({ objects, masks, contentRect }),
    interactionJournal: journal?.snapshot?.() || clone(journal) || [],
    issues: issues.sort((a, b) =>
      `${a.code}:${a.objectId || a.maskId || ""}`.localeCompare(
        `${b.code}:${b.objectId || b.maskId || ""}`,
      ),
    ),
  };
}

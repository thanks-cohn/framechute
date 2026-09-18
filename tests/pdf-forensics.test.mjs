import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { openPdfDocument } from "../src/documents/pdf-document.js";
import {
  PDF_FORENSIC_ISSUES,
  auditPdfMaskOwnership,
  buildPdfForensicPage,
  buildPdfRelationshipGraph,
  buildPdfSaveIntentLedger,
  calculatePdfTextAutofit,
  comparePdfObjectBeforeAfter,
  createPdfCausalJournal,
  createPdfGenerationClock,
  explainPdfMutation,
  explainPdfPoint,
  getPdfObjectCollisions,
  getPdfObjectDossier,
  reconcileSemanticPageToContentBounds,
  sourceOwnershipRectForEdit,
  tracePdfObject,
} from "../src/documents/pdf-forensics.js";

const rect = (x, y, width, height) => ({ x, y, width, height });

test("causal journals are free when off and bounded/deterministic when enabled", () => {
  const off = createPdfCausalJournal();
  assert.equal(off.record("click", { objectId: "a" }), null);
  assert.deepEqual(off.snapshot(), []);
  let now = 100;
  const journal = createPdfCausalJournal({
    mode: "debug",
    limit: 2,
    clock: () => now++,
  });
  journal.record("click", {
    initiator: "user",
    objectId: "one",
    before: { state: "idle" },
    actual: { state: "editing" },
  });
  journal.record("input", {
    initiator: "user",
    objectId: "one",
    parentEventId: "pdf-event:1",
  });
  journal.record("commit", { initiator: "user", objectId: "one" });
  assert.deepEqual(
    journal.snapshot().map((event) => event.event),
    ["input", "commit"],
  );
  assert.equal(explainPdfMutation(journal, 2).parentEventId, "pdf-event:1");
  assert.equal(tracePdfObject(journal, "one").length, 2);
});

test("deep journal samples movement and preserves requested versus actual geometry", () => {
  const journal = createPdfCausalJournal({
    mode: "deep",
    pointerSampleEvery: 2,
    limit: 10,
    clock: () => 1,
  });
  for (let x = 0; x < 5; x++)
    journal.record("move-update", {
      objectId: "edit:1",
      pointer: { x, y: 2 },
      requested: { dx: x },
      actual: { dx: Math.min(x, 3) },
      constraints: x >= 3 ? [{ edge: "right" }] : [],
    });
  const events = journal.snapshot();
  assert.equal(events.length, 2);
  assert.deepEqual(events[1].requested, { dx: 3 });
  assert.deepEqual(events[1].constraints, [{ edge: "right" }]);
});

test("generation clock identifies mask/render disagreement", () => {
  const clock = createPdfGenerationClock();
  assert.equal(clock.snapshot().inSync, true);
  assert.equal(clock.tick("render"), 1);
  assert.equal(clock.snapshot().inSync, false);
  clock.advance("mask");
  clock.advance("replacement");
  assert.equal(clock.snapshot().inSync, true);
  assert.throws(() => clock.advance("future"), /Unknown PDF generation/);
});

test("autofit grows, wraps, shrinks, and unwraps from current text", () => {
  const measure = (value) => value.length * 10;
  const common = {
    fontSize: 10,
    lineHeight: 12,
    measureText: measure,
    contentRect: rect(0, 0, 84, 200),
    minWidth: 16,
    minHeight: 14,
  };
  const grown = calculatePdfTextAutofit({
    ...common,
    text: "one two three four",
    previousText: "one",
    previousRect: rect(0, 0, 34, 14),
  });
  assert.equal(grown.trace.grew, true);
  assert.equal(grown.trace.wrapped, true);
  assert.ok(grown.rect.height > 14);
  const shrunk = calculatePdfTextAutofit({
    ...common,
    text: "one",
    previousText: "one two three four",
    previousRect: grown.rect,
  });
  assert.equal(shrunk.trace.shrank, true);
  assert.equal(shrunk.trace.unwrapped, true);
  assert.deepEqual(shrunk.rect, rect(0, 0, 34, 14));
});

test("autofit distinguishes user locks from automatic minimums", () => {
  const result = calculatePdfTextAutofit({
    text: "x",
    previousText: "long value",
    fontSize: 10,
    lineHeight: 12,
    measureText: (value) => value.length * 5,
    previousRect: rect(0, 0, 100, 30),
    contentRect: rect(0, 0, 200, 100),
    minWidth: 16,
    userWidth: 80,
    userHeight: 24,
  });
  assert.equal(result.rect.width, 80);
  assert.equal(result.rect.height, 24);
  assert.equal(result.trace.constraintReason, "user-size-lock");
  assert.equal(result.trace.shrank, true);
});

test("source ownership remains immutable when layout moves or grows", () => {
  const before = {
    id: "edit:1",
    sourceX: 10,
    sourceY: 20,
    sourceWidth: 30,
    sourceHeight: 12,
    x: 10,
    y: 20,
    width: 30,
    height: 12,
  };
  const after = { ...before, x: 90, y: 100, width: 120, height: 48 };
  assert.deepEqual(sourceOwnershipRectForEdit(before), rect(10, 20, 30, 12));
  assert.deepEqual(sourceOwnershipRectForEdit(after), rect(10, 20, 30, 12));
  const comparison = comparePdfObjectBeforeAfter(
    {
      ...before,
      sourceOwnershipRect: sourceOwnershipRectForEdit(before),
      layoutRect: rect(10, 20, 30, 12),
    },
    {
      ...after,
      sourceOwnershipRect: sourceOwnershipRectForEdit(after),
      layoutRect: rect(90, 100, 120, 48),
    },
  );
  assert.equal(comparison.geometryChanged, true);
  assert.equal(comparison.ownershipChanged, false);
});

test("mask audit catches unrelated erasure and incomplete owned coverage", () => {
  const objects = [
    { id: "source:a", pdfRect: rect(10, 10, 20, 10) },
    { id: "source:b", pdfRect: rect(31, 10, 20, 10) },
  ];
  const result = auditPdfMaskOwnership({
    objects,
    masks: [
      {
        id: "mask:1",
        ownerEditId: "edit:1",
        sourceObjectIds: ["source:a"],
        pdfRect: rect(15, 8, 25, 14),
      },
    ],
  });
  assert.ok(
    result.issues.some(
      (issue) => issue.code === PDF_FORENSIC_ISSUES.UNRELATED_ERASURE,
    ),
  );
  assert.ok(
    result.issues.some(
      (issue) => issue.code === PDF_FORENSIC_ISSUES.MASK_UNDER,
    ),
  );
  assert.deepEqual(result.records[0].unrelatedObjectIds, ["source:b"]);
});

test("exact owned masks produce an attributable clean record", () => {
  const result = auditPdfMaskOwnership({
    objects: [
      { objectId: "source:a", sourceOwnershipRect: rect(10, 10, 20, 10) },
    ],
    masks: [
      {
        maskId: "mask:a",
        ownerEditId: "edit:a",
        sourceObjectIds: ["source:a"],
        maskRole: "source",
        pdfRect: rect(10, 10, 20, 10),
        createdBy: "edit-commit",
      },
    ],
  });
  assert.deepEqual(result.issues, []);
  assert.equal(result.records[0].complete, true);
  assert.equal(result.records[0].createdBy, "edit-commit");
});

test("semantic margin reconciliation moves coherent blocks and preserves member offsets", () => {
  const result = reconcileSemanticPageToContentBounds({
    contentRect: rect(20, 20, 160, 160),
    layout: {
      objects: [
        {
          id: "a",
          blockId: "block:1",
          semanticRole: "BODY_CONTENT",
          bounds: rect(5, 160, 20, 12),
        },
        {
          id: "b",
          blockId: "block:1",
          semanticRole: "BODY_CONTENT",
          bounds: rect(30, 160, 40, 12),
        },
      ],
    },
  });
  assert.equal(result.results[0].disposition, "MOVE");
  assert.deepEqual(result.results[0].actualDelta, { dx: 15, dy: 0 });
  const [a, b] = result.results[0].members;
  assert.equal(b.after.x - a.after.x, 25);
  assert.ok(
    result.issues.some((issue) => issue.code === PDF_FORENSIC_ISSUES.BODY_LEFT),
  );
  assert.ok(
    result.issues.some(
      (issue) => issue.code === PDF_FORENSIC_ISSUES.PARTIAL_GLYPH,
    ),
  );
});

test("page furniture is exempt but source provenance alone is not", () => {
  const result = reconcileSemanticPageToContentBounds({
    contentRect: rect(20, 20, 160, 160),
    layout: {
      objects: [
        {
          id: "header",
          semanticRole: "HEADER",
          allowOutsideContentBounds: true,
          bounds: rect(0, 190, 200, 10),
          provenance: "source-pdf",
        },
        {
          id: "body",
          semanticRole: "BODY_CONTENT",
          bounds: rect(0, 40, 30, 10),
          provenance: "source-pdf",
        },
      ],
    },
  });
  assert.equal(result.results.length, 1);
  assert.equal(result.results[0].groupId, "body");
  assert.equal(result.results[0].disposition, "MOVE");
});

test("oversized semantic units report overflow instead of clipping glyphs", () => {
  const result = reconcileSemanticPageToContentBounds({
    contentRect: rect(20, 20, 100, 100),
    layout: {
      objects: [
        {
          id: "wide",
          semanticRole: "BODY_CONTENT",
          bounds: rect(0, 30, 180, 12),
        },
      ],
    },
  });
  assert.equal(result.results[0].disposition, "OVERFLOW_ERROR");
  assert.deepEqual(result.results[0].actualDelta, { dx: 0, dy: 0 });
  assert.ok(
    result.issues.some(
      (issue) => issue.code === "PDF_SEMANTIC_CONTENT_OVERFLOW",
    ),
  );
});

test("save ledger separates current redraw from superseded masked history", () => {
  const objects = [
    {
      id: "source:a",
      kind: "source-text",
      versionState: "superseded",
      sourceOwnershipRect: rect(10, 10, 30, 12),
      pdfRect: rect(10, 10, 30, 12),
    },
    {
      id: "edit:a",
      kind: "replacement",
      versionState: "current",
      sourceObjectId: "source:a",
      sourceOwnershipRect: rect(10, 10, 30, 12),
      layoutRect: rect(80, 50, 40, 12),
    },
  ];
  const ledger = buildPdfSaveIntentLedger({
    objects,
    masks: [{ id: "mask:a", sourceObjectIds: ["source:a"] }],
    contentRect: rect(20, 20, 160, 160),
  });
  assert.equal(
    ledger.entries.find((entry) => entry.objectId === "source:a").disposition,
    "MASK",
  );
  assert.equal(
    ledger.entries.find((entry) => entry.objectId === "source:a")
      .shouldExistInSavedOutput,
    false,
  );
  assert.equal(
    ledger.entries.find((entry) => entry.objectId === "edit:a").disposition,
    "REDRAW",
  );
  assert.equal(
    ledger.entries.find((entry) => entry.objectId === "edit:a")
      .expectedReopenDisposition,
    "current",
  );
});

test("relationship graph explains owned and destructive overlaps", () => {
  const graph = buildPdfRelationshipGraph([
    { id: "source:a", kind: "source", rect: rect(0, 0, 20, 10) },
    {
      id: "edit:a",
      kind: "replacement",
      sourceObjectId: "source:a",
      rect: rect(0, 0, 20, 10),
    },
    { id: "other", kind: "replacement", rect: rect(15, 0, 20, 10) },
  ]);
  assert.ok(
    graph.relationships.some(
      (item) => item.type === "replacement-for" && item.from === "edit:a",
    ),
  );
  assert.ok(
    graph.collisions.some((item) => item.classification === "owned-overlap"),
  );
  assert.ok(
    graph.collisions.some(
      (item) => item.classification === "destructive-unrelated-overlap",
    ),
  );
});

test("point explanation excludes historical and pointer-transparent candidates", () => {
  const result = explainPdfPoint(
    {
      objects: [
        {
          id: "current",
          interactiveRect: rect(0, 0, 20, 20),
          paintOrder: 2,
          versionState: "current",
        },
        {
          id: "old",
          interactiveRect: rect(0, 0, 20, 20),
          paintOrder: 9,
          versionState: "historical",
        },
        {
          id: "mask",
          interactiveRect: rect(0, 0, 20, 20),
          paintOrder: 10,
          pointerEvents: "none",
        },
      ],
    },
    { x: 5, y: 5 },
  );
  assert.equal(result.chosen.objectId, "current");
  assert.equal(result.candidates.length, 1);
});

test("forensic page provides dossiers, graph, masks, history quarantine, and queries", () => {
  const scene = buildPdfForensicPage({
    pageNumber: 1,
    mode: "deep",
    contentRect: rect(0, 0, 200, 200),
    objects: [
      {
        id: "source:a",
        kind: "source-text",
        versionState: "historical",
        pdfRect: rect(10, 10, 20, 10),
      },
      {
        id: "edit:a",
        kind: "replacement",
        versionState: "current",
        sourceObjectId: "source:a",
        sourceOwnershipRect: rect(10, 10, 20, 10),
        layoutRect: rect(40, 40, 30, 12),
        interactiveRect: rect(40, 40, 30, 12),
        glyphInkRect: rect(41, 42, 20, 8),
        constraints: [{ kind: "margin" }],
      },
    ],
    masks: [
      {
        id: "mask:a",
        ownerEditId: "edit:a",
        sourceObjectIds: ["source:a"],
        pdfRect: rect(10, 10, 20, 10),
      },
    ],
    transient: [
      {
        id: "handles:a",
        kind: "resize-handles",
        ownerObjectId: "edit:a",
        bounds: rect(38, 38, 36, 18),
      },
    ],
  });
  assert.equal(scene.objects.length, 1);
  assert.equal(scene.history.objects.length, 1);
  assert.equal(scene.history.live, false);
  assert.equal(scene.history.hitTestable, false);
  assert.equal(scene.objects[0].geometry.layoutRect.space, "pdf-points");
  assert.equal(
    scene.objects[0].geometry.glyphInkRect.space,
    "glyph-ink-client-css",
  );
  assert.equal(
    getPdfObjectDossier(scene, "edit:a").semanticRole,
    "BODY_CONTENT",
  );
  assert.ok(getPdfObjectCollisions(scene, "edit:a") instanceof Array);
});

test("duplicate current versions for one source are a forensic error", () => {
  const scene = buildPdfForensicPage({
    pageNumber: 1,
    objects: [
      {
        id: "a",
        sourceObjectId: "source:1",
        versionState: "current",
        pdfRect: rect(0, 0, 10, 10),
      },
      {
        id: "b",
        sourceObjectId: "source:1",
        versionState: "current",
        pdfRect: rect(20, 0, 10, 10),
      },
    ],
  });
  assert.ok(
    scene.issues.some(
      (issue) => issue.code === PDF_FORENSIC_ISSUES.MULTIPLE_CURRENT,
    ),
  );
});

test("real PDF fixture is discovered, parsed, and represented canonically", async () => {
  const directory = new URL("../pdf/", import.meta.url);
  const names = (await readdir(directory))
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .sort();
  assert.ok(names.length > 0, "expected at least one discovered PDF fixture");
  const bytes = new Uint8Array(
    await readFile(join(directory.pathname, names[0])),
  );
  const model = await openPdfDocument(bytes);
  try {
    const page = await model.pdf.getPage(1),
      viewport = page.getViewport({ scale: 1 }),
      content = await page.getTextContent();
    const objects = content.items
      .filter((item) => item.str?.trim())
      .map((item, index) => ({
        id: `source:p1:text:${index}`,
        kind: "source-text-run",
        versionState: "current",
        semanticRole: "BODY_CONTENT",
        provenance: "source-pdf",
        pdfRect: rect(
          item.transform[4],
          item.transform[5],
          Math.max(1, item.width),
          Math.max(1, Math.abs(item.transform[3])),
        ),
      }));
    const scene = buildPdfForensicPage({
      pageNumber: 1,
      objects,
      contentRect: rect(0, 0, viewport.width, viewport.height),
    });
    assert.equal(scene.pageNumber, 1);
    assert.equal(scene.objects.length, objects.length);
    assert.ok(scene.coordinateSpaceRegistry.includes("pdf-points"));
    assert.ok(
      scene.saveIntent.entries.every(
        (entry) => entry.currentRect?.space === "pdf-points",
      ),
    );
  } finally {
    await model.pdf.destroy();
  }
});

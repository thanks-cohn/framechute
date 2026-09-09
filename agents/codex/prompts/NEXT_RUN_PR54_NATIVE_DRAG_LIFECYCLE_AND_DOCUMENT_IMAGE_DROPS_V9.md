# FrameChute PR #54 continuation — native drag lifecycle + document image drops V9

This is the authoritative continuation prompt for PR #54.

Start from the latest remote state of PR #54 / branch `codex/fix-drag-ownership-model-for-image-insertion`. Do not start a competing implementation and do not replace the existing V8 architecture. First read `agents/codex/prompts/NEXT_RUN_DRAG_OWNERSHIP_DOCX_PDF_IMAGE_INSERTION_V8.md` from latest `main`; inherit its requirements except where this V9 continuation explicitly overrides them. **V9 wins any conflict.**

## Why this continuation exists

PR #54 has the correct overall direction: one drag-ownership primitive, internal FrameChute image → DOCX/PDF insertion, actual image-byte resolution for custom image blocks, PDF canonical image edits, and suppression of the global `Drop into FrameChute` ingest overlay for internal drags.

However, one browser-lifecycle bug can still invalidate the exact feature we are trying to ship:

- `beginInternalDrag()` is started from native HTML `dragstart`.
- the current ownership module also tears down the session on global `pointercancel`.
- entering native HTML drag-and-drop can itself produce `pointercancel` on the source after `dragstart`.
- therefore the internal session / `sourceBlobProvider` may be destroyed before the image reaches DOCX or PDF.

That can produce the deceptive state where the DataTransfer marker still suppresses the global overlay, yet `imageBlobsForDrop()` no longer has the internal source session needed to supply the real image bytes.

This continuation exists to fix that lifecycle correctly and re-verify the entire drag/drop acceptance matrix before PR #54 is merged.

---

# P0 — native internal-drag lifecycle must survive `dragstart → drop/dragend`

Audit `src/drag-ownership.mjs` and the native dragstart wiring in `src/workspace.js`.

## Required law

Once a FrameChute native HTML drag has successfully begun, its canonical internal drag session must survive for the lifetime of that native drag:

```text
dragstart
→ internal session remains alive
→ dragenter / dragover across workspace
→ DOCX or PDF may claim locally
→ imageBlobsForDrop() can still resolve the source Blob
→ drop (if any)
→ dragend
→ cleanup
```

**Do not terminate an already-started native drag merely because the browser emits the normal `pointercancel` associated with entering native HTML drag-and-drop.**

`dragend` should be the canonical cleanup for a started native drag because it runs after successful and failed/cancelled HTML drag operations.

Escape / blur / explicit cancellation may remain defensive cleanup paths where they are safe, but they must not destroy a legitimate live native drag before its document target can consume the internal source session.

If pointer-based non-HTML object manipulation still needs pointerup/pointercancel cleanup, distinguish that lifecycle explicitly instead of applying one teardown rule to both pointer manipulation and native HTML drag sessions.

Prefer an explicit session mode/state such as conceptually:

```js
{
  mode: "native-drag" | "pointer-manipulation",
  block,
  kind,
  sourceBlobProvider,
  owner,
  claimedBy
}
```

Exact names are your choice. The point is to make the lifecycle unambiguous.

## Hard acceptance

For an existing FrameChute image:

1. `dragstart` creates an internal image session.
2. the browser's native pointer-cancel transition must not erase that session.
3. while the drag is active, `shouldShowGlobalIngest()` remains false.
4. when the drag reaches DOCX/PDF, `imageBlobsForDrop()` still returns the actual image Blob.
5. after drop/dragend, the session is cleared.
6. canceled/failed native drags also eventually clear their session and never leave stale ownership behind.

Add regression coverage for the lifecycle as pure/helper tests wherever possible. A test should explicitly model `begin native drag → pointercancel-like transition → session still alive → document drop resolves source → dragend/end → session gone`.

---

# P0 — preserve and re-verify all three user-facing outcomes

Do not treat the lifecycle fix as complete unless all three original outcomes remain true.

## A. Existing FrameChute image movement

Picking up / dragging an image that is already in FrameChute must **never** activate the global `Drop into FrameChute` overlay.

Acceptance:

```text
existing workspace image
→ drag/move continuously for 10 seconds
→ cross blank workspace and other objects
→ global ingest overlay never appears, not even briefly
```

Repeat several times.

Do not solve this by disabling useful internal image dragging.

## B. Existing/OS image → DOCX

DOCX must accept both:

- OS PNG/JPEG image file
- existing FrameChute image object

For an existing FrameChute image:

- local DOCX drop affordance only
- global ingest overlay stays hidden
- resolve **actual image bytes**, never the custom marker's text/plain persistence payload
- insert exactly once
- original workspace image remains
- mark DOCX dirty
- save / Save As serializes a real DOCX media part + relationship
- reopen preserves the image

Keep the current custom-image source resolver / `FrameChuteWorkspace.sourceBlob()` fix that checks custom `image`/`canvas` state before generic text-backed fallback. Do not regress it.

For external OS images, local document handling must not create sticky global ownership. Entering DOCX and then leaving it without dropping must leave the ordinary workspace eligible to accept the external file immediately.

## C. Existing/OS image → PDF

PDF must accept both:

- OS PNG/JPEG image file
- existing FrameChute image object

For an existing FrameChute image:

- local PDF drop affordance only
- global ingest overlay stays hidden
- resolve actual image bytes from the still-live internal session
- insert exactly once at the natural drop point
- original workspace image remains
- canonical PDF image edit state is created
- inserted image remains selectable, movable, resizable, deletable, and undoable/redone through PDF history
- Save / Save As embeds it into the PDF
- reopen preserves page, position, and size

Preserve the current PNG/JPEG serialization path and do not silently claim unsupported formats work.

---

# P0 — no competing handlers / no duplicate inserts

One gesture has exactly one owner at drop time.

```text
valid DOCX/PDF local target
→ local editor handles it exactly once

else internal FrameChute object drag
→ workspace/internal manipulation only

else external ingest
→ generic workspace ingest
```

A single internal image drag must never both insert into DOCX/PDF and create another workspace image.

A single external file drop must never be inserted twice by competing global/local handlers.

---

# Regression tests to require

At minimum keep/add tests proving:

- internal image drag → global ingest false
- native-drag session survives pointercancel-like transition until dragend/end
- after cleanup, no stale internal session remains
- custom text-backed image block resolves `image/*` Blob, never marker `text/plain`
- internal image remains claimable by DOCX and PDF while native drag is alive
- external image can be locally handled by DOCX/PDF without persistent/sticky document ownership
- external image can leave a document target and then still be ingested by ordinary workspace
- PDF inserted PNG/JPEG serializes into a valid reopenable PDF

Do not write a test that merely asserts the DataTransfer marker exists while the actual internal source session has been lost. The test must cover source Blob availability through the lifecycle.

---

# Preserve current PR #54 improvements

Do not regress:

- shared `drag-ownership.mjs` architecture
- `custom-image-source.mjs`
- custom image/canvas byte resolution before generic text fallback
- external claims being event-local rather than sticky global sessions
- DOCX internal + OS image insertion
- PDF canonical image edit records
- PDF PNG/JPEG embedding
- PDF move/resize/select/delete/history behavior
- global routers consulting drag ownership
- generic external workspace ingest
- merged PR #53 DOCX/PDF standardization

Do not spend this continuation on WEBX, Canvas, 3D, unrelated toolbar work, submenu geometry, or other feature expansion. Get this drag/document path dependable and merge-ready.

---

# Validation

Run at minimum:

```text
node --test tests/*.test.mjs
node --check on every touched JS/MJS file
git diff --check
bash scripts/package-web-store.sh
```

If Chrome/Chromium is available, manually verify:

```text
A. existing image dragged around workspace 10s → NO global overlay
B. existing image → DOCX → one insertion, original remains
C. existing image → PDF → one insertion, original remains
D. OS PNG/JPEG → DOCX/PDF → one insertion
E. external image enters then leaves DOCX/PDF → workspace ingest still works
F. PDF inserted image move/resize/delete/undo/redo
G. Save/reopen DOCX/PDF preserves inserted images
H. successful and cancelled internal native drags leave no stale session
```

If no browser is available, say so plainly in the handoff; do not claim manual acceptance was performed.

---

# 30-minute reliability checkpoint

The 30-minute instruction is **not a development cap**. It exists because the execution environment may continue longer and then terminate without preserving a usable handoff.

Use the available runtime aggressively. At approximately the 30-minute mark, **conclude active implementation and provide a handoff** before runtime failure risk becomes unacceptable.

The handoff must include:

- completed behavior
- exact lifecycle fix
- reusable primitives changed/added
- which original user-facing outcomes are now solved
- any remaining P0s
- files changed
- tests/results
- whether Chrome/Chromium manual checks were actually performed
- known risks
- exact next continuation step if anything remains
- branch
- commit(s)
- PR #54 state/head

Do not interpret the checkpoint as "stop because 30 minutes passed". It exists so another continuation can immediately resume if needed.
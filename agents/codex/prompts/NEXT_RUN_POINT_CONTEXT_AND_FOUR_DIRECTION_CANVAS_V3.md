# NEXT RUN V3 — post-PR51 spatial/document creation pass

Start from the latest `main` after PR #51. Read `agents/codex/prompts/NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS_V2.md`, then apply this V3 as the authoritative override. If there is any conflict, V3 wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## What PR #51 already landed — preserve it

Do not rebuild these from scratch:

- shared PDF/DOCX editor-context routing via `src/actions/context-menu-model.mjs` and `src/editor-context-menu.js`;
- dedicated PDF/DOCX right-click menus that preempt the generic object menu inside editor surfaces;
- Quick Actions bottom `Clear` removal and red header `×` control;
- generic `Open ›`, `Arrange ›`, `Show ›` submenu direction;
- Simple-mode hiding of `Show image only` and timed-motion commands;
- video-capability gating for `Sync with…` / `Make independent`;
- canonical PDF added-text-field records, keyboard Delete, duplication, font mutation, history integration, and top-aligned PDF serialization baseline.

Build on those primitives.

---

# P0 — fix the remaining PR #51 invariants before expanding

## Quick Actions close must always be available when the panel is visible

PR #51 still routes close-button visibility through image-only selection logic. The user-facing law is simpler:

> **If Quick Actions is visible, its small red top-right `×` is visible.**

The `×` only dismisses the panel. It must never clear selection, remove an object, or flip the global preference.

Do not make the `×` disappear merely because the selected object is PDF, DOCX, text, video, SVG, or another non-image type.

## PDF Text Size must be the requested mini-popover, not `prompt()`

Replace the temporary browser `prompt()` path with an anchored small popover attached to `Text Size…`:

```text
8  10  11  12  14  18  24  36  48
Custom: [ 13.5 ] pt
```

Selection remains active. Enter applies. Escape cancels. One change = one undo step.

## Do not expose dead PDF commands

If `Bring Forward`, `Send Back`, `Insert Image…`, `Paste…`, or `Select Region` are shown, they must either work honestly or remain hidden/disabled with a clear reason. Prefer implementing the highest-leverage missing primitives below rather than leaving apparently live menu items that do nothing.

## Simple-mode separators must disappear with the hidden commands

When `Show image only` / timed-motion controls are hidden, do not leave orphan separators or empty submenu groups.

---

# P0 — right-click is point-context, not pre-selection-context

Extend the PR #51 resolver from element-only editor routing into a reusable point-context primitive.

The user should not need to preselect anything to access the full relevant menu.

```text
RIGHT-CLICK LOCATION
        ↓
resolve what is at this point
        ↓
establish temporary/context target
        ↓
show the fullest relevant menu
```

Required cases:

```text
blank workspace → workspace menu
image body → image/object menu
video body → video-capable menu
PDF page → PDF editor menu at that exact page/location
DOCX body → DOCX formatting menu at that caret/range/location
PDF/DOCX header/chrome → generic FrameChute object menu
```

Prefer a shared context record with `clientX/clientY`, workspace/world point, block, object kind, editor kind, PDF page/local point when relevant. Creation actions invoked from a right-click should use that point.

---

# P0 — true four-direction expanding canvas

Remove the old negative-coordinate rescue/clamp behavior from `src/offscreen-rescue.js` (`MIN_GRAB_LEFT`, `MIN_GRAB_TOP`, and coordinate rewriting after direct gestures).

Product law:

> **The canvas expands to accommodate the artwork. The artwork is never pushed back merely to keep its header reachable.**

Dragging/resizing must grow workspace in all four directions:

```text
right → more desk
bottom → more desk
left → more desk
up → more desk
```

Use stable world coordinates and an origin/view-offset/scroll-compensation model for left/top growth. Artwork x/y must not be rewritten because canvas origin moves.

Acceptance:

```text
drag object 1000px left → it stays there → scrollbar can reach full header
drag object 800px up   → it stays there → scrollbar can reach full header
drag diagonally up-left → both axes expand with no visual jump
resize/scroll browser   → object world coordinates unchanged
save/reopen workspace   → same arrangement returns
```

Passive viewport events may recompute extents but must never move artwork.

---

# P0 — top toolbar must CREATE the three document types

Add one obvious compact creation control:

```text
New ▾
  LightComp
  DOCX
  PDF
```

All three choices must create real editable objects, not renamed placeholders.

## LightComp

FrameChute's web-ready, Joplin-like semantic document. Keep the barrier to trying extremely low.

V1:

```text
New → LightComp
→ clean writing surface
→ Markdown-like semantic structure
→ headings/lists/links/code/quotes where practical
→ images/assets through FrameChute primitives
→ web-ready preview
→ Save / Save As
```

Canonical representation must map cleanly to HTML/CSS/assets and later DOCX/PDF. Do not trap content in an opaque format.

## DOCX

Create a real blank editable DOCX using the canonical rich-text/run serializer already in main.

## PDF

Create a real blank PDF page using the current PDF edit-object model so Add Text Field and future image/region primitives work immediately.

---

# P0 — visible `Convert` button on PDF and DOCX

PDF and DOCX top toolbars need:

```text
Convert ▾
  LightComp
  DOCX
  PDF
```

Conversion is non-destructive by default: source remains; new editable target object appears beside it.

Do not build pairwise converters independently. Use a deliberately small shared semantic bridge:

```text
PDF ─────┐
DOCX ────┼→ CommonDocument → LightComp
LightComp┘                  → DOCX
                            → PDF
```

Preserve paragraphs/headings/runs/lists/links/images/alignment where the source honestly exposes them. For PDF, be conservative about semantics.

If the full matrix does not fit, land the shared bridge + all three blank creation paths + Convert UI + at least one honest vertical conversion path from DOCX and one from PDF.

---

# P1 — finish the document-specific menus instead of reverting to generic menus

## PDF

Continue from PR #51:

- Add Text Field already exists; keep canonical and top-aligned.
- Implement real Text Size mini-popover.
- Implement image insertion when feasible using a canonical PDF image/edit-object record.
- Implement `Select Region` as a bounded rectangle/quad object if time remains.
- `Delete`/Undo must work for added fields/images/regions.
- `Bring Forward` / `Send Back` should mutate real ordering if shown.

## DOCX

PR #51 only landed the minimal Bold/Italic/Underline + Save/Save As menu. Expand toward the standardized menu from the prior prompt:

```text
Bold
Italic
Underline
Font…
Text Size…
Paragraph ›
Cut / Copy / Paste
Insert Image…
Save
Save As…
```

Only expose formatting that survives DOCX serialization/reopen. Extend canonical run/paragraph models rather than applying DOM-only CSS.

For DOCX images, support context selection + Delete/Undo and basic resize/replace when honestly supported.

---

# P1 — Snapshot Save As still needs native location picking

The earlier requirement remains outstanding unless it has landed by the time this run starts:

```text
Take Snapshot
→ configure
→ Save Snapshot
→ `showSaveFilePicker()` when supported
→ write chosen file
```

Cancellation is not an error. Fall back to ordinary browser download only when the native picker is unavailable. Reuse the shared native-save/document-save primitive.

---

# P1 — fix frameless/header restore state, do not rebuild chrome

The reported bug remains: remove/restore the frame, rename, restore chrome, and the top header can become visually mashed/duplicated.

Treat this as a canonical-state problem:

- one header DOM subtree per block;
- rename edits the same canonical name field;
- frameless/hide/show toggles visibility/state only;
- restoring chrome never appends a second header/action group;
- repeated hide/show/rename cycles are idempotent.

---

# Preserve these product laws

- **The viewport/canvas moves. The artwork does not.**
- Internal move/resize/select/edit must never trigger the global `Drop into FrameChute` ingest overlay.
- PDF/DOCX editor surfaces own their context menus; generic menu stays on document chrome.
- Simple mode does not show `Show image only`, timed move creation/preview/return/remove, or layer timing.
- `Sync with…` / `Make independent` must never appear for non-video/non-playable objects.
- Generic right-click menu should use compact real submenus rather than repeated `Open…`, `Show…`, `Preview…` rows.
- Quick Actions has a red top-right `×`; no `Clear` button.
- New documents and conversions create real serializable target objects.

---

# Tests / validation

Add focused tests for the highest-risk helpers and regressions:

1. Quick Actions `×` visible whenever panel visible, regardless of object type;
2. PDF text-size popover mutates canonical edit + undo;
3. point-context resolution without preselection;
4. left/top expansion changes origin/extent, not object world coordinates;
5. scroll compensation prevents visual jump during up-left growth;
6. negative-world workspace save/reopen is stable;
7. `New` exposes exactly LightComp/DOCX/PDF and creates real runtimes;
8. PDF/DOCX Convert uses shared bridge and preserves source;
9. DOCX menu formatting serializes/reopens, not DOM-only;
10. no orphan Simple-mode separators/advanced commands;
11. frameless rename/restore does not duplicate header DOM;
12. Snapshot native Save As cancellation is clean if implemented.

Run full `node --test tests/*.test.mjs`, syntax checks for touched JS/MJS, `git diff --check`, and Web Store packaging/release gate.

Manual Chromium checks if available should cover point-context menus, Quick Actions close on multiple object types, left/up canvas growth, New LightComp/DOCX/PDF, Convert, and PDF field save/reopen.

---

# 30-minute priority order

```text
1. fix PR51 residual invariants (Quick Actions ×, PDF size popover, dead/orphan menu UI)
2. point-context resolver using clicked location
3. remove negative clamp + true four-direction canvas/origin/scroll compensation
4. New → LightComp / DOCX / PDF
5. Convert button + shared semantic bridge vertical slices
6. DOCX/PDF menu completion using canonical models
7. Snapshot Save As + frameless/header idempotence if time remains
8. tests + validation
```

Do not spend the run replacing PR #51 foundations with a competing implementation. Extend them.

At the 30-minute mark, **conclude active implementation and provide a handoff** with completed primitives, user-visible changes, remaining work, files changed, tests/results, manual checks, risks/issues, exact next steps, branch, commit, and PR.

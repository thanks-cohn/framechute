# NEXT RUN V6 — image/frame correctness + persistent Quick Actions + toolbar-gated canvas growth + explicit New/Open document and Canvas flows

Start from the latest `main`. Read and execute `agents/codex/prompts/NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS_V5.md`, then apply this V6 as the authoritative override. If there is any conflict, V6 wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

---

# P0 — `Show image only` must actually work

The current `Show image only` / frameless image action can be visible but fail to produce the intended result. Fix the real state transition and rendering path.

Required behavior:

```text
Show image only
→ preserve object world position
→ hide header/footer/border/background/chrome
→ keep the image visible
→ preserve grab/resize/manipulation affordances
→ preserve canonical object name and object state

Restore image frame
→ restore exactly one clean canonical header/footer/frame
→ preserve any rename performed before or during frameless mode
→ never duplicate or mash header DOM
```

This remains Advanced-only according to the existing Simple-mode law. Hidden in Simple mode is correct; broken in Advanced mode is not.

Acceptance:

1. Advanced mode → right-click image → Show → Show image only → chrome disappears immediately.
2. Restore image frame → one clean frame returns.
3. Rename → Show image only → Restore frame → same name, one header.
4. Repeat hide/restore ten times → no duplicate controls or layout drift.

---

# P0 — framed image rotation must look professional

Current behavior can rotate an image by e.g. 15° while leaving the frame axis-aligned, allowing the rotated bitmap to spill beyond the frame/header/footer and look unfinished.

Treat the framed image presentation as a composed object.

Required framed behavior:

```text
rotate image 15° while frame visible
→ rotated visual is deliberately contained inside the media stage/frame
→ no uncontrolled overlap across header/footer/border
→ controls remain usable
→ frame itself stays clean and readable
```

Prefer a proper inner media viewport / clipping stage / transform wrapper with enough padding or fit logic to avoid accidental cropping. Do not simply let the rotated bitmap overflow the object chrome.

Frameless mode may use the rotated visual bounds as the object presentation, but framed mode must remain visually contained.

Rotation state must survive Save/reopen and frameless hide/restore.

---

# P0 — Quick Actions gets persistent Minimize / Maximize

Quick Actions already requires the red top-right `×` and no `Clear` button. Add compact minimize/maximize controls.

Target concept:

```text
Quick Actions                    [−/□] [×]
```

Rules:

- `×` dismisses Quick Actions only; it never clears selection or changes the global preference.
- Minimize collapses Quick Actions to a compact header/chrome state.
- Maximize restores the action body.
- Minimized/maximized state belongs to the **Quick Actions panel**, not to the selected object.
- If Quick Actions is minimized while image A is selected, selecting image B keeps it minimized.
- If it is maximized/restored, switching to another object keeps it maximized.
- Selection changes update action applicability without resetting panel state.
- Preserve draggable panel position and minimized state for the current workspace/session where practical.
- Do not destroy/rebuild the panel merely because selection changed.

Acceptance:

```text
select image A
→ minimize Quick Actions
→ select image B
→ panel remains minimized
→ maximize
→ select image C
→ panel remains maximized
```

The red `×` must remain available whenever the panel itself is visible, including minimized mode.

---

# P0 — canvas growth is deliberately gated by top-toolbar visibility

This overrides the earlier unconditional four-direction auto-expansion requirement.

Product law:

> **Top toolbar visible = stable workspace extent. Top toolbar hidden = free canvas expansion mode.**

The purpose is sanity and stability: the presence of the top toolbar means the workspace should behave like a stable desk rather than continuously manufacturing new space while the user is arranging ordinary objects.

## When the top toolbar is visible

- Existing horizontal/vertical scrollbars may still be used to navigate the current workspace.
- Existing workspace extents remain stable.
- Dragging/resizing objects does **not** automatically create additional world/canvas extent on left/right/up/down.
- Do not shift the world origin merely because the pointer approaches an edge.
- Keep object manipulation reachable and predictable within the existing extent.
- Do not perform a post-gesture hidden coordinate rewrite that causes a visual jump.

If a direct gesture reaches the current canvas boundary, prefer a stable in-gesture boundary behavior rather than silently growing the canvas. The key requirement is: **no new canvas space is created while the top toolbar is visible.**

## When the top toolbar is hidden

Active direct manipulation may create more canvas/workspace in all four directions:

```text
drag right → create more canvas to the right
drag left  → create more canvas to the left
drag down  → create more canvas below
drag up    → create more canvas above
```

Use the world-origin/scroll-compensation model from the earlier spatial prompts so left/top expansion does not produce a visual jump or mutate unrelated object coordinates.

Only active manipulation should create new extent. Passive browser resize/scroll/rerender must not grow the canvas.

Acceptance:

```text
Toolbar visible:
→ scroll around existing workspace normally
→ drag object toward right/left/top/bottom edge
→ workspace does NOT manufacture extra extent

Hide toolbar:
→ drag object past right edge
→ canvas expands right
→ drag object past left edge
→ canvas expands left
→ drag object upward/downward
→ canvas expands there too

Show toolbar again:
→ current expanded canvas remains available
→ new auto-expansion stops
```

This gating must be intentional, testable state, not an accidental consequence of toolbar height.

---

# P0 — explicit `New` creation controls and `Open WEBX`

The top toolbar must let a user both create ordinary work and reopen the native web-ready package.

Required creation choices:

```text
New ▾
  New WEBX
  New DOCX
  New PDF
  New Canvas
```

Required open choice:

```text
Open WEBX…
```

`Open PDF…` and `Open DOCX…` can remain in the broader Open/Upload flow, but `Open WEBX…` must be a first-class working path because `.webx` is FrameChute/LightComp's own portable package format.

Do not use `LightComp` as the file extension. LightComp is the editor/system; WEBX is the file format.

## New WEBX

Creates a LightComp editing surface backed by a real `.webx` runtime/package.

## New DOCX

Creates a real blank editable DOCX object using the canonical DOCX model/serializer.

## New PDF

Creates a real blank editable PDF page/document using the PDF edit-object model.

## New Canvas

Creates a first-class drawing/editing canvas object intended for visual editing, annotation, painting, simple compositing, and drawing workflows.

The Canvas object is **not** WEBX, DOCX, or PDF. It is the direct visual editing surface.

---

# P0 — New Canvas must export to SVG / PNG / JPG / WEBP

`New Canvas` should provide a simple, intuitive drawing/editing surface and export choices appropriate to visual work.

Required export targets:

```text
SVG
PNG
JPG / JPEG
WEBP
```

Use one canonical Canvas scene model so export is an adapter, not four unrelated implementations.

Recommended V1 scene primitives:

```text
canvas size/background
raster image layers
vector shapes
lines/arrows
text
freehand paths
basic grouping/order
transforms
```

Export semantics:

- **PNG**: flattened lossless raster render, alpha supported.
- **JPG/JPEG**: flattened opaque raster render with configurable quality/background handling.
- **WEBP**: flattened raster render with quality/alpha as supported.
- **SVG**: preserve true vector primitives/text/paths whenever the Canvas scene still has them; raster layers may be embedded/referenced as image content rather than pretending they became vectors.

Do not generate a fake “vector” SVG consisting only of a screenshot unless that is explicitly disclosed as the fallback for a raster-only scene.

The Canvas object should support Save/Save As/export without disturbing workspace position/state.

---

# P0 — format-native right-click menus remain mandatory

Preserve V5's product law:

```text
PDF editor body  → PDF-specific menu
DOCX editor body → DOCX-specific menu
WEBX editor body → WEBX/LightComp-specific menu
Canvas body      → Canvas-specific visual editing menu
```

The generic FrameChute workspace/object menu belongs on blank workspace and outer chrome/header contexts, not inside editor bodies.

Canvas-specific context examples may include, where honestly supported:

```text
Draw / Paint
Add Text
Add Shape
Add Line / Arrow
Paste Image
Arrange
Duplicate
Delete
Undo
Redo
Export › SVG / PNG / JPG / WEBP
```

Do not expose dead commands.

---

# P0 — Undo / Redo remains mandatory

PDF, DOCX, WEBX, and Canvas all require coherent Undo/Redo for their own canonical editing state.

Required shortcuts:

```text
Ctrl/Cmd+Z       → Undo
Ctrl/Cmd+Shift+Z → Redo
Ctrl+Y           → Redo where appropriate
```

For Canvas, include at least draw/add/delete/move/resize/rotate/order/text operations in history where implemented.

---

# Preserve V5 submenu geometry fix

The broken detached submenu bug remains P0. Child menus such as `Open ›`, `Arrange ›`, `Show ›`, Font, Text Size, Canvas Export, etc. must appear immediately adjacent to the trigger row, flip left near the right edge, and clamp vertically without detaching.

Prefer one reusable viewport-based submenu positioning helper shared by generic/PDF/DOCX/WEBX/Canvas menus.

---

# Preserve WEBX contract and conversion architecture

Everything from V4/V5 about WEBX remains required:

```text
WEBX (.webx)
= ZIP-like web-ready package
= versioned manifest + index.html + CSS + JS when needed + semantic source + assets
```

It should unpack into ordinary deployable web files and round-trip through LightComp without asset/path drift.

PDF/DOCX/WEBX conversion remains non-destructive through the CommonDocument bridge:

```text
Convert ▾
  WEBX
  DOCX
  PDF
```

Canvas export is separate from document conversion.

---

# Tests / validation additions

Add focused tests where practical for:

1. `Show image only` actually transitions to frameless presentation and restores idempotently;
2. framed rotation does not visibly overflow the managed media stage;
3. Quick Actions minimize/maximize state survives selection changes;
4. red Quick Actions `×` remains available in visible/minimized mode;
5. toolbar-visible mode does not auto-expand canvas extents;
6. toolbar-hidden mode expands left/right/up/down during active manipulation;
7. showing the toolbar again stops new auto-expansion without destroying existing extent;
8. New menu exposes WEBX/DOCX/PDF/Canvas creation;
9. Open WEBX path accepts `.webx` and rebuilds a LightComp editing object;
10. New Canvas creates a real Canvas runtime/object;
11. Canvas export adapters produce PNG/JPEG/WEBP and structurally valid SVG;
12. SVG export preserves vector primitives where available and does not falsely vectorize raster content;
13. PDF/DOCX/WEBX/Canvas body contexts route to their own native menus;
14. Undo/Redo remains coherent across implemented editor mutations;
15. V5 submenu adjacency tests still pass.

Run full `node --test tests/*.test.mjs`, syntax checks for touched JS/MJS, `git diff --check`, and Web Store packaging/release validation.

---

# Updated 30-minute priority order

```text
1. fix Show image only + framed image rotation containment
2. Quick Actions minimize/maximize persistence
3. toolbar-visible stable extent / toolbar-hidden four-direction growth
4. explicit New WEBX / New DOCX / New PDF / New Canvas + Open WEBX
5. Canvas runtime + SVG/PNG/JPG/WEBP export vertical slices
6. preserve/fix V5 attached submenu geometry
7. PDF/DOCX/WEBX/Canvas native context routing + Undo/Redo
8. WEBX package/round-trip + document conversion preservation
9. tests + validation
```

At the 30-minute mark, **conclude active implementation and provide a handoff** with completed primitives, image/frame fixes, Quick Actions state behavior, toolbar-gated canvas behavior, creation/open flows, Canvas export coverage, editor-menu/Undo status, files changed, tests/results, manual checks, remaining work, risks/issues, exact next steps, branch, commit, and PR.

# NEXT RUN — point-context menus + true four-direction expanding canvas

This prompt is for the run **after the currently active document-context/menu pass finishes**. Do not interrupt or rewrite the active run. Start from whatever has landed in `main` at that time.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Main mission

Make FrameChute feel spatially natural in two ways:

1. right-click behavior is determined by **the location under the pointer**, not by requiring the user to pre-select an object first;
2. dragging objects creates workspace in **all four directions**, including left and top, without clamping artwork back toward the origin.

The result should feel like an actual desk/canvas: point somewhere, right-click, get the commands for that place; drag something past an edge, and more desk appears.

---

# P0 — context is resolved from the clicked location

Current and future menu systems must not require a pre-existing selection simply to expose the relevant menu.

Core law:

```text
RIGHT-CLICK LOCATION
        ↓
what is physically under this point?
        ↓
resolve context
        ↓
show the fullest relevant menu for that location
```

Do not make the user first click/select an item and then right-click it merely to get the menu.

Examples:

```text
right-click blank workspace
→ workspace menu

right-click an image body
→ image/object menu for that image, even if it was not selected before

right-click PDF page/editor surface
→ PDF editor menu for that exact page/location/object

right-click DOCX editor surface
→ DOCX formatting/editor menu at that caret/range/location

right-click PDF/DOCX block header/chrome
→ generic FrameChute object/chrome menu

right-click video
→ video-capable menu, including Sync with… / Make independent where supported
```

The pointer location itself should be enough to establish temporary/context selection where appropriate.

## Context-point model

Prefer a reusable resolver such as:

```text
resolveContextAtPoint(event)
```

returning something like:

```text
{
  clientX,
  clientY,
  workspaceX,
  workspaceY,
  block,
  targetElement,
  editorKind,
  objectKind,
  selectionKind,
  page,
  localX,
  localY
}
```

Then menu applicability derives from this context rather than from scattered assumptions about the current global selection.

Selection can still exist for keyboard operations, multi-select, Delete, etc. The rule is only that **context-menu access must not depend on having selected something beforehand**.

## Preserve the menu laws from the preceding pass

Assume the current document/menu run may already land these rules; preserve them rather than reimplementing a competing menu:

- PDF editor surface → PDF-specific menu.
- DOCX editor surface → DOCX-specific menu.
- Quick Actions has a small red top-right `×`, no bottom Clear button.
- Simple mode does not expose timed-motion controls or `Show image only`.
- `Sync with…` / `Make independent` are only for supported playable/video media.
- repeated `Open…`, `Preview…`, `Show…`, etc. actions should live in real pop-out submenus where appropriate.
- frameless/header restore must use canonical chrome state and must not duplicate/mangle the header after rename/restore.

Do not regress those while changing context routing.

---

# P0 — remove left/top clamp behavior

The current `src/offscreen-rescue.js` still contains:

```text
MIN_GRAB_LEFT = -28
MIN_GRAB_TOP = -6
```

and `rescueNegativeWorkspaceCoordinates()` rewrites an object's `left/top` after a direct gesture if it crosses those limits.

That behavior should be removed/replaced.

New law:

> **The canvas expands to accommodate the artwork. The artwork is never pushed back merely to keep its header reachable.**

Do not clamp objects back toward `(0,0)` after pointerup.

Do not rewrite object x/y because it moved left of the original workspace origin.

The previous reason for the clamp was to keep the top-left grab/header accessible. Solve that by making the workspace/scrolling model reach the object, not by moving the object.

---

# P0 — four-direction expanding canvas

Current reachability grows only toward `maxRight` / `maxBottom`. That is insufficient.

Dragging toward any edge should create more workspace:

```text
right edge  → expand right
bottom edge → expand bottom
left edge   → expand left
upper edge  → expand upward
```

User-facing law:

> **Push an object against any edge and FrameChute makes more desk.**

## Important coordinate rule

Preserve the existing spatial permanence principle:

> **The viewport/canvas origin may move. The artwork does not.**

Passive scroll, browser resize, toolbar wrapping, menu opening, etc. must never rewrite stored object coordinates.

For left/top expansion, use a true world-origin/view-offset mechanism rather than changing every object's x/y.

A viable conceptual model:

```text
world coordinates: object.x, object.y     // stable, can be negative
view origin:       originX, originY       // maps world into scrollable DOM space
screen/layout:     world + origin
```

When more canvas is needed on the left/top:

```text
expand left by Δ
→ originX += Δ
→ scrollable width += Δ
→ scrollLeft += Δ
→ object world coordinates unchanged
→ user sees no visual jump
```

Similarly for top:

```text
originY += Δ
height += Δ
scrollTop += Δ
```

The exact implementation can differ, but these invariants must hold:

1. existing object world x/y values are not rewritten merely because left/top workspace grows;
2. the object stays visually under the pointer during expansion;
3. adding left/top space does not make the scene jump;
4. the browser gets enough positive scrollable extent to reach formerly negative-world objects;
5. saved/restored workspace geometry remains deterministic.

If introducing explicit `originX/originY`, make them part of the workspace/camera state rather than ad-hoc per-object offsets.

---

# P0 — scrollbars make every grab header reachable

The replacement for clamping is straightforward conceptually:

```text
object may live far left/up
        ↓
canvas extent/origin expands
        ↓
scrollbars gain range
        ↓
user scrolls to object
        ↓
its top-left header/grab area is reachable
```

Acceptance:

```text
1. Drag an object 1000px left of the original origin.
   → it stays there.
   → horizontal scrolling can reach its entire frame/header.

2. Drag an object 800px upward.
   → it stays there.
   → vertical scrolling can reach its header.

3. Drag diagonally up-left.
   → both axes expand.
   → no jump.
   → no coordinate clamp on pointerup.

4. Scroll/resize the browser afterward.
   → object world coordinates remain unchanged.

5. Save Workspace → reopen.
   → the same spatial arrangement and reachable extents return.
```

A header should never become permanently inaccessible merely because the object lives in negative world coordinates.

---

# P0 — expansion happens during direct manipulation

Expansion should be driven by active object movement/resize, not passive viewport events.

Good triggers:

```text
active drag near edge
active resize near edge
menu Grab / Move mode near edge
```

Bad triggers:

```text
window resize
scroll
opening toolbar/menu
restoring hidden chrome
passive rerender
```

Passive events may recompute scroll extents from existing world bounds, but must not mutate artwork or create directional drift.

Prefer incremental edge expansion with a comfortable threshold/padding so movement feels continuous rather than forcing the pointer against the exact last pixel.

---

# P1 — persist world bounds/origin cleanly

If the four-direction model introduces origin/camera state, persist only what is needed to reproduce the same workspace without rewriting objects.

Prefer something conceptually like:

```text
workspaceState: {
  originX,
  originY,
  extentWidth,
  extentHeight,
  scrollX?,
  scrollY?
}
```

or derive extents safely from world bounds when loading.

Do not produce cumulative drift across repeated:

```text
save → reopen → save → reopen
```

Existing `.fcx` / Export Workspace compatibility should remain intact. Old workspaces without explicit origin state should load with sensible defaults.

---

# P1 — spatial context menu can use the click point for creation actions

Once context is point-driven, actions that create things should naturally use the clicked location.

Examples:

```text
right-click blank workspace → Add Text
→ text object appears near clicked point

right-click PDF empty page area → Add Text Field
→ field starts near that PDF-local point

right-click PDF page → Select Region
→ region interaction starts from that page/location
```

Do not create new objects at a stale global selection location or arbitrary screen center when the user explicitly invoked the command at a meaningful point.

This is a foundational interaction primitive, not just menu polish.

---

# Architectural target

Aim for:

```text
Pointer location
      ↓
Context resolver
      ↓
Target/capability selection
      ↓
Command registry/menu
      ↓
Action uses local/world coordinates
```

and independently:

```text
Stable world coordinates
      ↓
world bounds
      ↓
origin + scrollable extent
      ↓
scrollbars / camera
```

Do not mix the two by making context logic move artwork or by making reachability code rewrite coordinates.

---

# Tests

Add focused tests around pure helpers where possible:

1. context resolution from blank workspace vs object vs PDF surface vs DOCX surface vs header/chrome;
2. context menu works without pre-existing selection;
3. creation commands receive the clicked world/local point;
4. left expansion increases origin/extent without changing object world x;
5. top expansion increases origin/extent without changing object world y;
6. simultaneous up-left expansion preserves visual position via scroll compensation;
7. right/bottom expansion still works;
8. no coordinate rewrite after pointerup;
9. passive resize/scroll never changes object x/y;
10. save/reopen preserves negative-world arrangements or equivalent origin mapping;
11. headers remain reachable via scroll range after extreme left/top placement.

---

# Manual acceptance if Chromium is available

```text
1. With nothing selected, right-click an image → full image/object menu for that image.
2. With nothing selected, right-click blank workspace → workspace menu.
3. Right-click PDF body → PDF menu; PDF header → generic menu.
4. Right-click DOCX body → DOCX menu; DOCX header → generic menu.
5. Drag image far left → canvas grows left; object is not clamped back.
6. Drag image far above original origin → canvas grows upward.
7. Drag diagonally up-left continuously → no visual jump.
8. Scroll to the object → full top-left grab/header remains reachable.
9. Resize browser/toolbar → artwork coordinates do not move.
10. Export Workspace/reopen → spatial layout remains intact.
```

---

# 30-minute priority order

```text
1. point-based context resolver and no-preselection menu behavior
2. remove negative-coordinate rescue/clamp
3. world-origin support for left/top expansion
4. smooth four-direction drag expansion + scroll compensation
5. persistence/backward compatibility
6. tests + header reachability polish
```

Do not spend the run rebuilding document menus that the prior run already implemented unless integration is necessary.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- reusable primitives landed,
- user-visible behavior fixed,
- files changed,
- tests/results,
- manual checks performed/not performed,
- risks/issues,
- exact next highest-leverage pass,
- branch,
- commit,
- PR.

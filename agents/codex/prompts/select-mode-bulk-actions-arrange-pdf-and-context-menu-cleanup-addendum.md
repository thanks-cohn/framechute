# Addendum: restore first-class Select Mode, bulk actions, Arrange into PDF, and remove sync/independent from right-click menus

Read this together with the current next-run prompt stack:

```text
agents/codex/prompts/document-image-drop-direct-manipulation-fcx-persistence-correctness.md
agents/codex/prompts/expandable-workspace-simple-mode-timed-move-and-snapshot-bounds-addendum.md
agents/codex/prompts/pdf-multiline-fields-and-marquee-selection-addendum.md
agents/codex/prompts/pdf-drop-overlay-edit-affordance-and-document-image-undo-critical-addendum.md
agents/codex/prompts/image-utilities-screen-capture-and-snapshot-output-correctness-addendum.md
```

This addendum is part of the **same next Codex run**.

There is also an older durable requirement that already specified Select Mode:

```text
agents/codex/prompts/next-simple-ui-select-context-pass.md
```

That requirement never fully landed on current `main`. Reconcile it into the current architecture instead of reviving stale/conflicted PR #42 wholesale.

FrameChute's interaction rule is:

> Select the things. Then do the obvious thing to the selection.

---

# 1. Remove `Sync with…` and `Make independent` from object right-click menus

The user explicitly does **not** want these as right-click menu entries:

```text
Sync with…
Make independent
```

Current `src/layer-menu.js` still creates both entries and only hides them conditionally outside Advanced/timed-media contexts.

Change the rule:

> These two commands do not belong in the object context menu at all.

Requirements:

- Remove `Sync with…` from the object right-click menu in **Simple and Advanced** modes.
- Remove `Make independent` from the object right-click menu in **Simple and Advanced** modes.
- Remove their context-menu separators when no longer needed.
- Remove dead click-dispatch/menu-specific handling associated only with these menu entries.
- Do not break the underlying media synchronization engine if it is used elsewhere.
- If synchronization remains a supported advanced capability, expose it only in a deliberate non-context-menu surface such as the Advanced media/player panel or another explicit editor, not in ordinary object right-click.
- Do not replace these with differently worded equivalents in the same menu.

Acceptance:

```text
Right-click image/video/audio in Simple mode
→ no Sync with…
→ no Make independent

Right-click image/video/audio in Advanced mode
→ still no Sync with…
→ still no Make independent
```

---

# 2. First-class top-toolbar Select Mode switch

Add a persistent, obvious top-toolbar control:

```text
Select Mode  [ OFF ]
Select Mode  [ ON  ]
```

It must live in the top FrameChute toolbar/workflow strip, not hidden in Settings and not only in a right-click menu.

Current `src/workspace.html` does not expose this top-level control even though the older `next-simple-ui-select-context-pass.md` already required it.

Use the existing selection model/Quick Actions selection infrastructure as the foundation. Do **not** build a second unrelated selection system.

Required behavior:

```text
Select Mode OFF
→ ordinary FrameChute direct manipulation behaves normally

Select Mode ON
→ click object toggles selection
→ click another object adds/replaces according to normal modifier semantics
→ selected objects show quiet selection chrome
→ ordinary click does not accidentally drag/edit the object
```

Desktop-style semantics:

```text
plain click object
→ make it the selection / select it predictably

Ctrl/Cmd-click
→ toggle that object in the current selection

Shift-click
→ add/toggle consistently

click empty workspace
→ clear selection

Escape
→ clear selection or exit an in-progress marquee
```

A simple top switch should be accessible by keyboard and expose `aria-pressed` or equivalent state.

The ON/OFF state may persist across reload if consistent with the existing settings model, but at minimum it must survive harmless dialogs/context menus and never flip accidentally.

---

# 3. Select Mode must work across normal workspace objects

At minimum support:

- images,
- videos,
- audio,
- PDF objects,
- DOCX objects,
- text/note objects,
- canvas/generated visual objects,
- other ordinary top-level `.block` objects that can safely participate.

Mixed selection is allowed.

Examples:

```text
3 images
→ valid selection

2 images + PDF
→ valid mixed selection

DOCX + video + image
→ valid mixed selection
```

Selection must be object-level. Do not confuse this with the separate **inside-PDF marquee selection** requested in the PDF prompt.

When Select Mode is ON:

- do not start object drag on ordinary click,
- do not open image editor on ordinary click,
- do not accidentally start native browser drag,
- do not show global ingestion overlay,
- preserve selection through context-menu opening and bulk-action dialogs,
- closing/deleting an object removes it from the selection immediately.

---

# 4. Marquee selection on the workspace

Add workspace marquee selection if safely implementable in the run.

Preferred behavior:

```text
Select Mode ON
→ pointer-down on empty workspace
→ drag rectangle
→ visible quiet marquee
→ release
→ intersecting/contained top-level objects become selected
```

Requirements:

- marquee is workspace-level only,
- do not start when pointer begins on an object control/input/resize handle,
- works with expanded/infinite workspace coordinates,
- respects current world/origin/scroll model,
- never rewrites object positions,
- selection rectangle is temporary UI only.

If marquee cannot be finished safely in the timebox, click-based multi-select is mandatory and marquee should be handed off explicitly.

---

# 5. Bulk action surface appears when multiple objects are selected

When selection count is 2 or more, expose a compact bulk-action surface tied to the existing Quick Actions system.

It should show the selected count, for example:

```text
4 selected
```

Only show actions valid for the current selection.

Examples of immediate useful bulk actions:

```text
Close Selected
Bring to Front
Send to Back
Export / ZIP Selected
Take Snapshot of Selection / FrameSnap Selection (if existing primitives allow)
Arrange into PDF…
```

For all-image selections also expose supported image bulk operations already planned/implemented, such as resize/format where the utility already supports a selected-image scope.

Do not show a bulk command that silently applies only to one item. Scope must be explicit.

One bulk action should produce one coherent history/state change where practical.

---

# 6. `Arrange into PDF…` from selection

Add a first useful composition action:

```text
Select Mode
→ select multiple eligible workspace objects
→ Arrange into PDF…
```

This is distinct from FrameSnap:

```text
FrameSnap / Take Snapshot
→ preserve spatial composition as one flattened image

Arrange into PDF
→ turn selected source items/pages into an ordered multi-page PDF
```

V1 eligibility:

- image objects: each image can become one page,
- PDF objects: include current PDF pages or entire PDF as explicitly chosen,
- generated snapshot/image objects: same as normal images,
- unsupported object types should be clearly excluded or rasterized only if there is already a trustworthy local render path.

Do not silently rasterize DOCX/video/web objects unless the user explicitly chooses a supported conversion route.

Preferred workflow:

```text
Select objects
→ Arrange into PDF…
→ organizer dialog opens
→ selected items/pages appear as ordered entries/thumbnails
→ drag to reorder
→ remove entries if desired
→ choose basic page fit/orientation behavior
→ Make PDF
→ Preview / Save As
→ optional Add to Workspace
```

Keep V1 simple. Minimum viable organizer may be a reorderable list with names/thumbnails rather than a giant page-layout editor.

---

# 7. Ordering rules for Arrange into PDF

Initial ordering should be deterministic.

Preferred default:

- use current workspace visual reading order where practical (top-to-bottom, then left-to-right), or
- use explicit selection order if the selection model already records it reliably.

Whichever rule is chosen, document it in code and tests.

User can reorder before output.

For selected PDFs:

```text
PDF object
→ default include all pages in original order
```

Provide an obvious way to include only current page if practical, but do not overbuild page extraction UI if it threatens the main run.

---

# 8. PDF output semantics

For images:

- preserve aspect ratio,
- center/fit within page by default,
- do not distort,
- use sensible white page background unless image transparency/page option says otherwise.

For PDF source pages:

- prefer importing/copying original PDF pages with `pdf-lib` or equivalent instead of rasterizing them,
- preserve vector/text quality where possible.

For mixed images + PDFs:

- output one coherent multi-page PDF.

Provide at minimum:

```text
Page size: Auto / Letter / A4
Fit: Contain
Orientation: Auto
```

Auto may use source dimensions where practical.

Save As uses the existing native save abstraction.

Optional `Add result to Workspace` should create a normal PDF object from the generated Blob without rerunning generation.

---

# 9. Selection persistence and FCX

The important persistent thing is the objects, not necessarily the ephemeral selection chrome.

Required:

- selecting objects must never mutate their source state,
- selection should survive harmless UI rerenders while the workspace remains open,
- FCX does not need to reopen with the exact same objects selected unless this falls naturally out of current state,
- Arrange into PDF output, if added to workspace, must persist like any other generated PDF object.

Do not make selection state required for workspace recovery.

---

# 10. Simple vs Advanced behavior

Select Mode is **not** an Advanced-only capability.

It is a basic everyday workspace primitive and must be visible in Simple mode.

```text
Simple mode
→ Select Mode available
→ bulk file/image/PDF composition actions available
→ no timed-move clutter
→ no Sync with…
→ no Make independent

Advanced mode
→ Select Mode still available
→ advanced-only capabilities may exist elsewhere
→ still no Sync with… / Make independent in object right-click menus
```

---

# 11. Tests / acceptance

Add focused coverage where possible.

Minimum automated/static checks:

```text
1. Top toolbar contains Select Mode control.
2. Select Mode OFF preserves ordinary interaction routing.
3. Select Mode ON click selects without starting object move.
4. Ctrl/Cmd/Shift click toggles/extends selection predictably.
5. Mixed object selection is allowed.
6. Deleting/closing selected object removes it from selection.
7. Bulk action resolver only exposes actions valid for current selection.
8. Right-click menu markup/model contains neither Sync with… nor Make independent.
9. Advanced mode also does not restore those two context items.
10. Arrange into PDF accepts selected images.
11. Arrange into PDF can copy PDF pages without rasterizing them where supported.
12. Reorder model produces deterministic page order.
13. Generated PDF can Save As and optionally Add to Workspace without duplicate generation.
14. Selection operations do not activate the global ingestion overlay.
15. Expanded workspace coordinates do not break selection/marquee.
```

Manual browser smoke test:

```text
A. Turn Select Mode ON from the top toolbar.
B. Select three separate workspace objects.
C. Confirm normal object dragging did not begin while clicking them.
D. Ctrl/Cmd-click one selected object and confirm it toggles off.
E. Select two images and one PDF.
F. Open bulk actions → Arrange into PDF…
G. Reorder entries and create PDF.
H. Save As and reopen output; page order matches organizer.
I. Add result to Workspace; exactly one generated PDF object appears.
J. Right-click video/image in Simple and Advanced → no Sync with… and no Make independent.
```

---

# 12. Preserve current good behavior

Do not regress:

- document-image drop/undo work,
- PDF multiline and internal marquee work,
- internal drag overlay fix,
- FCX local-image persistence,
- image utility live-preview fixes,
- screenshot black-frame fix,
- Take Snapshot extra options,
- expandable workspace edge growth,
- Tight/Square snapshot bounds,
- Quick Actions behavior,
- native Save/Save As,
- spatial permanence.

Do not merge stale PR #42 wholesale merely to recover Select Mode. Re-implement/reconcile the useful selection behavior onto current `main` and current architecture.

---

# 13. Timebox / handoff

Use up to 30 minutes.

Prioritize in this order:

```text
1. Remove Sync with… / Make independent from right-click menus.
2. Land working top-toolbar Select Mode + multi-select.
3. Wire valid bulk-action selection surface.
4. Land Arrange into PDF V1 if time permits safely.
5. Workspace marquee selection if time permits safely.
```

At the 30-minute mark, **conclude active implementation and provide a handoff**.

Handoff must include:

```text
completed
remaining
files changed
tests/results
manual browser results / anything not browser-tested
known issues/risks
exact next steps
branch/commit/PR
```

If Arrange into PDF or marquee cannot be completed safely inside the timebox, do not weaken Select Mode correctness. Ship a clean tested Select Mode foundation and clearly hand off the remaining piece.
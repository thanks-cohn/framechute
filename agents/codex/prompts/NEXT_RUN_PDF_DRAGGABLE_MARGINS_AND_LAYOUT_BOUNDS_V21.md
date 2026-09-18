# NEXT RUN — PDF DRAGGABLE MARGINS + LAYOUT BOUNDS + FUTURE CONTENT-BLOCK ARCHITECTURE V21

## Mission

Build the first real **layout-boundary system** for Substrate's PDF editor.

The immediate user-facing feature must be simple and polished:

`Margins [ ON ]`
`Margins [ OFF ]`

When ON, four tasteful draggable margin guides appear over the PDF page.

When OFF, the guides disappear.

But the deeper goal is much larger:

> establish the mathematical architecture that later allows Substrate to reason about and move meaningful Text Blocks, Image Blocks, and mixed Content Blocks as coherent units.

This run should leave Substrate with a reusable framework for:
- page content bounds,
- margin constraints,
- editable-object containment,
- stable content groups,
- group union bounds,
- member-relative geometry,
- future block movement,
- future image+text movement,
- future reflow,
- agent-visible structure,
- eventual WEBX layout interoperability.

Do not treat this as a cosmetic overlay feature.

---

# 0. IMPLEMENTATION SIZE / QUALITY BAR

This is intentionally a substantial architecture run.

Do not solve it with a tiny patch.

Minimum expectation:
- at least **300 meaningful new or changed lines of implementation code**
- plus focused tests
- **500–700 lines of implementation code is completely acceptable**

Do not game the line count with:
- comments,
- blank lines,
- duplication,
- boilerplate.

The goal is a successful architecture, not smallness.

If the correct solution needs:
- a new layout-bounds module,
- a new content-group geometry module,
- workspace integration,
- diagnostics changes,
- toolbar integration,
- persistence,
- focused tests,

then build those pieces cleanly.

---

# 1. CURRENT BASE

Start from latest `main` after PR #78.

Preserve all recent PDF improvements:
- native PDF source hover authority,
- accurate DOM replacement/free-text hover authority,
- Enter-to-finish editing,
- live edit-field growth,
- terminal live-mask bleed,
- stable three-row toolbar,
- truthful Copy behavior,
- save/reopen parity,
- diagnostics OFF by default.

Read current code before changing anything.

Inspect at minimum:
- `src/workspace.js`
- `src/workspace.css`
- `src/pdf-popdowns.js`
- `src/documents/pdf-document.js`
- `src/documents/pdf-geometry.js`
- `src/documents/pdf-layout.js`
- `src/documents/pdf-observability.js`
- `src/actions/context-menu-model.mjs`
- `src/editor-context-menu.js`
- relevant `tests/*.test.mjs`

Important current facts:
- PDF semantic/layout geometry is expressed in PDF points.
- `pdf-layout.js` already reconstructs source runs, lines, blocks, reading order, flow regions, and semantic groups.
- user-authored PDF edits already have PDF-point rectangles.
- the toolbar is normalized into exactly three persistent rows.
- diagnostics can already detect canvas/text-layer/page-origin shifts.
- user font size is authoritative and must never be silently reduced to make text fit.

Build on those systems.

Do not create a parallel coordinate model.

---

# 2. IMMEDIATE USER EXPERIENCE

## 2.1 Toolbar control

Add one stable PDF toolbar control:

`Margins [ ON ]`
`Margins [ OFF ]`

It must:
- exist exactly once,
- live in the current three-row toolbar,
- not create a fourth row,
- not change total toolbar height when toggled,
- not duplicate during repeated toolbar enhancement,
- use `aria-pressed`,
- remain readable at narrow widths.

Recommended title:

"Show or hide PDF layout margins. Margin rules remain active while hidden."

Recommended placement:
- third/tools row near File / Organize / More,
- unless current toolbar grouping suggests a cleaner stable location.

---

## 2.2 Visibility and enforcement are separate concepts

This distinction is mandatory.

Create separate state for:

```
marginGuidesVisible
marginConstraintsEnabled
pdfMargins
```

### marginGuidesVisible
Controls whether the dashed guides are shown.

### marginConstraintsEnabled
Controls whether editable geometry is actually constrained.

For this run:

`marginConstraintsEnabled = true` by default.

There does NOT need to be a full Settings UI for disabling constraints yet unless it is trivial and safe.

However, architecture and persistence must already support it because later Settings will expose something conceptually like:

`Keep PDF edits inside margins [ ON / OFF ]`

Future OFF behavior:
- guides may still be visible,
- but user-authored objects may cross them.

Current/default behavior:
- constraints ON.

The Margins toolbar button should control **guide visibility only**, not enforcement.

---

# 3. DEFAULT CONTAINMENT BEHAVIOR

This is one of the main acceptance requirements.

By default, **all editable boxes must live inside the active margin content rectangle**.

This includes at minimum:
- replacement text fields,
- free text fields,
- inserted images,
- duplicated editable objects,
- moved editable objects,
- resized editable objects,
- future movable groups through the generic constraint API.

When margins are first established or changed, existing editable boxes that violate them should be reconciled inward when possible.

The user should not have to manually clean up a bunch of boxes.

The system should make the page immediately orderly.

### Important distinction

Do NOT rewrite untouched historical/native PDF canvas content merely because it lies outside the new authoring margins.

Native source content is historical page content.

The containment rule applies to:
- user-authored geometry,
- user-modified geometry,
- movable/editable Substrate objects,
- future explicit grabbed content groups.

Do not move the invisible source hover surrogates for untouched text.

---

# 4. CANONICAL MARGIN MODEL

Store margins in PDF points.

Conceptual shape:

```js
{
  left,
  right,
  top,
  bottom
}
```

Each value is an inset from the corresponding physical page edge.

Never persist:
- clientX,
- clientY,
- DOMRect coordinates,
- CSS-pixel guide positions.

Those are only projections.

---

## 4.1 Derived content rectangle

Given page bounds:

```js
pageBounds = {
  x,
  y,
  width,
  height
}
```

derive:

```js
contentRect = {
  x: pageBounds.x + left,
  y: pageBounds.y + bottom,
  width: pageBounds.width - left - right,
  height: pageBounds.height - top - bottom
}
```

Remember PDF coordinate direction.

Keep this calculation in one canonical helper.

Do not reimplement it in pointer handlers.

---

## 4.2 Defaults

Use a predictable initial default:

- 36 PDF points left
- 36 PDF points right
- 36 PDF points top
- 36 PDF points bottom

That is one-half inch.

If a page is too small:
- clamp safely,
- preserve a minimum usable content area,
- never invert the rectangle.

Do not infer initial margins from random source-text extents.

Predictability matters more than cleverness in V21.

---

## 4.3 Minimum usable region

Guides cannot cross.

Define minimum usable:
- width,
- height,

in PDF points.

Dragging a guide stops when continuing would make the content rectangle smaller than those limits.

The math should feel physically bounded and deterministic.

---

# 5. REUSABLE LAYOUT-BOUNDS MODULE

Create a generic math layer.

Do not call the deepest primitive only "margins" because margins are merely the first user of it.

Recommended responsibilities:

```js
normalizePdfMargins(pageBounds, margins)
derivePdfContentRect(pageBounds, margins)

isRectInsideLayoutBounds(rect, bounds)
detectLayoutBoundViolations(rect, bounds)

constrainRectToLayoutBounds(rect, bounds, options)
constrainTranslationToLayoutBounds(rect, desiredDelta, bounds)
constrainResizeToLayoutBounds(rect, desiredRect, bounds, options)
```

Names may differ.

The important point is:

> one rectangle constraint engine should work for one text field, one image, one Text Block, one Image Block, and a future mixed Content Block.

Prefer a dedicated module such as:

`src/documents/pdf-layout-bounds.js`

if that produces cleaner architecture.

---

# 6. GUIDE RENDERING

When `marginGuidesVisible` is true, render four page-anchored guides:
- left
- right
- top
- bottom.

They must correspond exactly to the canonical PDF-point content rectangle after projection through existing PDF geometry utilities.

### Visual style

Use:
- thin strokes,
- small dashes / separated segments,
- restrained contrast,
- print/drafting/fold-guide feeling,
- no filled overlay,
- no thick selection box,
- no crop-tool visual language.

These are layout guides, not CropBox controls.

---

# 7. POINTER SAFETY — CRITICAL REGRESSION WARNING

A prior margin-guide experiment broke PDF editing because an overlay intercepted pointer input.

Do not repeat that architecture.

The generic guide layer must be:

`pointer-events: none`

Only deliberately small drag handles / hit lanes may use:

`pointer-events: auto`

The page must retain normal:
- hover,
- click,
- double-click,
- selection,
- contenteditable activation,
- search,
- scrolling,
- image interaction.

A word near a guide must still be clickable unless the pointer intentionally begins on the guide handle.

Turning margins ON must not shift:
- canvas,
- text layer,
- reader origin,
- page viewport,
- toolbar height.

---

# 8. DRAGGING MARGINS

Each guide gets a small drag affordance.

- left/right -> horizontal-resize cursor
- top/bottom -> vertical-resize cursor

During drag:

1. capture pointer in page-local viewport geometry
2. convert through existing PDF geometry adapters
3. update PDF-point margin value
4. normalize/clamp it
5. repaint guides
6. update diagnostics
7. DO NOT move the PDF page

Do not store arbitrary client offsets.

On pointer release:
- finalize canonical margin state,
- reconcile editable objects into the new content rectangle,
- mark editor/document state dirty as appropriate,
- dispatch existing workspace-change persistence events if needed.

---

# 9. RECONCILIATION: "ALL BOXES INSIDE"

This must be a first-class operation.

Create something conceptually like:

```js
reconcileEditableGeometryToContentBounds({
  edits,
  contentRect,
  policy
})
```

It should inspect all current editable/movable PDF objects.

For each violation:

### If the object fits inside contentRect
translate it inward by the smallest deterministic delta that makes it legal.

### If the object is larger than contentRect
do not fake success.

Return a structured result such as:

```js
{
  status: "overflow",
  objectId,
  reason: "object-larger-than-content-bounds"
}
```

Do not:
- shrink font size,
- crop images,
- distort aspect ratio,
- silently delete content.

Expose unresolved overflow to diagnostics and user status.

---

# 10. NEW OBJECT PLACEMENT

Every newly created editable box should be constrained immediately.

This includes:
- Add Text Field,
- replacement text generated from source editing,
- duplicated fields,
- inserted images,
- future paste operations.

If requested placement crosses the margins:
- shift it inward,
- preserve size when possible.

If the object cannot fit:
- return overflow,
- do not pretend it did.

---

# 11. MOVEMENT

For any movable editable object:

```js
requestedDelta = { dx, dy }

actualDelta = constrainTranslationToLayoutBounds(
  objectBounds,
  requestedDelta,
  contentRect
)
```

An object may:
- touch the line,
- never cross the line while constraints are ON.

Use the same primitive later for whole content groups.

---

# 12. RESIZE

Resizing must also respect content bounds.

When a resize reaches a margin:
- stop that edge,
- keep the opposite anchor stable,
- preserve minimum size,
- preserve image aspect ratio where current policy requires it.

For text:
- do not reduce font size.
- growing height downward must stop/resolve at bottom margin.
- growing width must stop/resolve at left/right margins.

If content no longer fits:
- keep a visible/diagnostic overflow condition,
- do not silently shrink typography.

---

# 13. LIVE / SAVE / REOPEN PARITY

Margin guides themselves are editor chrome.

They must not be painted into exported PDF pages.

But all geometry resulting from margin constraints must serialize in the exact same PDF-point positions shown live.

Invariant:

`live PDF-point edit rect == serialized PDF-point edit rect`

within justified existing tolerances.

Do not implement a client-only visual clamp that disappears on save.

On reopen:
- margin state should restore where Substrate state supports it,
- editable objects should remain in the same positions.

If a plain exported PDF is reopened without Substrate margin metadata:
- use defaults,
- do not pretend old authoring margins are knowable.

---

# 14. PERSISTENCE SHAPE

Prefer a future-safe state model like:

```js
{
  guidesVisible: true,
  constraintsEnabled: true,
  defaultMargins: {
    left: 36,
    right: 36,
    top: 36,
    bottom: 36
  },
  perPage: {}
}
```

It is acceptable for V21 to use only `defaultMargins`.

But do not make per-page support require an architectural rewrite.

Guide visibility and enforcement must be stored independently.

---

# 15. FUTURE "GRAB BLOCK" ARCHITECTURE

This run should not expose the final feature yet.

But it must prepare for future user-facing commands such as:

- Grab Text Block
- Grab Image Block
- Grab Content Block

Do not use "glyph block" in user-facing UI.

"Text Block", "Image Block", and "Content Block" are the intended conceptual language.

A future Content Block may contain both text and images.

The point of this architecture is that meaningful clusters can become movable as a whole.

---

# 16. MATHEMATICAL CONTENT GROUPS

A content group should exist mathematically even when no box is visible.

Conceptual structure:

```js
ContentGroup {
  id
  page
  kind
  memberIds
  bounds
  provenance
  confidence
  semanticParentId
  layoutGroupId
  childGroupIds
  readingOrder
  spatialOrder
  metadata
}
```

Group kinds should be extensible.

Examples:
- text-block
- image-block
- mixed-content-block
- region
- free-object-group

Do not create a closed design that makes mixed blocks impossible.

---

# 17. BUILD ON CURRENT TEXT-BLOCK RECONSTRUCTION

`pdf-layout.js` already reconstructs:
- source runs,
- lines,
- text blocks,
- flow regions,
- reading order.

Reuse this.

Do not invent a second unrelated text-grouping engine.

The existing derived text block should be a natural foundation for the future "Grab Text Block".

Important:
- mathematical grouping does NOT require adding a DOM wrapper around every block,
- do not put giant visible boxes around all text,
- derived structure can remain invisible until a user explicitly grabs/selects a block later.

---

# 18. IMAGE BLOCKS

Plan the same abstraction for images.

A single inserted image may be a one-member Image Block.

Later:
- several images could be grouped,
- image + caption may be grouped,
- image + nearby text may become mixed content.

Use the same union-bounds system.

---

# 19. MIXED CONTENT BLOCKS

The architecture must support a group containing:

- text,
- image,
- caption,
- additional text,

while preserving internal positions.

The system should eventually be able to move that structure as one unit.

Do not implement final UI now.

But ensure the data model supports it.

---

# 20. GROUP UNION BOUNDS

Every group must expose union bounds in PDF points.

For group members:

```
left   = min(member.x)
bottom = min(member.y)
right  = max(member.x + member.width)
top    = max(member.y + member.height)
```

Group bounds are then used by the same margin constraint engine.

This is the crucial bridge:

`single object -> group envelope -> layout bounds`

---

# 21. MEMBER-RELATIVE GEOMETRY

Preserve each member position relative to the group origin.

Conceptually:

```js
memberLocalRect = memberPdfRect - groupOrigin
```

Then group translation becomes:

```js
newMemberPdfRect = memberLocalRect + newGroupOrigin
```

This makes future whole-block movement deterministic.

Do not move group members by separate ad hoc nudges.

---

# 22. GENERIC GROUP TRANSLATION HELPER

Implement and test a reusable helper even if there is no UI yet.

Conceptually:

```js
translatePdfContentGroup(group, desiredDelta, contentRect)
```

It should:
- calculate requested group bounds,
- clamp group translation to contentRect,
- preserve member-relative offsets,
- return translated member rectangles,
- report whether movement was constrained,
- report overflow if the group cannot fit.

This is required architecture for V21.

---

# 23. FUTURE MARGIN + GROUP RELATIONSHIP

The intended future behavior is:

1. user right-clicks meaningful text/image/mixed content
2. chooses Grab Text Block / Grab Image Block / Grab Content Block
3. Substrate materializes the derived group as interactive
4. user drags whole group
5. margin engine constrains the group envelope
6. member geometry remains internally intact
7. later reflow rules may intelligently adapt surrounding content

V21 does NOT need to implement steps 1–4 as UI.

But the math and data structures should already make step 5 possible.

---

# 24. OWNERSHIP VS MEMBERSHIP

Keep relationships explicit.

A text run may simultaneously:
- semantically belong to a paragraph,
- visually belong to a text block,
- spatially belong to a movable content group,
- be owned by an edit object.

Do not overload one `parentId` to mean everything if that becomes ambiguous.

Prefer explicit fields such as:
- semanticParentId
- layoutGroupId
- ownerEditId
- sourceObjectId

This matters for agents later.

---

# 25. AGENT-READABLE STRUCTURE

Diagnostics must be able to answer questions such as:

- What are the current margins?
- What is the contentRect?
- Is object X inside the contentRect?
- Which edge is violated?
- What delta would move it inside?
- Which group owns this object?
- What are this group's bounds?
- Which members belong to the group?
- What member-relative offsets would be preserved during movement?
- Would this group fit inside the margins?
- Did guide visibility change page origin?
- Did margin dragging move the canvas or text layer?

The goal is:

> if a human can see that something crosses the margin, an agent should be able to measure exactly how and why.

---

# 26. DIAGNOSTICS

Extend PDF diagnostics with:

```
marginGuidesVisible
marginConstraintsEnabled
pdfMargins
contentRect
projectedGuides
activeGuideDrag
layoutViolations
contentGroups
```

Add specific issue codes as appropriate, for example:

- PDF_EDIT_OUTSIDE_LAYOUT_BOUNDS
- PDF_IMAGE_OUTSIDE_LAYOUT_BOUNDS
- PDF_CONTENT_GROUP_OUTSIDE_LAYOUT_BOUNDS
- PDF_MARGIN_GUIDE_PROJECTION_MISMATCH
- PDF_MARGIN_TOGGLE_CHANGED_PAGE_ORIGIN
- PDF_MARGIN_DRAG_CHANGED_PAGE_ORIGIN
- PDF_MARGIN_RECONCILIATION_OVERFLOW

Use exact names that fit existing conventions.

Avoid vague generic warnings when a specific invariant is known.

---

# 27. PAGE-ORIGIN INVARIANT

Margins must not physically move the page.

Capture geometry fingerprints:

- before Margins ON
- after Margins ON
- after Margins OFF
- during drag
- after drag

The canvas and text layer should remain aligned.

Toolbar rows must remain exactly stable.

No page jump.

No hidden layout reflow merely from showing guides.

---

# 28. SCROLL / ZOOM / FIT

Test with guides visible at:

- 50%
- 100%
- 125%
- 200%

Also:
- Fit Page
- Fit Width
- Actual Size
- scroll within the PDF frame

Canonical margin values must remain identical in PDF points.

Only their viewport projection changes.

The guide lines must remain attached to the page rather than to the screen.

---

# 29. ROTATION

If page rotation is supported:
- margin projection must honor it.

Left/right/top/bottom remain defined in page-space and project through the page transform.

If full drag semantics under rotation are too risky:
- preserve/render margins correctly,
- disable drag only for unsupported rotated cases,
- expose a clear limitation,
- test it.

Prefer complete support if existing geometry helpers make it practical.

---

# 30. RESET

Provide a small reset path:

"Reset Margins"

Possible locations:
- More menu,
- context menu,
- small attached margin control.

Do not add four numeric inputs to the main toolbar in V21.

Reset returns to:
- 36pt each side.

---

# 31. FUTURE SETTINGS HOOK

Do not need a full Settings UI now.

But create a clean API/state hook for future:

`Keep PDF edits inside margins [ ON / OFF ]`

Default:
ON.

When future setting becomes OFF:
- guide rendering is unaffected,
- no automatic clamping occurs,
- diagnostics can still report violations.

This separation must already exist in V21.

---

# 32. TESTS — PURE MARGIN MATH

Add tests for:
- default normalization,
- contentRect derivation,
- page too small,
- minimum usable width,
- minimum usable height,
- left/right guide collision prevention,
- top/bottom guide collision prevention,
- inside rect,
- touching boundary accepted,
- crossing left,
- crossing right,
- crossing top,
- crossing bottom,
- diagonal violation,
- oversized object overflow.

---

# 33. TESTS — OBJECT CONTAINMENT

Test:
- free text created outside -> translated inside,
- replacement field moved left -> clamped,
- replacement field moved right -> clamped,
- image moved bottom -> clamped,
- image resized against margin -> clamped,
- duplicate object starts legal,
- margin dragged inward -> existing editable box reconciled inward.

Ensure:
- font size unchanged,
- image aspect ratio not distorted,
- internal object data not lost.

---

# 34. TESTS — CONTENT GROUP ARCHITECTURE

Required even before UI exists.

Test:
- reconstructed text group bounds,
- one-image group bounds,
- multi-image group union,
- mixed text+image group union,
- stable group ID from stable members,
- member local rectangles,
- whole-group translation,
- clamp group translation against margins,
- member-relative geometry unchanged after move,
- overflow when group larger than contentRect.

---

# 35. TESTS — TOOLBAR

Test:
- Margins control exists once,
- exactly three toolbar rows,
- repeated enhancement does not duplicate Margins,
- ON/OFF label changes,
- aria-pressed changes,
- toolbar height remains stable,
- page origin remains stable.

---

# 36. TESTS — POINTER SAFETY

Test:
- guide canvas/layer pointer-transparent,
- guide handle pointer-active,
- native text hover still resolves,
- native text click still resolves,
- replacement text click still resolves,
- double-click edit still resolves,
- guide drag does not activate text editing,
- guide visible near text does not steal click outside handle lane.

---

# 37. TESTS — PERSISTENCE

Test:
- change margins,
- rerender,
- change page,
- return,
- change zoom,
- Fit Page,
- Fit Width,
- restore workspace state,

and verify PDF-point margins are unchanged.

---

# 38. TESTS — LIVE/SAVE PARITY

For:
- replacement text,
- free text,
- inserted image,

place each against a margin.

Verify:
- live geometry is legal,
- serialized geometry matches,
- reopened Substrate state matches.

---

# 39. EXISTING REGRESSION SUITE

Run relevant focused suites first:
- PDF diagnostics
- reader chrome
- semantic layout
- terminal masks
- content copy
- save/reopen
- geometry
- editing

Then run:

`node --test tests/*.test.mjs`

Run syntax checks on changed JS/MJS files.

Do not claim browser visual verification if unavailable.

---

# 40. ACCEPTANCE SCENARIO — TURN MARGINS ON

1. Open PDF.
2. Click Margins [ OFF ] -> ON.
3. Four subtle dashed guides appear.
4. Page does not move.
5. Text hover remains correct.
6. Double-click edit remains correct.
7. Toolbar remains three rows.
8. Click OFF.
9. Guides disappear.
10. Constraint rules remain active.

Pass only if geometry does not jump.

---

# 41. ACCEPTANCE SCENARIO — "ALL EDITABLE BOXES INSIDE"

1. Open PDF with several existing Substrate edits.
2. Turn margin guides on.
3. Drag left margin inward.
4. Any editable fields now crossing the boundary are translated inward if they fit.
5. Inserted images crossing the boundary are translated inward if they fit.
6. Native untouched PDF source content is not rewritten.
7. Any object too large to fit is reported as overflow.
8. Save.
9. Reopen.
10. Legal positions remain stable.

---

# 42. ACCEPTANCE SCENARIO — HIDDEN GUIDES

1. Margins are configured.
2. Turn Margins OFF.
3. Add a free text field near the page edge.
4. It is still placed within contentRect.
5. Move it toward the page edge.
6. Movement stops at invisible margin boundary.
7. Turn guides ON.
8. The object is sitting exactly on/inside the line.

This proves visibility and enforcement are separate.

---

# 43. ACCEPTANCE SCENARIO — FUTURE GROUP MATH

No user-facing Grab command required yet.

In tests:
1. construct a Text Block
2. construct an Image Block
3. construct a mixed Content Block
4. translate each as a whole
5. clamp against contentRect
6. verify member-relative positions remain unchanged

This scenario is mandatory.

It proves V21 is the foundation for future block manipulation rather than another local margin patch.

---

# 44. NON-GOALS

Do not:
- reintroduce the old broken margin overlay,
- add CropBox editing,
- add DOCX margins,
- add WEBX UI,
- add giant rulers,
- add arbitrary grid snapping,
- implement final Grab Text Block / Grab Image Block / Grab Content Block UI unless it is obviously trivial and safe,
- rewrite untouched native PDF source content solely to satisfy margins,
- shrink fonts automatically,
- crop images silently,
- serialize browser client coordinates,
- add another toolbar row,
- break current hover authority,
- break Enter-to-finish,
- break Copy,
- break save/reopen parity.

---

# 45. ARCHITECTURAL LAWS

## Law 1
Margins are document/editor geometry, not decoration.

## Law 2
Guide visibility and constraint enforcement are separate states.

## Law 3
Constraints are ON by default.

## Law 4
All editable Substrate boxes are contained inside the active content bounds by default.

## Law 5
Untouched historical/native PDF content is not rewritten merely because authoring margins exist.

## Law 6
PDF points are authoritative for persisted PDF layout.

## Law 7
Browser coordinates are projections only.

## Law 8
An object may touch a margin line but may not cross it while constraints are ON.

## Law 9
Never silently shrink text to make geometry fit.

## Law 10
Never silently crop or distort an image to make it fit.

## Law 11
A Content Block may exist mathematically even when no block outline is visible.

## Law 12
Text Blocks, Image Blocks, and future mixed Content Blocks use the same generic group-bounds architecture.

## Law 13
Moving a group preserves member-relative geometry unless explicit reflow says otherwise.

## Law 14
The same layout-bounds primitive must constrain one field, one image, or an entire content group.

## Law 15
The guide layer must never become a page-sized pointer trap.

## Law 16
Live geometry and saved geometry must tell the same story.

## Law 17
Every meaningful visual boundary and group relationship should be measurable by diagnostics.

---

# 46. FUTURE INTENT THIS RUN MUST ENABLE

After V21, future runs should be able to add without rewriting the foundation:

- Right-click -> Grab Text Block
- Right-click -> Grab Image Block
- Right-click -> Grab Content Block
- move a whole text/image cluster
- move mixed image+text compositions while preserving internal relationships
- margin-aware block movement
- image/text reflow
- paragraph/container reflow
- columns
- professional page layout presets
- agent-driven document cleanup
- agent-readable layout corrections
- WEBX -> PDF layout compilation
- PDF -> WEBX inferred container reconstruction

The immediate feature is margins.

The strategic deliverable is a predictable document geometry system.

---

# 47. FINAL SUCCESS DEFINITION

This run is successful when:

- the user can turn margin guides ON/OFF,
- the four guides are tasteful and draggable,
- the guides never break PDF interaction,
- margins live in PDF points,
- all editable boxes remain inside them by default,
- turning guides OFF does not disable enforcement,
- future Settings can disable enforcement without redesign,
- margin changes reconcile existing editable geometry,
- toolbar remains exactly stable,
- save/reopen remains truthful,
- diagnostics can explain every margin relationship,
- and the codebase now has reusable content-group mathematics for future Text Block / Image Block / mixed Content Block movement.

Do not optimize for the smallest patch.

Optimize for a framework we can build on for the next several stages of Substrate.

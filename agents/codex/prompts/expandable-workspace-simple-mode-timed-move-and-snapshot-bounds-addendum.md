# Addendum: expandable spatial workspace, Simple-mode menu cleanup, and exact snapshot bounds

Read this **together with**:

```text
agents/codex/prompts/document-image-drop-direct-manipulation-fcx-persistence-correctness.md
```

This addendum is part of the **same next Codex run**. Work from current `main`; do not revive superseded PR #46 and do not blindly merge stale/conflicted PR #42.

FrameChute's spatial law remains:

> The viewport moves. The artwork does not.

And the new workspace rule is:

> Push an object toward an edge and FrameChute makes more desk.

Do not interpret the current viewport as a hard box that every FrameChute object must remain inside.

---

# 1. Simple / non-Advanced mode: remove timed-move commands entirely

In **Simple mode**, the object right-click/context menu must NOT show any of these entries:

```text
Create Timed Move
Preview Timed Move
Return to Move Start
Remove Timed Move
```

Requirements:

- These commands are **Advanced-only**.
- In Simple mode they should be absent/hidden, not merely disabled.
- Hide any equivalent timing/sync wording that leaks through alternate object menus or menu rebuilding paths.
- Advanced mode keeps the existing behavior.
- Switching Simple ↔ Advanced must update the menu correctly without stale entries.
- Add/adjust focused tests asserting these commands are absent in Simple and present when appropriate in Advanced.

This continues the existing product rule that timing/sync controls do not belong in the simple everyday interface.

---

# 2. Take Snapshot: bounds come from the farthest object edges, never from the viewport

`Take Snapshot` is a composition capture, not a screenshot of whatever happens to be visible on screen.

For the current workspace-wide snapshot, compute the source rectangle from the **union of the included visible FrameChute objects**:

```text
left   = farthest included object edge to the left
right  = farthest included object edge to the right
top    = farthest included object edge upward
bottom = farthest included object edge downward
```

Then apply the configured/default snapshot padding around that union.

In other words, if only a few objects occupy a huge workspace, the exported image should be a box around those few objects, determined by their outermost edges. Empty workspace between those outermost objects remains part of the composition. Empty workspace outside that union does not.

Example:

```text
          [ A ]


                         [ B ]

      [ C ]

Snapshot bounds = one rectangle from the leftmost/topmost/rightmost/bottommost
visible edges of A/B/C, plus snapshot padding.
```

Requirements:

- Do **not** use viewport size/scroll position as the snapshot rectangle.
- Objects may be partially or fully outside the current viewport and still count.
- Negative/world-left and world-top objects must count.
- Hidden/non-visible objects should not count unless an explicit future option says otherwise.
- Preserve z-order.
- Do not stretch/reposition the actual composition merely to fit the snapshot.
- `Tight Bounds` = the padded union described above.
- `Square` = begin from that same Tight Bounds rectangle, then expand only the shorter dimension symmetrically until width == height. Never distort or stretch the objects.
- If a future/selection-specific FrameSnap captures only selected objects, use the **same union rule over the selected set**.

Add regression tests for distant objects, negative coordinates, hidden objects, viewport independence, Tight Bounds, and Square centering.

---

# 3. Expandable workspace: dragging against an edge creates more spatial canvas

The workspace must be able to grow beyond its current bounds through direct manipulation.

Current mental model to eliminate:

```text
object approaches/crosses workspace edge
→ clamp/rescue/push object back into reachable viewport
```

Required mental model:

```text
object approaches/crosses workspace edge during an intentional drag
→ create more workspace in that direction
→ object remains where the user is putting it
→ user can later scroll back to that area
```

Support all four directions:

```text
↑ create space above
← create space left
→ create space right
↓ create space below
```

This must work for ordinary FrameChute workspace objects, including images, video, PDF, DOCX, notes, canvases, etc.

## Edge expansion gesture

V1 behavior:

- Only an **active, intentional object move/drag** should create new space.
- When the dragged object/pointer reaches a small edge expansion zone near the current scrollable workspace edge, grow the spatial canvas in that direction.
- Use a sensible bounded chunk such as roughly half to one viewport per expansion step; exact amount may be tuned.
- Continuing to push against the edge can create another chunk.
- A subtle edge affordance is acceptable, but do not show the global file-ingestion overlay.
- Expansion should feel continuous/direct, not modal.

Do NOT expand because of:

```text
window resize
ordinary scrolling
toolbar wrap/resize
opening a menu
PDF rerender
media metadata changes
passive ResizeObserver/MutationObserver activity
workspace restore
```

Only user-directed spatial movement should request new space.

---

# 4. Left/top growth must not move the artwork

Right/bottom growth is straightforward because browser scroll space naturally extends positively. Left/top growth requires an origin strategy or equivalent.

Do **not** fake left/top expansion by rewriting every object's semantic position as though the artwork moved.

Preferred conceptual model:

```text
object world position = stable
workspace origin       = movable implementation detail
scroll position        = viewport into that world
```

If prepending space on the left/top requires shifting the DOM/canvas origin, compensate the scroll position so the user's view does not jump.

Conceptually:

```text
prepend 800 px to left
→ world/origin representation gains 800 px
→ scrollLeft compensates by +800 px
→ visible scene remains stationary
→ object world coordinates remain semantically unchanged
```

Equivalent architectures are acceptable, but these invariants are mandatory:

- No visual jump when space is prepended.
- Existing artwork does not drift.
- Relative object distances remain identical.
- Passive viewport changes never mutate object placement.
- Workspace save/restore preserves the expanded spatial arrangement.
- `.fcx` round-trip preserves objects located in extended left/top/right/bottom regions.
- `Take Snapshot` sees the actual occupied world bounds, not only the original/default canvas rectangle.

---

# 5. Retire reachability clamping that contradicts intentional edge expansion

Audit `src/offscreen-rescue.js` and any other reachability helpers.

The old direct-gesture rescue of negative workspace coordinates (for example `MIN_GRAB_LEFT` / `MIN_GRAB_TOP` style clamping) conflicts with intentional creation of workspace to the left/top.

New rule:

> If the user intentionally moves an object there, that location becomes valid workspace.

Therefore:

- Do not clamp an intentionally moved object back to a fixed minimum left/top coordinate.
- Do not rewrite object x/y merely because it is outside the current viewport.
- Keep `Bring to Center` as the explicit user-requested recovery command.
- Keep scrollable reachability by growing/prepending workspace rather than moving the object.
- If an object is restored from state at a far coordinate, make that area reachable without silently relocating it.

Be careful not to regress the previously fixed spatial-permanence behavior.

---

# 6. Interaction with drag-overlay/document work in the main prompt

This addendum and the document-image correctness prompt must use one coherent drag-ownership model.

Examples:

```text
move existing workspace object toward edge
→ expandable workspace logic
→ NO global ingest overlay

move image already inside PDF/DOCX
→ document-image move logic
→ NO global ingest overlay
→ do not expand outer workspace merely because the inner image reaches a PDF/DOCX page edge

external OS image dragged over PDF/DOCX
→ document owns eligible drop
→ NO global workspace overlay

external OS file dragged over empty workspace
→ ordinary ingest overlay may appear
```

Do not confuse pointer-driven object movement with native/external drag-and-drop.

---

# 7. Persistence and coordinate model

Any new origin/extents state required by expandable workspace must survive:

- ordinary local workspace save/restore,
- `.fcx` Export Workspace / Open Workspace,
- Include Files and State Only modes,
- object duplication/capture paths where relevant.

The user's mental model is still:

> Everything just as it was.

A workspace reopened after expansion must restore objects in the same apparent world locations and preserve the ability to scroll to them.

Do not bake viewport scroll position into object coordinates.

---

# 8. Tests / acceptance

Add focused pure helpers where practical for workspace extent/origin math so this is testable without full browser automation.

Minimum automated coverage should include:

```text
1. Simple mode omits all four timed-move commands.
2. Advanced mode retains timed-move commands when applicable.
3. Snapshot Tight Bounds uses union of farthest visible object edges + padding.
4. Snapshot bounds are independent of viewport size/scroll position.
5. Snapshot includes objects in negative/extended coordinates.
6. Square framing symmetrically expands the Tight Bounds union without distortion.
7. Right/bottom edge expansion grows extent without moving existing objects.
8. Left/top prepend math compensates origin/scroll without changing semantic object coordinates.
9. Passive resize/scroll does not trigger expansion or rewrite coordinates.
10. FCX/local persistence round-trips expanded workspace origin/extents and far-away objects.
11. Internal object dragging does not activate the external ingest overlay.
```

Manual browser smoke test:

```text
A. Place an image near the center. Drag it continuously right past the old edge.
   → more workspace appears; image is not forced back.

B. Scroll right.
   → image remains where it was dropped.

C. Repeat downward.
   → more workspace appears below.

D. Repeat left and upward.
   → more workspace is created with no scene jump and no object clamping.

E. Resize browser window / wrap toolbar / scroll normally.
   → no artwork movement and no new workspace creation.

F. Save/export workspace, reopen it.
   → far-away objects and expanded spatial layout survive.

G. Take Snapshot with several objects spread around the expanded workspace.
   → image bounds are exactly the outermost object-edge union + padding, not viewport bounds.

H. Switch to Simple mode and right-click an eligible object.
   → Create/Preview/Return/Remove Timed Move are absent.
```

---

# 9. Preserve current good behavior

Do not regress any requirements in the main document-image/FCX correctness prompt, including:

- PDF ghost-text fix,
- PDF/DOCX image drop ownership,
- document image move/resize,
- document image Ctrl/Cmd+Z and redo,
- FCX local-image Include Files persistence,
- PDF/DOCX Save/Save As,
- PR #47 toolbar/workspace/snapshot behavior,
- Tight Bounds / Square snapshot semantics,
- Quick Actions close semantics,
- frameless media,
- external file/URL ingestion,
- explicit `Bring to Center`.

---

# 10. Timebox / handoff

Use up to 30 minutes.

At the 30-minute mark, **conclude active implementation and provide a handoff**.

Handoff must include:

```text
completed
remaining
files changed
tests/results
known issues/risks
exact next steps
branch/commit/PR
```

Prefer one coherent PR for this run. If the expandable-workspace work proves too architectural to complete safely inside the timebox, preserve a clean tested boundary: finish the correctness items first, implement testable extent/origin primitives, and hand off the remaining browser interaction work precisely rather than landing a half-working clamp/origin system.

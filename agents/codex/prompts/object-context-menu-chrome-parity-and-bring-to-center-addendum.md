# Codex Addendum: Object context-menu chrome parity + Bring to Center

## Authority / correction

This addendum corrects and supersedes **Section 5** of:

`agents/codex/prompts/compact-pdf-footer-context-menu-parity-and-image-zip-export.md`

The earlier request incorrectly interpreted “top header” as FrameChute's global/main application toolbar.

That is NOT the intended behavior.

Do **not** add a large `Workspace` submenu containing Save FrameChute / Restore / Reconnect All / Export Snapshot / Open Snapshot / etc. to every object context menu.

The global/main toolbar is already represented well enough by the existing `Open File…` object-menu affordance for this pass.

The intended parity is with the **individual FrameChute object's own header/chrome**.

Use latest `main` as source of truth.

---

# Product rule

> Right-click an object and get the obvious controls for THAT object, even when its header/footer is hidden.

The context menu should be a reliable alternate control surface for object chrome, not a second global application toolbar.

---

# 1. Core object controls in right-click menu

For every ordinary FrameChute object where the action makes sense, expose a compact high-priority object-control group near the top of the context menu:

```text
Quick Actions  [ ON / OFF ]
Open File…                 (when supported)

Minimize
Expand / Restore Size
Bring to Center
Grab / Move Object
Close Object
```

Exact separators/order may be adjusted slightly to match current menu conventions, but keep these actions obvious and near the top before specialist utilities.

Do not make users restore a hidden object header merely to expand, shrink, move, or close an object.

---

# 2. Reuse existing object-header behavior

Do NOT implement duplicate maximize/close logic.

The visible object header already has behavior for:

- maximize / restore geometry
- close/remove object

The context-menu actions must call the same underlying command/function/path as the visible header controls so behavior stays identical.

If necessary, refactor the current private helpers into shared object commands rather than synthesizing button clicks in multiple places.

Expected equivalence:

```text
object header Expand == right-click Expand
object header Close  == right-click Close Object
existing Grab        == right-click Grab / Move Object
```

Preserve dirty-document confirmation and resource cleanup when closing PDF/DOCX/etc.

---

# 3. Minimize semantics

Add a simple explicit object `Minimize` action.

For this pass, Minimize means:

- leave the object at its current location;
- leave its content usable/visible;
- exit maximized state if necessary;
- resize the outer object frame to a compact **400 × 400 px** target;
- bring no unrelated object forward or move unrelated artwork;
- do not discard edits/state;
- do not confuse this with hiding/closing the object.

If an existing CSS `min-width` / `min-height` prevents the explicit 400 × 400 action for an object type, adjust the compact/minimized state so the requested outer size can be represented unless there is a genuine technical reason not to.

This is an EXPLICIT geometry action, so it is allowed to resize the object. It must not create passive viewport-reachability movement.

---

# 4. Expand / Restore Size

`Expand` should use the same maximize behavior as the object's visible maximize control.

Prefer a dynamic label:

```text
Expand
```

when the object is not maximized, and:

```text
Restore Size
```

when the object is currently maximized.

Restoring must return to the stored prior geometry exactly as the visible header maximize toggle already intends.

Do not create an independent fullscreen implementation.

---

# 5. Bring to Center

Add a new obvious context-menu command:

```text
Bring to Center
```

This is intentionally more than z-order `Bring to front`.

Required behavior:

1. exit maximized state cleanly if necessary;
2. resize the target object's outer frame to **400 × 400 px**;
3. place that 400 × 400 object in the center of the user's CURRENT VISIBLE FrameChute workspace/viewport;
4. account for the visible top toolbar/workspace usable area so “center” looks visually centered in the work area, not underneath chrome;
5. bring the target object to the front;
6. preserve its document/media/object state and edits;
7. do not move any other workspace object.

Conceptually:

```text
Right-click object
      ↓
Bring to Center
      ↓
400 × 400
center of visible workspace
frontmost object
```

This is an explicit user command and therefore does NOT violate the spatial permanence rule.

The spatial rule remains:

> The viewport moves. The artwork does not — unless the user explicitly commands the artwork to move.

Do not reuse or reintroduce passive offscreen-rescue/reachability clamping to implement this.

---

# 6. Quick Actions [ON/OFF]

Keep an obvious:

```text
Quick Actions  [ ON ]
```

or

```text
Quick Actions  [ OFF ]
```

entry in the object right-click menu.

This is the global Quick Actions state indicator/toggle unless the current reconciled architecture already has a more specific global/per-object model on latest `main`.

Rules:

- label always reflects the actual current state;
- clicking toggles the same canonical Quick Actions preference used elsewhere;
- do not create a second preference key;
- do not confuse this toggle with the new little `×` on the Quick Actions panel;
- `×` only hides the floating panel;
- `Clear` only clears the current Quick Actions selection;
- preserve any existing per-object Quick Actions override behavior if present on latest `main`.

The current object-menu model already exposes a global `Quick Actions [ON/OFF]` entry; reuse that behavior rather than replacing it.

---

# 7. Timing / Sync rule remains unchanged

The parent request's Advanced-mode rule still applies exactly.

In Simple / non-Advanced mode, DO NOT show:

- Sync with…
- Make independent when it is part of sync behavior
- Create/Edit/Preview timed move
- Return to timed-move start
- Remove timed move
- Layer timing…
- timing/sync separators

Those appear only in Advanced mode.

The ordinary object controls from this addendum — Minimize, Expand/Restore Size, Bring to Center, Grab, Close, Quick Actions — remain available in Simple mode.

---

# 8. Preserve object-specific actions

After the small common object-control group, retain applicable object-specific commands:

- image editing / resize / crop / convert / copy / Save As
- PDF utilities
- DOCX utilities
- media controls
- frameless/header/footer controls
- Bring to front / Send to back
- other current type-specific actions

Do not flatten every specialist command into the first screen of the menu.

Common object chrome first; type-specific capability after it.

---

# Acceptance cases

1. Right-click an ordinary image -> Quick Actions state, Minimize, Expand, Bring to Center, Grab, Close are immediately reachable.
2. Right-click PDF/DOCX -> same core controls are available and Close preserves dirty-document confirmation.
3. Minimize a large object -> it becomes 400 × 400 in place and remains usable.
4. Expand it -> same behavior as its header maximize control.
5. Restore Size -> prior geometry returns correctly.
6. Put an object far from screen center, invoke Bring to Center -> it becomes 400 × 400, visibly centered in the current workspace viewport, and frontmost.
7. Other objects do not move.
8. Hide an object's header/footer -> right-click still provides the object controls.
9. Toggle Quick Actions from right-click -> canonical state and label update everywhere.
10. Close the Quick Actions floating panel with its `×` -> global Quick Actions preference is unchanged.
11. Simple mode -> zero timing/sync items.
12. Advanced mode -> timing/sync items return where applicable.

---

# Time box / handoff

Use up to 30 minutes.

Treat this addendum as part of the same compact interaction pass. Prefer shared object command paths and a coherent menu over unrelated refactoring.

At the 30-minute mark, conclude active implementation and provide a handoff containing:

- completed work
- remaining work
- files changed
- tests run and exact results
- manual browser checks performed
- known issues / risks
- exact next steps
- branch / commit / PR state

Leave the repository coherent and buildable.

Open one clean PR against latest `main` if the result is reviewable.

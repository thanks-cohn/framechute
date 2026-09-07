# NEXT RUN — document editor contexts + strict Simple-mode/chrome cleanup (V2)

This file is the **authoritative next-run starter**.

First read and execute the full base specification:

`agents/codex/prompts/NEXT_RUN_DOCUMENT_CONTEXT_MENUS_REGION_OBJECTS_AND_SNAPSHOT_SAVE_AS.md`

Then apply every mandatory override/invariant below. If anything in older prompts, current behavior, or existing code conflicts with this V2, **V2 wins**.

Work from current `main`. Use up to 30 minutes. Optimize for reusable primitives and future work eliminated, not isolated button count. At the 30-minute mark, **conclude active implementation and provide a handoff**.

---

# P0 — Quick Actions must have a small red × in the top-right, never Clear

This has been requested repeatedly and is a hard invariant.

Current `main` still constructs Quick Actions with a bottom `Clear` button wired to `selection.clear()`. Remove that behavior completely.

Required shape:

```text
┌──────────────────────────────┐
│ Quick Actions            ×   │
│                              │
│ [ actions … ]                │
└──────────────────────────────┘
```

Requirements:

- small red `×` in the upper-right of the Quick Actions header/panel;
- **no Clear button anywhere**;
- clicking `×` hides/closes the Quick Actions panel only;
- clicking `×` does **not** clear selection;
- clicking `×` does **not** alter the global Quick Actions ON/OFF preference;
- reopening Quick Actions preserves current selection unless another explicit action changed it;
- Quick Actions remains application chrome, not artwork; workspace zoom and object movement must not affect its layout;
- opening/closing/moving Quick Actions must never move workspace objects.

Prefer a real `.quick-actions-close` control; do not retain `.quick-actions-clear` and merely rename it.

Acceptance:

```text
select object
→ Quick Actions appears
→ click red ×
→ panel disappears
→ object remains selected
→ reopen panel
→ selection still exists
```

---

# P0 — Simple mode must be actually simple

When Advanced mode is OFF, the generic object context menu must **not contain** any of these items:

```text
Show image only
Create timed move
Preview timed move
Return to move start
Remove timed move
Layer timing…
```

Do not merely disable or gray them out. They should be absent/hidden in Simple mode.

The timed-motion commands belong to Advanced mode only.

`Show image only` is also not part of Simple mode. Keep it Advanced-only if the capability remains.

This rule applies consistently to all generic object-menu rendering paths, not just one menu implementation.

---

# P0 — Sync / Make independent are video-only

These items:

```text
Sync with…
Make independent
```

must appear **only for actual playable video/media objects that support the synchronization model**.

Do not show them for:

- images;
- PDFs;
- DOCX;
- text;
- static SVG/image-like objects;
- generic files;
- non-playable objects.

Prefer capability-based gating such as `supportsMediaSync` / playable timed-media detection rather than broad `if block exists` logic.

If audio is intentionally supported by the existing synchronization model, it may share the same timed-media capability; otherwise restrict V1 to video. The user-facing rule is that ordinary non-video objects must never see these commands.

---

# P0 — restoring a removed/frameless frame must never mash the header

Reported bug:

```text
remove/hide frame or object chrome
→ rename object while frameless / altered chrome state
→ restore frame/header
→ top header returns visually mangled/mismatched
```

Treat this as a state-normalization bug, not a CSS patch.

Required invariant:

> Frame visibility is presentation state. Renaming and restoring chrome must not reconstruct or duplicate header DOM.

Audit the current `is-frameless-media`, `show-object-header`, `hide-object-header`, footer/chrome classes, block name input, and restore paths.

Requirements:

- one canonical header DOM subtree per object;
- frameless/hide/show state changes visibility/layout only;
- rename updates the existing canonical `.block-name` value/model;
- restoring the frame/header reveals the same header, not a cloned/rebuilt competing header;
- no duplicate title inputs, action buttons, drag handles, or conflicting header classes;
- restored header spacing and action alignment match a freshly created framed object;
- repeated cycles remain stable:

```text
frameless → rename → restore → frameless → restore
```

must not progressively corrupt the header.

Add a focused DOM/state test if practical.

---

# P0 — generic right-click menu needs real pop-out submenus

The generic context menu has become repetitive because many commands begin with the same verb. Introduce reusable nested/pop-out submenus rather than a long flat list.

Core menu model should support something like:

```text
item
submenu
separator
enabled/hidden
applicability
handler
```

At minimum group recurring command families such as:

```text
Open ›
Preview ›
Show ›
Arrange ›
```

Example direction, adapt to actual supported actions:

```text
Open ›
  Open File…
  Open Workspace…
  Open externally…        (only if actually supported)

Preview ›
  Preview timed move       (Advanced + timed-capable only)
  other honest preview actions

Show ›
  Show top bar
  Show Settings
  Show media player
  Show header/footer       (only when relevant)
  Show image only          (Advanced-only)

Arrange ›
  Bring to front
  Send to back
  Bring to Center
  Expand / Restore Size
```

Important rules:

- do not bury critical immediate actions that should remain top-level, such as Grab / Move Object and Close Object;
- submenu hover must also work by click/focus/keyboard;
- submenus must be viewport-aware and flip direction when near the edge;
- Escape closes the deepest submenu first, then the root menu;
- ArrowRight opens submenu, ArrowLeft returns to parent where practical;
- no accidental selection loss while navigating submenus;
- editor-specific PDF/DOCX menus from the base prompt remain separate and should use the same reusable submenu primitive where appropriate.

This should replace repeated giant HTML strings with a declarative command/menu model where practical.

---

# P0 — keep document-specific context routing dominant inside editors

The base prompt remains authoritative here:

```text
right-click inside PDF page/editor
→ PDF-specific editing menu

right-click inside DOCX editor
→ DOCX-specific formatting menu

right-click document chrome/header
→ generic FrameChute object menu
```

The new generic `Open › / Preview › / Show › / Arrange ›` submenus must **not leak into PDF/DOCX editor surfaces**.

Inside PDF, prioritize text/text-field/image/region modification commands.
Inside DOCX, prioritize formatting/document/image commands.

---

# P0 — preserve Snapshot Save As location picker requirement

The base prompt requirement remains mandatory:

```text
Take Snapshot
→ configure
→ Save Snapshot
→ native Save As location picker when available
→ fallback browser download only when picker is unavailable
```

Cancellation is not an error.

---

# Tests / acceptance additions

Add focused coverage where practical for:

1. Quick Actions red × hides panel without clearing selection or global preference;
2. no `.quick-actions-clear` control remains;
3. Simple mode generic menu omits Show image only and all timed-motion commands;
4. Sync / Make independent absent for image/PDF/DOCX/text and present only for supported playable media;
5. frameless → rename → restore keeps one canonical header with correct title/actions;
6. repeated frameless/restore cycles do not duplicate/mangle header chrome;
7. generic menu submenu grouping resolves correct commands and applicability;
8. PDF/DOCX editor right-click still bypasses generic submenu tree;
9. existing base-prompt PDF/DOCX/Snapshot tests remain green.

Manual checks if Chromium is available:

```text
1. Select image → Quick Actions → red × → selection remains.
2. Simple mode image menu: no Show image only, no timed commands.
3. Simple mode PDF/DOCX: no generic timed/sync clutter.
4. Image/PDF/DOCX menu: no Sync / Make independent.
5. Video menu: Sync / Make independent only when actually supported.
6. Make image frameless → rename → restore frame → header looks identical in structure/alignment to fresh object.
7. Repeat frame hide/restore several times → no worsening/mangled header.
8. Open/Preview/Show/Arrange use pop-out submenus and stay inside viewport.
9. Right-click PDF editor → PDF menu, not generic menu.
10. Right-click DOCX editor → DOCX menu, not generic menu.
11. Snapshot Save As location picker still works.
```

---

# 30-minute priority order override

```text
1. editor-context routing from base prompt
2. Quick Actions red × / remove Clear permanently
3. Simple-mode and media-sync applicability cleanup
4. generic declarative submenu primitive + Open/Preview/Show/Arrange grouping
5. PDF-specific menu + field selection/Delete/Add Text Field/top-alignment/font-size popover
6. DOCX-specific formatting menu
7. frameless/header canonical-state bug
8. Snapshot native Save As picker
9. PDF region/quad work if time remains
```

If tradeoffs are necessary, do not sacrifice the first eight items to force advanced quad morphing.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- reusable primitives landed;
- user-visible issues solved;
- remaining thin adapters;
- files changed;
- tests/results;
- manual checks performed/not performed;
- risks/issues;
- exact next highest-leverage root pass;
- branch;
- commit;
- PR.

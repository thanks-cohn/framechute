# NEXT RUN V5 — format-native editors + Undo/Redo + attached submenu geometry

Start from the latest `main`. Read and execute `agents/codex/prompts/NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS_V4.md`, then apply this V5 as the authoritative override. If there is any conflict, V5 wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## P0 — PDF, DOCX, and WEBX each own their own right-click menu

This is a product law, not optional polish.

```text
PDF editor surface  → PDF-specific editing menu
DOCX editor surface → DOCX-specific editing menu
WEBX editor surface → WEBX/LightComp editing menu
```

The generic FrameChute object/workspace menu should only own blank workspace and outer object chrome/header contexts. It must not leak generic workspace actions into the body of a PDF, DOCX, or WEBX editing surface.

Right-click should resolve the location under the pointer and establish the correct temporary/context target without requiring a pre-existing selection.

### PDF minimum standard of workmanship

Bring PDF editing to the ordinary baseline expected from a simple credible PDF editor. Prioritize working primitives over decorative buttons:

- Add Text Field
- edit/replace text
- select/delete field or selected editable object
- Delete/Backspace keyboard deletion
- font selection
- Text Size mini-popover
- move/resize text fields
- duplicate
- insert/move/resize/delete images where supported
- page operations already supported
- Select Region / bounded quad only when it works honestly
- Save
- Save As
- **Undo**
- **Redo**

Do not expose apparently live commands that do nothing.

### DOCX minimum standard of workmanship

Bring DOCX editing to the ordinary baseline expected from a simple word processor:

- editable text
- Bold / Italic / Underline
- font
- text size
- paragraph/alignment/list controls where serialization supports them
- insert images
- delete/replace/resize images where supported
- Cut / Copy / Paste where safe
- Save
- Save As
- **Undo**
- **Redo**

Formatting must survive DOCX serialization and reopen in Word-compatible software. Do not implement DOM-only styling that disappears after save.

### WEBX minimum standard of workmanship

WEBX is edited by LightComp and saved as `.webx`. Its right-click menu should be native to semantic, web-ready composition:

- text/semantic structure actions
- headings/lists/links/code/quotes where supported
- image/asset actions
- web preview/publishing actions where honestly implemented
- Save
- Save As
- **Undo**
- **Redo**

Do not make WEBX pretend to be PDF or DOCX. Keep it centered on semantic content and web-ready composition.

## P0 — Undo and Redo are mandatory editor primitives

Undo/Redo are part of the minimum acceptable workmanship for PDF, DOCX, and WEBX.

Required keyboard behavior:

```text
Ctrl/Cmd+Z       → Undo
Ctrl/Cmd+Shift+Z → Redo
Ctrl+Y           → Redo where appropriate
```

Also expose Undo/Redo in format-specific menus/toolbars where useful for discoverability.

Undo/Redo must operate on canonical document state, not merely DOM appearance. Cover important mutations as applicable:

- text edits
- add/delete text fields
- font/size changes
- image insert/delete/move/resize
- DOCX formatting changes
- WEBX semantic edits
- region/object edits

One coherent user action should normally produce one undo step. Redo must faithfully reapply it.

## P0 — FIX SUBMENU / POPOUT POSITIONING IMMEDIATELY

The current context submenu geometry is unacceptable. When the user opens the main right-click menu and hovers or activates a row such as `Open ›`, the child options can appear far away, sometimes halfway toward the far-right edge of the viewport. The submenu looks detached from the menu that owns it.

This must be fixed before adding more menu depth.

Required visual law:

> **A submenu must appear immediately beside the row that opened it.**

Target behavior:

```text
┌──────────────┐┌─────────────────┐
│ Open       › ││ Open File…      │
│ Arrange    › ││ Open Workspace… │
│ Show       › │└─────────────────┘
└──────────────┘
```

The child menu should have only a small intentional gap from the trigger row, roughly `0–8px`.

### Geometry contract

For a fixed-position context menu, use viewport geometry consistently:

```text
triggerRect = trigger.getBoundingClientRect()
submenuRect = measured child menu bounds

preferredLeft = triggerRect.right + gap
preferredTop  = triggerRect.top
```

If it would overflow the right edge:

```text
left = triggerRect.left - submenuWidth - gap
```

If it would overflow vertically, shift it only enough to remain on-screen while staying visually attached to the trigger/parent menu.

Do **not** mix coordinate spaces such as:

```text
position: fixed
+ parent-local offsetTop
+ stale menu coordinates
+ document/page offsets
```

Do not position child menus relative to the viewport edge or screen center.

This requirement applies to:

- generic FrameChute `Open ›`, `Arrange ›`, `Show ›`, `Preview ›`, etc.;
- PDF-specific submenus such as Font and Text Size;
- DOCX-specific Font/Paragraph/etc.;
- WEBX-specific nested menus.

### Acceptance

1. Right-click around the middle of the viewport, hover/activate `Open ›` → child menu appears directly beside `Open`.
2. Near the right edge → child menu flips to the **left of the parent row**, not to some remote position.
3. Near the bottom → child menu shifts upward only enough to stay visible.
4. The child remains visually attached to its trigger row.
5. No child submenu appears halfway across the screen from its parent.
6. Nested submenu keyboard behavior (`ArrowRight`, `ArrowLeft`, `Escape`) preserves attached geometry and focus.
7. Mouse hover/click behavior must not cause the submenu to jump between unrelated positions.

Prefer extracting one reusable `positionSubmenu(trigger, submenu, options)` helper so all menu systems use the same correct geometry.

## Preserve V4

Everything in V4 remains required, especially:

- LightComp is the editor/system; `.webx` is the portable file format;
- WEBX is a ZIP-like package containing ordinary web primitives such as versioned manifest, HTML, CSS, JavaScript when needed, semantic Markdown/CommonDocument source, and local assets;
- unpacked WEBX should already be suitable for ordinary static web deployment;
- standardization/interoperability direction toward Joplin-like Markdown editors, static-site generators, CMS/publishing tools, browsers, and ordinary web hosts;
- `New → WEBX / DOCX / PDF`;
- `Convert → WEBX / DOCX / PDF` through the shared CommonDocument bridge;
- point-based right-click context without preselection;
- true four-direction canvas expansion with stable world coordinates and no left/top clamp;
- Quick Actions small red top-right `×`, no Clear;
- Simple-mode restrictions;
- video-only `Sync with…` / `Make independent`;
- Snapshot native Save As;
- frameless/header restore idempotence;
- internal-drag ingest-overlay suppression;
- preview/serialization/reopen correctness.

## Tests / validation additions

Add focused tests where practical for:

1. PDF/DOCX/WEBX editor bodies route to three distinct format-native context command sets;
2. generic workspace menu does not leak into those editor bodies;
3. Undo/Redo restores canonical PDF state;
4. Undo/Redo restores canonical DOCX formatting/content state;
5. Undo/Redo restores canonical WEBX semantic state;
6. `positionSubmenu()` keeps a child adjacent to a centered trigger;
7. right-edge placement flips left while remaining adjacent;
8. bottom-edge placement clamps vertically without detaching;
9. no coordinate-space mixing causes remote/half-screen child menus;
10. existing V4 WEBX/spatial/document tests still pass.

Run full `node --test tests/*.test.mjs`, syntax checks for touched JS/MJS, `git diff --check`, and Web Store packaging/release validation.

## Updated 30-minute priority order

```text
1. fix submenu geometry so every popout remains attached to its trigger
2. enforce format-native PDF/DOCX/WEBX context routing
3. Undo/Redo as canonical shared editor history primitive
4. PDF/DOCX minimum-workmanship gaps
5. preserve/fix point-context + true four-direction canvas
6. New → WEBX / DOCX / PDF
7. WEBX package Save/Open + web deployment readiness
8. Convert → WEBX / DOCX / PDF
9. tests + validation
```

At the 30-minute mark, **conclude active implementation and provide a handoff** containing completed primitives, user-visible fixes, format-specific editor status, Undo/Redo coverage, submenu geometry checks, remaining work, files changed, tests/results, manual checks, risks/issues, exact next steps, branch, commit, and PR.

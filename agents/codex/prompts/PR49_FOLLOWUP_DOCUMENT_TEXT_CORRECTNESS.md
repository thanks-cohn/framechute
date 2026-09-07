# PR #49 follow-up — finish the document text primitive before merge

Work on the existing PR #49 branch. Do not start a separate feature branch unless required. Preserve the current deterministic PDF font/layout work; this follow-up exists because the current PR is a useful foundation but is not yet a complete, browser-honest document-text slice.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Goal

Finish one reusable **document text correctness substrate** instead of scattering fixes:

```text
canonical PDF edit object
+ deterministic multiline layout
+ live preview that matches serialization
+ reliable Save / Save As
+ canonical DOCX run formatting
```

The result should make later font, color, style, web-conversion, and Chemium work cheaper.

---

## P0 — PDF multiline preview must actually match saved PDF

PR #49 now stores newlines and serializes them line-by-line, but verify the live editor/render path visibly preserves them after rerender.

Audit `src/workspace.css` and the PDF text-layer CSS. The editable text element must support deterministic whitespace/multiline presentation, e.g. an appropriate `white-space: pre-wrap` / wrapping rule, rather than collapsing `\n` and repeated spaces after rerender.

Required behavior:

```text
edit field to:
hello  world
second line

→ blur/rerender
→ still visibly shows two spaces and the second line
→ Save As
→ reopened PDF matches the same line structure
```

Width remains the wrap boundary. Height is a real field boundary: do not silently paint endless lines outside the field. Choose one honest V1 policy and use it in preview + serialization (clip overflow or constrain line count consistently). Avoid preview/export disagreement.

Keep Enter = newline, Ctrl/Cmd+Enter = commit, Tab = deterministic indentation.

Add focused tests for whitespace/newline preservation and any height/overflow helper you introduce.

---

## P0 — PDF Save / Save As must be verified, not assumed

The larger V4 prompt explicitly called broken PDF Save / Save As a correctness blocker. PR #49 did not change the destination-write path.

Audit the shared document save path:

```text
visible canonical PDF edit state
→ serialize once
→ Save writes current writable handle when available
→ Save As chooses/writes a new target
→ success only after bytes are actually written
```

Requirements:

- Save As from a PDF opened from bytes/download-only must still produce the edited PDF.
- Save must use the current writable handle when available.
- If overwrite cannot happen, report honestly and route/offer Save As; never clear dirty state on a failed write.
- After a successful Save As, the new handle/name should become the current target when the platform supplies one.
- Do not serialize two subtly different versions for save vs save-as.

Add unit-level coverage around the save decision/helper where possible. If browser picker APIs cannot be automated, isolate the decision logic so it is testable and state the manual check required.

---

## PDF text field primitive — complete the thin vertical slice

Do not build a whole PDF editor, but make the canonical edit object capable of representing both replacement text and a newly inserted text field.

Preferred model fields:

```text
kind: replacement | text
page
id/index
x / y
width / height
text/replacement
fontFamily
fontSize
rotation
z/order
source mask fields only when replacing baked PDF text
```

### Add Text Field

Add one straightforward creation route inside PDF context, ideally reusable by the future PDF-specific context menu:

```text
Add Text Field
→ click or drag on current page
→ new editable field appears
→ type multiline text
→ move/resize
→ font + font size controls apply
→ undo removes it
→ redo restores it
→ Save/Save As serializes it
```

Do not give a new text field a source mask because there is no baked source text to cover.

If time is too tight, land the canonical model + creation helper + one toolbar/button route; do not create a second incompatible implementation later.

---

## DOCX underline / formatting round-trip correctness

Fix the reported bug where underline can appear in FrameChute but disappear after saving the DOCX and opening it in Microsoft Word.

The OOXML serializer already knows how to emit underline. The fragile part is DOM → canonical run extraction and combined formatting.

Do not special-case only `<u>`.

Create/refactor a reusable run-format reader so it recognizes inherited/nested formatting from the editable DOM, including at least:

```text
bold
italic
underline
```

It must handle equivalent browser DOM such as:

```html
<u>text</u>
<span style="text-decoration: underline">text</span>
<strong><u>text</u></strong>
<span style="font-weight:700;text-decoration:underline">text</span>
```

Formatting must be combinable, not mutually exclusive. A run may be bold + italic + underline simultaneously.

Canonical run → OOXML must emit all applicable run properties, preserving the least-destructive package path when possible.

Add round-trip tests that inspect/reparse the saved DOCX model/package:

```text
underline only → survives
bold + underline → both survive
italic + underline → both survive
bold + italic + underline → all survive
```

Prefer testing serialized OOXML/reparse behavior rather than merely testing DOM appearance.

This run-format primitive should be designed so later font family, font size, color, strike, and Chemium/DOCX conversion can extend the same model.

---

## Preserve the good part of PR #49

Keep the existing improvements unless a test proves they need adjustment:

- packaged standard PDF font inventory,
- safe font resolver/fallback,
- deterministic line layout,
- embed only fonts actually used,
- font-family UI,
- Enter/newline, Ctrl/Cmd+Enter commit, Tab indentation,
- focused PDF text tests.

Do not broaden this follow-up into camera/zoom, stitching, image editor, Quick Actions, or the entire V4 backlog. Those remain subsequent primitive passes. The point here is to make the **document text primitive genuinely complete enough to merge**.

---

## Validation

Run:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual browser checks if Chromium is available:

```text
1. PDF field Enter visibly survives blur/rerender.
2. Repeated spaces visibly survive rerender.
3. Font + font size preview and saved PDF agree.
4. Save As edited PDF → reopen → edits are present.
5. Save to writable target → reopen → edits are present.
6. Add Text Field → multiline → move/resize → undo/redo → save.
7. DOCX underline → Save As → open in Microsoft Word → underline remains.
8. DOCX bold+italic+underline → all three remain in Word.
```

If Word itself is unavailable in the environment, validate the produced `word/document.xml` and reparse the saved DOCX, and list Microsoft Word verification as a manual user check.

Handoff must include completed, remaining, files changed, tests/results, manual checks or untested items, risks/issues, exact next steps, branch, commit, and PR.
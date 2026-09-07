# PR #49 follow-up — 30-minute document substrate snowball pass

Work on the existing PR #49 branch. Preserve the good deterministic PDF text/font work already in this PR. Do **not** treat the remaining issues as a stack of unrelated tickets.

Use up to 30 minutes. The goal is to solve the **roots** of as many document problems as possible so future requests become thin adapters instead of new systems. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Mission

FrameChute should not need ten more document-fix runs if three carefully chosen substrate passes can do the job.

For this run, concentrate on the reusable document core:

```text
1. one canonical rich-text/run model
2. one canonical PDF edit-object model
3. one shared document Save / Save As contract
4. one reusable document-image geometry model
5. preview == serialization == reopen
```

Prefer one helper/model with several callers over three local patches.

Core law:

> Fix the representation and pipeline once; let many UI features become small projections of it.

Do not spend the 30 minutes making surface polish beautiful while the underlying model is still inconsistent.

---

# PHASE 0 — fast audit, then commit to root causes

Spend only a short initial pass locating the actual data boundaries:

```text
DOM/editor state
→ canonical document model
→ serializer
→ save destination
→ reopen/parser
```

For each bug below, fix the earliest reusable boundary that can prevent the whole class of bug.

Examples:

- underline disappearing in Word is primarily a DOM → run-model normalization problem, not a one-off `<w:u>` patch;
- PDF newline mismatch is primarily a shared layout/preview contract problem, not a CSS-only patch;
- Save vs Save As divergence is primarily one write contract problem, not two button handlers;
- inserted image resize/rotate/morph should eventually be geometry on a document object, not separate DOM tricks for PDF and DOCX.

---

# P0 ROOT 1 — canonical rich-text run formatting for DOCX and future Chemium conversion

Fix the reported DOCX round-trip bug where underline can look correct in FrameChute but disappear after saving and opening in Microsoft Word.

The OOXML serializer already knows how to emit underline. Fix the more general source of truth: **DOM/editor formatting must normalize into a canonical run style model.**

Create/refactor a reusable run-style reader/model with at least:

```text
bold: boolean
italic: boolean
underline: boolean
```

Design it so these can be added later without replacing the model:

```text
strike
fontFamily
fontSize
color
background/highlight
link
```

The reader must recognize nested/inherited/equivalent browser DOM, not just literal tags:

```html
<u>text</u>
<span style="text-decoration: underline">text</span>
<strong><u>text</u></strong>
<span style="font-weight:700;text-decoration:underline">text</span>
<em><strong><u>text</u></strong></em>
```

Formatting is combinable. A run may be bold + italic + underline simultaneously.

Canonical run → OOXML should emit all active properties while preserving the existing least-destructive package path whenever possible.

### Required tests

Round trip through the actual DOCX model/serializer/parser where practical:

```text
underline → survives
bold + underline → both survive
italic + underline → both survive
bold + italic + underline → all survive
```

Inspect/reparse `word/document.xml`; do not test only visual DOM.

### Snowball requirement

Keep the run model format-neutral enough that later:

```text
DOCX → Chemium/Markdown
Chemium → DOCX
Chemium → HTML
```

can reuse the same semantic style flags instead of parsing browser tags again.

---

# P0 ROOT 2 — canonical PDF text/edit object + one layout contract

PR #49 introduced useful primitives (`PDF_STANDARD_FONTS`, font resolution, deterministic line layout). Finish the abstraction so both replacement text and newly created text fields are instances of one edit-object model.

Preferred conceptual model:

```text
kind: replacement | text | image
id
page
x / y
width / height
rotation
z/order

text fields:
text
fontFamily
fontSize

replacement-only:
sourceX / sourceY / sourceWidth / sourceHeight
source index/reference

image fields later/if time:
asset/source reference
aspect ratio
transform/warp geometry
```

Do not force every current property name to change if migration risk is high; introduce normalization/helpers so callers see one contract.

## Multiline + whitespace must match live preview, serialization, and reopen

Current PR serializes lines deterministically. Verify the live preview uses the same whitespace semantics.

Required behavior:

```text
hello  world
second line

→ blur/rerender
→ two spaces remain visible
→ newline remains visible
→ Save As
→ reopened PDF has the same line structure
```

Use an explicit preview rule such as `white-space: pre-wrap` where appropriate. Width is wrap width.

Height must be meaningful. Do not preview unlimited lines inside a bounded field but serialize them outside it. Choose one honest V1 rule and share it between preview and serialization:

```text
clip overflow
OR
limit rendered lines to field height
```

Expose/helper-test the layout result rather than duplicating line math in DOM and serializer.

Keep:

```text
Enter = newline
Ctrl/Cmd+Enter = commit
Tab = deterministic indentation
```

## Add Text Field as a thin proof of the model

If the model is made general enough, add one simple creation route:

```text
Add Text Field
→ click/drag current PDF page
→ type
→ move/resize
→ font/font size
→ undo/redo
→ Save/Save As
```

A new field has no source mask.

If full UI cannot fit in time, still land the model/helper + serializer support + one minimal toolbar entry rather than inventing an incompatible system next run.

---

# P0 ROOT 3 — one shared document Save / Save As contract

Broken/unreliable PDF Save / Save As is a correctness blocker. Fix the write pipeline at the shared document boundary rather than only the PDF buttons.

Target contract:

```text
canonical visible document state
→ serialize exactly once for this save operation
→ choose destination policy
→ write bytes
→ only then clear dirty state / report success
```

One helper should be usable by PDF, DOCX, and future Chemium where practical.

Required semantics:

```text
Save
→ use current writable handle if available
→ if unavailable/unwritable, do not fake success; route/offer Save As

Save As
→ choose/write new target
→ edited bytes are exactly the bytes written
→ returned handle/name becomes current target when available
```

A file opened from embedded bytes/download-only state must still be Save-As-able.

Do not generate separate subtly different serialized blobs for Save and Save As.

Do not clear `documentDirty` until write success is known.

### Test the policy, not browser chrome

If file-picker APIs cannot run in Node, isolate destination/save-decision logic behind injected adapters so tests can cover:

```text
writable handle → Save writes handle
no handle → Save requests/falls back to Save As policy
failed write → dirty remains true
successful Save As → returned handle/name adopted
serialize called once per save operation
```

---

# P1 ROOT 4 — reusable document-image object geometry

If P0 roots are stable with time remaining, do **not** jump to random UI polish. Establish the image-object substrate that can serve both PDF and DOCX.

The strategic FrameChute differentiator is:

```text
image from workspace/OS
→ drag into PDF or DOCX
→ it becomes a real document edit object
→ move / resize / rotate
→ later warp/morph
→ save
```

Create or extract a format-neutral geometry representation/helper such as:

```text
x / y
width / height
rotation
aspectLocked
z/order
optional four-corner quad / warp points later
```

PDF and DOCX serializers can have different adapters, but movement/resize/history should operate on the same conceptual geometry.

### Thin vertical slice if time permits

Prefer one of these complete slices over two half implementations:

```text
A. PDF inserted image → move/resize/rotate → undo → save
OR
B. DOCX inserted image → resize/rotate where OOXML support is honest → save
```

Existing workspace-image → document must remain a copy; source remains in workspace. Global `Drop into FrameChute` must never appear during internal document manipulation.

### Future-proofing

Do not fake warp/morph with CSS if it cannot serialize. Instead make room for a future quad/perspective representation:

```text
p0 p1 p2 p3
```

so SVG/image morphing can later become a serializer adapter problem rather than another document-specific editor.

---

# P1 ROOT 5 — small document command/context layer only if it falls out naturally

If the PDF edit-object model is in place, a minimal PDF-specific command registry/context is useful because future `Add Text Field`, image transform, duplicate, delete, Save, Save As should not be hardcoded into one giant generic menu.

Do not spend large time building polished nested menus in this run. It is enough to introduce a reusable command applicability model or event path that later menu UI can consume.

Example conceptual commands:

```text
pdf.addText
pdf.editText
pdf.deleteEditObject
pdf.duplicateEditObject
document.save
document.saveAs
```

This is lower priority than correctness/model work.

---

# KEEP / VERIFY the good work already in PR #49

Preserve unless tests reveal a defect:

- packaged standard PDF font inventory,
- safe font resolver/fallback,
- deterministic PDF text layout,
- embedding only fonts actually used,
- font-family picker,
- font-size control,
- Enter/newline,
- Ctrl/Cmd+Enter commit,
- Tab indentation,
- focused PDF text tests.

The current PR is small because it implemented one useful foundation. This follow-up should make that foundation connect to the actual save/reopen/document-model pipeline.

---

# DO NOT spend this run on unrelated large surfaces

Unless a tiny change is directly enabled by the new substrate, leave these for the next root pass:

```text
camera/zoom/world expansion
Quick Actions floating UI
full image editor/color picker
stitching/composition
region export
comic primitives
responsive header redesign
```

The purpose is not to solve fewer things; it is to avoid context-switching into independent systems before the document substrate is trustworthy.

---

# 30-minute execution strategy

Use judgment rather than mechanically spending equal time per section.

Suggested sequence:

```text
0–5 min    audit current branch + identify shared boundaries
5–18 min   implement P0 shared models/pipelines
18–25 min  complete thin vertical slices + tests
25–30 min  validation, fix regressions, handoff
```

If a root fix unlocks several small features cheaply, take them. If a feature requires a second bespoke architecture, defer it and document the exact adapter needed next.

Measure success by **future work eliminated**, not button count.

---

# Validation

Run:

```bash
node --test tests/*.test.mjs
node --check <every modified JS file>
git diff --check
bash scripts/package-web-store.sh
```

Manual checks if Chromium/Word are available:

```text
1. PDF multiline + repeated spaces survive blur/rerender.
2. PDF font + font size preview match saved PDF.
3. PDF Save As → reopen → visible edits survive.
4. PDF Save to writable handle → reopen → visible edits survive.
5. Add Text Field, if implemented → multiline/move/resize/undo/save.
6. DOCX underline → Save As → Microsoft Word still shows underline.
7. DOCX bold + italic + underline → all survive together in Word.
8. Inserted document image slice, if implemented → geometry survives save/reopen.
```

If Microsoft Word is unavailable, inspect/reparse the resulting DOCX package and explicitly mark Word as a user manual check.

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- reusable primitives landed,
- user-visible bugs/features those primitives solved,
- remaining thin adapters,
- files changed,
- tests/results,
- manual checks performed/not performed,
- risks/issues,
- exact next highest-leverage root pass,
- branch,
- commit,
- PR.
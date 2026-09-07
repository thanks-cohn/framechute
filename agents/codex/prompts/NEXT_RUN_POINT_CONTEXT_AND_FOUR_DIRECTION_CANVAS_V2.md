# NEXT RUN V2 — point-context + four-direction canvas + creation-first documents

This is the authoritative starter for the run **after the currently active document-context/menu pass finishes**.

Read and execute the full base prompt first:

`agents/codex/prompts/NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS.md`

Then apply the additions and overrides below. If there is any conflict, this V2 file wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

---

# P0 — the top toolbar must CREATE the three ordinary document types

FrameChute currently makes it much easier to open existing files than to start new work. Fix that.

The top toolbar needs one obvious `New` creation control with exactly these three working choices:

```text
New ▾
  LightComp
  DOCX
  PDF
```

Do not clutter the top toolbar with three separate permanent buttons if one compact pop-out/drop-down is cleaner.

Product law:

> **A person should be able to start writing or laying out a document without first creating a file in another application.**

The creation command should place the new document near the visible workspace center unless it was invoked from a meaningful point-context menu, in which case use that clicked world location.

## 1. New LightComp document

This is FrameChute's own web-ready, Joplin-like authoring document.

V1 goal:

```text
New → LightComp
→ clean writing surface
→ type/paste ordinary text
→ Markdown-style structure
→ headings/lists/links/code/quotes where already practical
→ images/assets can be inserted through FrameChute primitives
→ live or near-live web-ready preview
→ Save / Save As
```

Do **not** make LightComp an opaque proprietary binary that traps content.

Treat LightComp as a semantic, web-first document whose canonical content can map cleanly to ordinary web output. A good V1 representation may be Markdown plus metadata/assets, HTML plus metadata/assets, or a small portable package, but the architecture must preserve a straightforward path to:

```text
LightComp → clean HTML/CSS/assets
LightComp → PDF
LightComp → DOCX
```

User-facing promise:

> **Write once in LightComp, and it is already structurally ready for the web.**

Keep the editor simple and Joplin-like rather than recreating Word.

## 2. New DOCX

`New → DOCX` creates a real blank editable Word-compatible document using the canonical DOCX/rich-text model already in main.

Expected flow:

```text
New → DOCX
→ blank editable DOCX object
→ type and apply supported formatting
→ Save / Save As
→ file opens correctly in Microsoft Word or another compatible editor
```

Do not fake this with a plain text block renamed `.docx`.

## 3. New PDF

`New → PDF` creates a real blank PDF document/page using the PDF edit-object model already in main.

Expected flow:

```text
New → PDF
→ blank page appears
→ Add Text Field / insert image / other supported PDF editing primitives
→ Save / Save As
→ valid PDF reopens with the same visible content
```

A sensible default page such as US Letter or A4 is acceptable; prefer one default and keep page-size selection a thin future adapter unless it falls out cheaply.

Do not create a raster screenshot masquerading as the editable source model unless that is explicitly the honest fallback for unsupported content.

---

# P0 — PDF and DOCX need a top-level `Convert` button

Both the PDF block toolbar and DOCX block toolbar should have a visible compact `Convert` button.

Target interaction:

```text
Convert ▾
  LightComp
  DOCX
  PDF
```

The current format may be disabled or labelled as already current rather than performing a meaningless conversion.

Examples:

```text
PDF → Convert → DOCX
PDF → Convert → LightComp

DOCX → Convert → PDF
DOCX → Convert → LightComp
```

This is not merely an export submenu. The result should become a real FrameChute document object of the target type and also be savable in that format.

Preferred workflow:

```text
source document
→ Convert
→ target format
→ new converted document appears beside source
→ source remains unchanged
→ converted object is editable using its native FrameChute editor
→ Save / Save As produces the target file
```

Non-destructive conversion is the default.

---

# P0 — conversion must use one shared semantic document bridge

Do not implement four unrelated one-off converters if a shared semantic model can eliminate future work.

Aim toward:

```text
PDF ─────┐
         │
DOCX ────┼→ CommonDocument / semantic bridge → LightComp
         │                                 ├→ DOCX
LightComp┘                                 └→ PDF
```

The bridge can be deliberately small in V1, but it should be explicit.

Minimum semantic structure worth preserving where available:

```text
paragraphs
headings
bold / italic / underline
lists
links
line breaks
basic alignment
images/assets
simple tables if already supported
```

Do not claim fidelity for semantics the source does not expose safely.

For PDF specifically, remember that many PDFs do not contain clean document structure. V1 may perform a conservative text/image extraction into the semantic model and should preserve visual order as reasonably as possible without pretending it reconstructed the original authoring document perfectly.

If exact conversion is impossible, be honest in the UI/status message rather than silently corrupting content.

---

# P0 — LightComp is the web-ready target, not just another filename extension

The LightComp choice should have a real purpose:

```text
DOCX / PDF
→ Convert
→ LightComp
→ semantic editable content
→ web-ready preview
→ clean web export
```

Think of LightComp as the easy authoring/publishing surface:

```text
Write → Preview → Style → Export
```

V1 should favor readable structure over layout mimicry.

A converted DOCX heading should become a heading, not merely giant bold text.

A converted list should become a semantic list.

Images should become managed assets that can later be edited/replaced by FrameChute without breaking the document.

This is the beginning of the broader document pipeline, not a throwaway Markdown textarea.

---

# P1 — conversion button placement and menu behavior

Keep `Convert` visible near `Save` / `Save As` in PDF and DOCX toolbars.

Do not bury it under generic workspace menus.

The pop-out should follow the same new menu/submenu design laws from the preceding run:

- compact;
- viewport-aware;
- keyboard/focus friendly;
- selection/document state preserved;
- no duplicate `Convert to...` rows scattered elsewhere.

PDF/DOCX editor-specific right-click menus may also expose `Convert ›` later, but the top toolbar button is the required discoverable entry point now.

---

# P1 — creation and conversion commands should be declarative

Prefer a shared registry along these lines:

```text
createDocument(type, context)
convertDocument(sourceRuntime, targetType)
```

with targets:

```text
lightcomp
docx
pdf
```

This should make adding future targets/adapters cheap.

Do not hard-code toolbar-specific conversion logic that cannot be reused from context menus or future batch actions.

---

# Preserve all base-prompt laws

Everything in `NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS.md` still applies, especially:

- right-click resolves from the clicked location, not pre-selection;
- PDF/DOCX editor surfaces keep their specialized menus;
- Quick Actions red top-right `×`, no bottom Clear;
- Simple mode hides timed-motion and `Show image only` commands;
- Sync/Make independent only for supported playable/video media;
- generic menu uses real pop-out groups instead of endless repeated `Open…`, `Show…`, `Preview…` rows;
- frameless/header restore must not duplicate or mangle the header;
- canvas expands in all four directions;
- left/top clamps are removed;
- object world coordinates remain stable;
- scrollbars/origin make every top-left grab/header reachable.

---

# Tests

Add focused tests where practical for:

1. `New` menu exposes exactly LightComp / DOCX / PDF as working creation types;
2. blank DOCX creation produces a serializable DOCX runtime;
3. blank PDF creation produces a valid editable PDF runtime/page;
4. LightComp creation produces a semantic web-ready document runtime;
5. PDF toolbar exposes Convert targets LightComp / DOCX / PDF;
6. DOCX toolbar exposes the same targets;
7. same-format target is disabled/no-op rather than duplicating unnecessarily;
8. conversion keeps the source unchanged;
9. converted result becomes a real target-type FrameChute object;
10. DOCX → LightComp preserves basic semantic runs/headings/lists where supported;
11. LightComp → HTML/web export remains semantic;
12. conversion and creation commands work from shared registries/adapters rather than toolbar-only code.

---

# Manual acceptance if Chromium is available

```text
1. Top toolbar → New → LightComp → type content → web-ready preview works.
2. Top toolbar → New → DOCX → type + Save As → reopen correctly.
3. Top toolbar → New → PDF → add text field → Save As → reopen correctly.
4. Open DOCX → Convert → PDF → editable PDF result appears beside source.
5. Open DOCX → Convert → LightComp → editable semantic web-ready result appears.
6. Open PDF → Convert → DOCX → editable DOCX result appears.
7. Open PDF → Convert → LightComp → editable web-ready result appears.
8. Original document remains unchanged after conversion.
9. Existing point-context and four-direction canvas behavior still passes.
```

If full bidirectional conversion cannot fit the timebox, prioritize the shared bridge + creation of all three blank document types + visible Convert UI + at least one honest vertical conversion path in each source format. Leave remaining format adapters explicitly as thin follow-ups rather than implementing fake conversions.

---

# Updated 30-minute priority order

```text
1. preserve/finish point-context primitive from base prompt
2. preserve/finish true four-direction canvas from base prompt
3. New menu: LightComp / DOCX / PDF
4. real blank DOCX + blank PDF creation
5. minimal LightComp semantic/web-ready document runtime
6. shared conversion bridge + Convert button on PDF/DOCX
7. at least honest DOCX→LightComp and document→PDF vertical slices
8. tests + validation
```

At the 30-minute mark, **conclude active implementation and provide a handoff** containing:

- reusable primitives landed,
- user-visible behavior fixed,
- creation types implemented,
- conversion directions implemented,
- remaining thin conversion adapters,
- files changed,
- tests/results,
- manual checks performed/not performed,
- risks/issues,
- exact next highest-leverage pass,
- branch,
- commit,
- PR.

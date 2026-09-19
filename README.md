# SUBSTRATE

```text
███████╗██╗   ██╗██████╗ ███████╗████████╗██████╗  █████╗ ████████╗███████╗
██╔════╝██║   ██║██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔════╝
███████╗██║   ██║██████╔╝███████╗   ██║   ██████╔╝███████║   ██║   █████╗
╚════██║██║   ██║██╔══██╗╚════██║   ██║   ██╔══██╗██╔══██║   ██║   ██╔══╝
███████║╚██████╔╝██████╔╝███████║   ██║   ██║  ██║██║  ██║   ██║   ███████╗
╚══════╝ ╚═════╝ ╚═════╝ ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝
```

**Your browser has tabs. SUBSTRATE gives it a desk.**

(Originally Called Framechute)


SUBSTRATE is a local-first spatial computing project built around a simple idea: different kinds of digital material should share the same small set of dependable primitives wherever possible. FrameChute is the current Chrome/Chromium extension implementation of SUBSTRATE.

Instead of opening one application for a PDF, another for an image, and another for a DOCX, SUBSTRATE puts those things on one shared workspace and lets useful operations compose.

```text
Open / Drop / Paste
        ↓
file becomes a workspace object
        ↓
move · edit · extract · compare · combine · convert
        ↓
keep working or Save As
```

## Why I started this

I started this project without a clearly defined direction, but with an idea and a picture in my head of where I wanted it to lead.

It was something I had always been a little surprised no one had made. I would not call myself a visionary. If anything, I kept feeling that the future I imagined should have already been here. Maybe, in fragments, it had been. Old browsers and the early web sometimes felt stranger, freer, messier, and more willing to let me touch the machinery. A lot of that disappeared, or was shelved, simplified away,(I miss my sweet sweet applets) or scattered across separate applications.

SUBSTRATE grew out of those fragmented memories of the 2000s internet, with all of its freedom and all of its horrors, mixed with a love of comics, futuristic science-fiction goofballness, and a very presisng urge for software to remain simple and intuitive.

I did not begin with a complete specification. I began with a recurring question: **why should this be harder than it needs to be?**

If an image, a PDF, a DOCX, a video, or eventually a 3D object can share the same basic ideas of opening, selecting, moving, resizing, editing, combining, converting, and saving, then I would rather teach the system those ideas once than build a different little universe for every file type.

That is the direction SUBSTRATE eventually found: not one giant application pretending to be every other application, but a small set of reusable primitives that let many kinds of work happen in the same place.

I still think success would look almost obvious in hindsight, and I wonder how I got here first!

---
## Design law: reuse the primitive

SUBSTRATE prefers **one small, coherent architecture over a pile of miniature applications**.

When two features can share a primitive, they should. Movement, selection, geometry, object identity, menus, saving, conversion, undo, and composition should remain parallel across material types unless a real performance, fidelity, or correctness requirement forces an exception.

> **Same primitive first. Necessary exception second.**

A PDF may need behavior an image does not. A video may need timing machinery a DOCX does not. Those differences should live at the edge instead of forcing every file type to reinvent the system underneath it.

If repeating architecture and shared primitives can let a roughly 10 MB system provide work that would otherwise require a pile of isolated tools approaching 1 GB, that is a win. Compactness is not the only goal, but **simplicity, reuse, and elegance are architectural NEEDS rather than afterthoughts.**

The goal is not to reproduce every professional feature in Photoshop, Word, Acrobat, Premiere, Excel, or Blender. It is to make a small number of foundational controls extraordinarily dependable: select an object, edit it, position it freely or numerically, set its dimensions and appearance, arrange it with other objects, and preserve the result.

**Why should I need all that just to do my homework, fill out a form, fix a sentence, or add a picture?** That question is the design brief. SUBSTRATE is for people who want a straightforward path through everyday work, whether they are students, educators, researchers, office workers, artists, or experienced users who need precise controls. Basic tasks should not demand specialist knowledge; precision should not demand a wall of permanent buttons. Support different devices, accessibility needs, and levels of expertise where feasible, without claiming every specialist workflow has already been implemented.

See the [small-controls, foundational-editor proposal](Proposals/foundational-editor-small-controls-image-aware-documents.md). A **Padding** control is currently proposed **only for page margins**, with px/% and top/right/bottom/left settings. It must not be confused with the PDF's source-glyph erasure masks or automatically rearrange untouched imported content.

The goal is to make a very large class of ordinary file work feel immediate:

> **Open it. Change it. Save it. Keep going.**

---

## Project status

SUBSTRATE is in **active development**. FrameChute, its current Manifest V3 Chrome/Chromium extension implementation, is already usable from source, while the project is still in the stage where interaction rules, document fidelity, export behavior, and workspace primitives are being hardened aggressively.

**Current extension version:** `1.0.15` (as recorded in manifest.json on 2026-09-19)

**Primary target:** Chrome / Chromium desktop

**Architecture:** browser-side JavaScript/CSS/HTML, local-first, no required cloud backend, no native companion

**Repository status (2026-09-19):** PDF text-interaction stabilization has been merged into main through PR #96. Text editing and image placement still have important fidelity and document-flow gaps; this is an actively tested working editor, not a claim of complete PDF or Acrobat parity.

The most important recent milestone has not been another giant feature dump. It has been making the existing surface behave more like one coherent system.

**Recent development pace:** PRs #88 through #96 were nine consecutive PDF-focused merges between late September 18 and early September 19, 2026 (UTC), roughly four hours from the first to the last merge. They addressed live text visibility, click/field handles, no-op superimposition, horizontal typing growth, source-glyph masking, and hover/drag visibility. That is a fast feedback-and-iteration cycle, **not** a release-quality claim: successive real-browser tests exposed new interactions among those fixes. The next milestone is whole-page image-aware text reflow and faithful save/reopen, rather than another stack of narrow mask patches.

**Known visual limitation:** adding a large image to an imported, text-heavy PDF can still leave overlapping or unreadably fragmented text. The existing image-wrap path is not yet a dependable whole-paragraph/page layout engine. The [current image-flow bug and acceptance plan](bugs/latest/2026-09-19_01-55_CDT_pdf-image-reflow-and-layout-collisions.md) records the failure and the next work needed.

Recent stabilization includes:

- DOCX/PDF surfaces owning their own drag/drop behavior instead of accidentally triggering the global workspace ingest overlay
- same-document image drags behaving as **moves**, while cross-container drops behave as **copies**
- precise DOCX image placement at the browser caret instead of simply appending images to the nearest block
- PDF image moves preserving the existing edit object rather than replacing its identity
- safer DOCX find/replace that mutates text nodes instead of rewriting arbitrary HTML
- improved DOCX run/style round-trip for properties such as strike, color, highlight, and numbering
- PDF tab/newline preservation and more predictable replacement-field growth
- nested submenu positioning that stays attached and clamps to the viewport
- Advanced-only timing controls being removed from the rendered menu when Advanced mode is off
- PDF-specific settings for link-annotation deletion behavior

This is the current character of SUBSTRATE: **broad utility already exists; now the universal interaction laws are being made dependable.**

---

## Try FrameChute in about five minutes

There is no npm build step required just to run the extension.

### 1. Clone the repository

```bash
git clone https://github.com/thanks-cohn/framechute.git
cd framechute
```

You can also download the repository ZIP from GitHub and extract it somewhere permanent.

### 2. Load it in Chromium

In Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the repository folder containing `manifest.json`.
5. Click the FrameChute extension icon.

The equivalent extension pages also work in other Chromium-family browsers, for example `edge://extensions` or `brave://extensions`.

### 3. Give it real files

The fastest way to understand FrameChute is not to stare at the interface. Drop ordinary files into it.

A good first test set is:

```text
1 image
1 short video
1 PDF
1 DOCX
```

Put them on the workspace together and try moving between file types without leaving the desk.

---

## Recommended first-run smoke test

If you are evaluating the project, this is the short path that exercises the most important ideas.

### Workspace

- drop an image onto the workspace
- move and resize it
- right-click it and inspect its object-specific actions
- duplicate it or create a derived result
- resize the browser window and confirm that passive UI changes do not silently rewrite the object's world position

The workspace rule is:

> **The viewport moves. The artwork does not.**

### DOCX

Open a normal `.docx` file and try:

- editing text
- bold / italic / underline
- paragraph styles and alignment
- lists and tables
- find/replace
- dragging an embedded image to another position inside the same document
- dropping another image into the document
- Save As DOCX

For the image test, same-document movement should keep the same semantic image and place it at the resolved inline caret. A document-owned drag should not cause the big global "Drop into FrameChute" workspace overlay to appear.

After saving, reopen the result in Word or LibreOffice if available. That manual round-trip test is especially useful because FrameChute is intentionally trying to preserve ordinary files as ordinary files rather than trapping them in a private format.

### PDF

Open a PDF and try:

- page navigation
- rotate / duplicate / delete / reorder pages
- extract or merge pages
- replace text
- move/resize a committed replacement field
- insert or move an editable image
- open the PDF-specific **Settings...** item from the document context menu
- Save / Save As PDF

The current PDF editor is a practical utility layer, not a complete Acrobat-style arbitrary-object editor. Text replacement currently uses a cover-and-redraw model.

### Video

Open a local playable video, seek to a frame, then extract that frame as an image.

```text
video
  ↓
Extract Frame
  ↓
image object
  ↓
crop / annotate / convert / save
```

That little workflow captures a large part of the SUBSTRATE philosophy: **the result of one tool should immediately become normal material for the next tool.**

### Preserve the desk

Finally try both concepts:

- **Take Snapshot** for a flattened visual export of the used workspace
- **Export Workspace** / **Open Workspace** for the actual `.fcx` working session

`.fcx` exists to preserve the desk. It is not intended to replace native file formats.

---

## What works today

| Material / surface | Current role |
| --- | --- |
| Images | view, move, resize, crop, rotate, flip, convert, annotate, paint/edit, batch operations, save |
| Video | local playback, seek, frame extraction, workspace arrangement, advanced timing/sync |
| Audio | local playback, workspace arrangement, advanced timing/sync |
| PDF | rendering, page operations, editable replacement/free-text fields, positioned image edits, partial image-wrap support, merge/extract/crop, save; **full image-aware paragraph/page reflow is not yet reliable** |
| DOCX | practical text editing, formatting, lists/tables, embedded images, image insertion/movement, save |
| Text | notes, editing, find/replace, comparison, conversion |
| ZIP | browse supported entries and open them as workspace objects |
| CBZ | local comic/image navigation |
| Capture | screenshot, screen recording, microphone recording |
| Workspace | spatial arrangement, object-specific menus, snapshot export, `.fcx` save/reopen |

Browser codec and file-system behavior still depend on Chromium and the operating system.

CSV files can currently be opened, but they are treated as plain text in the text editor. FrameChute does **not** currently provide a row/column grid, spreadsheet controls, sorting, filtering, charts, or CSV-specific editing.

---

## Images and visual work

Images are currently one of the deepest surfaces in FrameChute.

Available or actively exposed image paths include:

- crop
- resize
- rotate left/right
- flip horizontal/vertical
- PNG / JPEG / WebP output
- lossy quality control
- transparent-background handling
- paint / image editing mode
- trim transparent margins
- make a selected color transparent
- fill transparency with a background color
- blur / pixelate a selected region
- annotations
- straighten
- basic perspective correction
- Save As

Multi-image workflows include:

- stitch images horizontally or vertically
- contact sheets
- common icon-size generation
- two-image comparison
- image-to-PDF
- batch conversion/compression
- ZIP selected results

Some image transforms are still being unified around one stronger canonical image state so that preview, undo, snapshot, and exported output cannot disagree.

---

## Documents

### DOCX

FrameChute opens DOCX as editable document material rather than flattening it immediately.

The current implementation handles a useful subset of OOXML and tries to preserve untouched package content least-destructively where practical.

Current document work includes:

- paragraphs and runs
- text editing
- basic inline formatting
- paragraph styles
- alignment
- lists / numbering
- tables
- embedded images
- adding new images to the DOCX package
- same-document image movement
- cross-container image copying
- find/replace
- Save As DOCX

It is **not yet a complete Microsoft Word layout engine**. Complex Word documents may contain structures FrameChute does not fully understand yet.

### PDF

FrameChute uses PDF.js for local rendering and pdf-lib for practical mutation/export paths.

Current PDF work includes:

- page navigation
- rotate / delete / duplicate / reorder
- extract pages
- merge another PDF
- crop margins
- conservative re-save/compression attempts
- export page images
- direct replacement-text fields
- image edit placement
- undo/redo for supported edits
- Save / Save As

The PDF replacement system is intentionally useful before it is exhaustive. It currently relies on cover-and-redraw for source text and can position images, but it does not yet guarantee coherent reflow of surrounding paragraphs when an image is added or resized. Dense imported pages and difficult source PDFs may require explicit editing or a safe fallback. Do not assume that a visually clean live preview proves externally faithful export.

**Next PDF gate:** an image inserted into supported flowing text should make the affected paragraph move naturally around or below it, preserving every word and reading order. The resulting layout must survive drag/resize, undo, save, and reopen without text collisions. Intentional image-over-text overlay must remain an explicit choice, not the only outcome of insertion. See the [image-flow bug report](bugs/latest/2026-09-19_01-55_CDT_pdf-image-reflow-and-layout-collisions.md) and [foundational-editor proposal](Proposals/foundational-editor-small-controls-image-aware-documents.md).

---

## Quick Actions and composition

SUBSTRATE's action system is built around a simple idea:

```text
select material
      ↓
do the obvious operation
      ↓
result becomes material too
```

That lets one-object actions and multi-object actions share the same mental model.

Examples include:

- rename / duplicate
- image transforms
- image comparison
- contact sheets and stitching
- image-to-PDF
- text extraction and comparison
- document conversion
- video frame extraction
- ZIP selected results

As the project grows, Quick Actions should stay contextual instead of becoming a giant permanent application sidebar.

---

## Simple and Advanced modes

FrameChute separates normal file work from specialist controls.

### Simple

```text
open
move
resize
edit
save
```

### Advanced

Advanced mode exposes deeper timing, synchronization, and specialist object behavior when it is actually relevant.

A current UI invariant is that Advanced-only commands should not merely be disabled or hidden awkwardly in Simple mode. They should not be part of the rendered normal menu at all.

> **Power can exist without requiring every user to look at it all the time.**

---

## Development and automated testing

A normal local validation pass is intentionally small.

### Run the unit suite

With a current Node.js installation:

```bash
node --test tests/*.test.mjs
```

The tests cover areas including workspace/action foundations, document save behavior, DOCX images, internal drag ownership, exact document-image drop placement, PDF replacement behavior, FCX persistence, image editing primitives, submenu geometry, and related invariants.

### Check JavaScript syntax

For a changed file:

```bash
node --check path/to/file.js
```

### Check patch whitespace

```bash
git diff --check
```

### Run the Chrome Web Store release/package gate

```bash
bash scripts/package-web-store.sh
```

Packaging requires a POSIX-compatible shell and Python 3. Python is **not** required to run the extension itself.

A normal development validation pass should include all four checks where applicable.

---

## Manual testing matters

Automated tests are necessary, but they cannot prove browser UI behavior or office-document compatibility by themselves.

For changes touching documents or drag/drop, a useful manual matrix is:

```text
Chrome on Windows
Chrome/Chromium on Linux when available

DOCX:
  open → edit → move image → insert image → save → reopen externally

PDF:
  open → replace text → move/resize edit → save → reopen externally

Workspace:
  drag internal object → drag external file → resize browser → export/reopen workspace
```

When something fails, the most useful bug report includes:

- browser + version
- operating system
- exact file type
- exact steps to reproduce
- what you expected
- what happened instead
- whether the problem survives an extension reload
- a small non-sensitive sample file when possible

---

## Current limitations

FrameChute is broad enough that clarity about the edges matters.

### DOCX fidelity

The editor supports a practical subset, not every Microsoft Word feature. Rich layout, unusual OOXML structures, floating shapes, complex section behavior, and other advanced Word constructs may not round-trip perfectly.

### PDF editing

Replacement text is currently a practical cover-and-redraw system. This is not arbitrary low-level editing of every original PDF object. The September 19 image-and-text screenshot demonstrates that existing positioned-image wrapping can still produce crowded and overlapping text; deterministic whole-region reflow and externally faithful save/reopen are next-stage work, not shipped guarantees.

Very large PDFs do not yet have the full range-loading, virtual-page, and bounded-cache architecture needed for truly enormous documents.

### Screenshot capture

The screenshot path is still being hardened for browser/OS combinations that may expose an unready or black first captured video frame.

### Image transforms

Some advanced transforms are still being consolidated so the live preview, undo history, snapshot, and exported raster all use one canonical state.

### Archives

Archive persistence is intentionally bounded. Very large archive embedding is not treated as free or unlimited.

### Browser APIs

Save As, directory access, capture behavior, and codecs depend on the browser and OS. Chrome/Chromium desktop remains the primary target.

---

# Where SUBSTRATE is going

The project is moving from **many useful capabilities** toward **a small number of universal, dependable primitives**.

**Current sequence: master ordinary PDF work → add a lightweight CSV editor → develop our own portable content/scene format.** Existing DOCX and workspace work continue, but we should not let a growing menu outrun basic correctness. "Master" means common text, image, margin, form-like, and page edits feel direct, do not scramble surrounding content, and save/reopen faithfully on representative documents. Specialized signatures, security, redaction, complex prepress, and full accessibility remediation need separate validation rather than optimistic equivalence claims.

The roadmap follows one rule:

> **Do not build twenty separate applications. Build enough universal primitives that twenty useful workflows emerge.**

## First gate: PDF editing that behaves like a document

The next critical task is image-aware text flow. The present wrap path can try to shift individual source text runs around inserted images; it does not consistently rebuild a readable affected paragraph or carry its overflow forward. On normal supported text, inserted or resized images should occupy real layout space: complete words flow into readable side lanes, clear below when the lanes are too narrow, and continue onto subsequent lines/pages where necessary. Original content outside the affected region must remain unchanged; ambiguous PDFs get an explicit safe fallback rather than a mangled automatic conversion.

A small contextual property model should cover positioning (drag or exact X/Y), dimensions, font and text size, and page-only margin Padding in px or %. Hover, live drag, commit, undo, export, and reopen must agree. The [bug report](bugs/latest/2026-09-19_01-55_CDT_pdf-image-reflow-and-layout-collisions.md) defines acceptance tests. The [foundational-editor proposal](Proposals/foundational-editor-small-controls-image-aware-documents.md) gives the product rules.

## Continuing in parallel: make documents feel normal

The next broader pass is the structured-text/document experience.

The target is for a normal DOCX user to find the basic things they expect without hunting:

- dependable font-size controls
- practical font-family controls
- bold / italic / underline
- H1 / H2 / H3 and normal paragraph styles
- paragraph spacing and line spacing
- alignment and indentation
- lists / numbering
- useful document-specific right-click actions
- predictable image insertion and movement
- stronger save/reopen fidelity
- better handling of document structure without flattening unrelated content

PDF work continues in parallel around stable geometry, predictable text-field behavior, and faithful export.

The bar is not "be Microsoft Word." The bar is:

> **A person opening an ordinary document should immediately understand how to make ordinary changes.**

## Next: a stronger spatial substrate

The workspace itself is planned to become more capable without making object coordinates fragile.

Planned spatial primitives include:

```text
Ctrl +     zoom camera in
Ctrl -     zoom camera out
Ctrl 0     reset camera
Fit Selection
Fit Workspace
```

Zoom should affect the **camera**, not mutate object geometry.

The workspace should also become expandable beyond the initial viewport instead of feeling naturally pinned to the upper-left corner.

## Selection and region export

A clearer distinction is planned between selecting real objects and framing pixels in world space.

```text
Select Mode
→ select actual objects
→ move / group / arrange / batch

Region / Frame
→ choose an area of world space
→ export exactly that visual area
```

This opens the door to better composition, deterministic PDF arrangement, page framing, and visual publishing.

## Small drawing primitives, large compositional reach

SUBSTRATE does not need hundreds of illustration tools before it can become useful for diagrams, tutorials, comics, storyboards, and annotated screenshots.

The useful primitive set is comparatively small:

- rectangle
- ellipse
- line
- arrow
- polygon
- text box
- frame/panel
- speech bubble
- thought bubble
- grouping
- align/distribute
- better brush controls

If those objects obey the same workspace rules as files, much richer workflows emerge naturally.

## After the PDF gate: a lightweight CSV editor

CSV currently opens as plain text; it does **not** yet have a native grid. The next planned document/data surface is intentionally small: open ordinary CSV, see rows and columns, select and edit cells with the keyboard or pointer, add/remove rows and columns, find data, perform simple optional sort/filter operations, and save a correctly escaped, interoperable CSV.

Preserve headers, quoted separators, line breaks inside quoted fields, encodings where supported, and numeric-looking IDs or leading zeros as text unless the user explicitly asks for a conversion. Keep this local-first and responsive on modest machines. Do not turn this milestone into an Excel clone: formulas, complex workbook features, and charts are not prerequisites for a useful CSV editor.

The same foundational selection, direct manipulation, numerical precision, undo, and import/export rules should apply to the grid without imposing paragraph layout on tabular data.

## Then: our own portable content format

After the ordinary PDF experience and lightweight CSV editor are dependable, define a documented native representation for mixed text, images, geometry, layout constraints, and eventually interactive scenes. Earlier proposals use **WEBX** as a working name; its final name and schema are not settled. The format should express reusable objects and rules rather than baking every page into anonymous pixels.

This is **not** a rebranding of the existing FCX workspace-session format. FCX currently preserves the desk; the future native content/scene format would describe the material itself and its layout. Ordinary PDF, DOCX, CSV, image, and web exports must remain useful: the user should not need our format or a subscription simply to retrieve their work.

## Longer term

The long-term direction of SUBSTRATE is a browser workspace where files, generated results, drawings, structured data, documents, media, and eventually lightweight 3D/web objects can share the same direct-manipulation rules.

> **Files become objects. Objects become scenes. Scenes can eventually become worlds.**

---

## Project structure

The exact tree changes often, but the major areas currently include:

```text
manifest.json
src/
  workspace.html
  workspace.js
  workspace.css
  actions/
  documents/
  image-edit/
  drag-ownership.mjs
  document-image-drag.mjs
  submenu-position.mjs
  fcx-format.mjs
  fcx-portable.js
  workspace-snapshot.js
vendor/
assets/
icons/
tests/
scripts/
  package-web-store.sh
agents/codex/prompts/
Proposals/       product and architecture proposals
bugs/latest/     timestamped observed failures and next-stage handoffs
```

A recurring architectural preference is to pull invariants into small testable modules instead of letting `workspace.js` become the implementation of everything.

---

## Privacy and security model

FrameChute is local-first. Ordinary file chores should not require uploading personal files to a remote service merely because the interface happens to run in a browser.

The current extension manifest uses Manifest V3 and does not request general extension API permissions or broad host permissions.

The Web Store packaging gate also checks for classes of runtime dependency the project intentionally does not want, including remote executable code and native-companion assumptions.

Browser-mediated capabilities such as opening a local file/folder or starting screen/microphone capture are requested when the user explicitly invokes those actions.

---

## License

SUBSTRATE, including the FrameChute implementation in this repository, is **open-source software released under the MIT License**.

You are free to use, copy, modify, merge, publish, distribute, sublicense, and sell copies of this codebase, including building derivative and commercial projects from it, subject to the terms of the MIT License.

See [`LICENSE`](LICENSE) for the full license text.

---

## In one sentence

**SUBSTRATE is a local-first browser workbench philosophy and architecture where everyday digital material shares a small set of reusable primitives, becoming movable, editable, composable objects that can be opened, changed, combined, converted, captured, and saved without bouncing between a pile of separate applications and websites. FrameChute is its current Chrome/Chromium implementation.**

---

**Greatness Grows Here**

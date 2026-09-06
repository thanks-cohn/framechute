# FrameChute

**Open it. Change it. Save it.**

> **Your browser has tabs. FrameChute gives it a desk.**

FrameChute is a local-first, browser-native workspace for everyday file work.

Instead of deciding which application should open a file, put the file on the FrameChute workspace and decide what you want to do to it.

```text
Traditional desktop workflow

File
 ↓
Which app?
 ↓
Open / import / convert
 ↓
Do one job
 ↓
Export
 ↓
Find another app for the next job


FrameChute

Open / Drop / Paste
 ↓
File becomes a workspace object
 ↓
Move · edit · extract · compare · combine · convert
 ↓
Keep the result in the workspace or Save As
```

FrameChute is deliberately not trying to become Photoshop, Word, Acrobat, Premiere, a spreadsheet suite, and a whiteboard all at once.

The goal is smaller and, in practice, surprisingly broad:

> **Give ordinary digital things one consistent place where obvious operations are immediate.**

---

## Contents

- [Install](#install)
- [What FrameChute can do](#what-framechute-can-do)
- [Supported kinds of material](#supported-kinds-of-material)
- [Workspace and direct manipulation](#workspace-and-direct-manipulation)
- [Images](#images)
- [Video and audio](#video-and-audio)
- [PDF](#pdf)
- [DOCX and text](#docx-and-text)
- [CSV and structured data](#csv-and-structured-data)
- [ZIP and CBZ archives](#zip-and-cbz-archives)
- [Capture tools](#capture-tools)
- [Quick Actions and batch work](#quick-actions-and-batch-work)
- [Snapshots and workspace export](#snapshots-and-workspace-export)
- [Local-first privacy and security](#local-first-privacy-and-security)
- [Simple and Advanced modes](#simple-and-advanced-modes)
- [Example workflows](#example-workflows)
- [Development and testing](#development-and-testing)
- [Project structure](#project-structure)
- [Current limitations](#current-limitations)
- [Roadmap](#roadmap)
- [Design principles](#design-principles)
- [License](#license)

---

# Install

FrameChute is currently packaged as a **Manifest V3 Chrome/Chromium extension**. The current manifest version is **1.0.14**.

There is no npm build step required just to run the extension from source.

## Option A: clone the repository

```bash
git clone https://github.com/thanks-cohn/framechute.git
cd framechute
```

Then in Chrome or another Chromium-family browser:

1. Open the browser's extensions page.
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
   - Brave: `brave://extensions`
2. Turn on **Developer mode**.
3. Choose **Load unpacked**.
4. Select the repository folder that contains `manifest.json`.
5. Pin FrameChute if you want quick access.
6. Click the FrameChute extension icon to open the workspace.

## Option B: download the repository as a ZIP

1. On GitHub, choose **Code → Download ZIP**.
2. Extract the ZIP somewhere permanent.
3. Open your browser's extensions page.
4. Enable **Developer mode**.
5. Choose **Load unpacked**.
6. Select the extracted folder containing `manifest.json`.

Do not select the ZIP itself. Chromium expects an unpacked directory.

## Updating an unpacked installation

If you cloned the repository:

```bash
git pull
```

Then return to the browser's extensions page and press **Reload** on FrameChute.

If you installed from a downloaded ZIP, replace the extracted files with the newer version and reload the extension.

## Build a Chrome Web Store package

The repository includes a release gate and packaging script:

```bash
bash scripts/package-web-store.sh
```

This requires a POSIX-compatible shell and Python 3 **for packaging only**. Python is not required to run FrameChute.

A successful run creates a ZIP under:

```text
dist/flashframe-chrome-web-store-v<version>.zip
```

The release script verifies the manifest, required assets, package contents, permissions, host access, and several classes of forbidden runtime dependency before producing the ZIP.

---

# What FrameChute can do

FrameChute treats files and generated results as objects on one shared spatial workspace.

Today the project can work with combinations of:

- images
- local video
- local audio
- PDF documents
- DOCX documents
- plain text / notes
- CSV tables
- ZIP archives
- CBZ comic archives
- supported web / URL objects
- screenshots
- screen recordings
- microphone recordings
- generated charts
- generated image results
- generated PDFs
- extracted archive contents

The important part is that the output of one operation can immediately become the input to another.

For example:

```text
video
 ↓
extract frame
 ↓
image object
 ↓
crop / resize / annotate / convert
 ↓
make PDF or Save As
```

Or:

```text
CSV
 ↓
clean / sort / filter
 ↓
quick chart
 ↓
image object
 ↓
place beside a PDF or notes
```

---

# Supported kinds of material

Exact codec and browser support still depend on Chromium and the operating system, but the current object model covers these broad classes:

| Material | Typical examples | Current FrameChute role |
| --- | --- | --- |
| Images | PNG, JPEG, WebP and other browser-decodable images | View, move, resize, edit, transform, batch, save |
| Video | MP4, WebM and browser-playable video | Play, seek, arrange, extract frames, advanced timing/sync |
| Audio | MP3, WAV, OGG and browser-playable audio | Play, arrange, advanced timing/sync |
| PDF | `.pdf` | Read, replace text, page operations, extract/merge/crop/save |
| Word | `.docx` | Practical editing, formatting, tables, images, Save As DOCX |
| Text | TXT, Markdown-like/plain textual sources | Notes, editing, find/replace, comparison, conversion |
| CSV | `.csv` | Editable grid, filtering, cleaning, dedupe, charting, Save As |
| Archives | ZIP, CBZ | Browse contents, open supported entries, CBZ image navigation |
| URLs / web | supported direct URLs and web objects | Keep references/content alongside local work |
| Capture | screen / microphone | Screenshot, screen recording, microphone recording |
| Workspace | `.fcx` | Reopen a FrameChute session with supported state/assets |

---

# Workspace and direct manipulation

The workspace is the core of FrameChute.

Files are not meant to disappear into a modal or replace the entire application. They become objects that can sit beside one another.

Current workspace behavior includes:

- drag/drop/open/paste ingestion paths
- movable top-level objects
- resizable objects where the object type supports it
- z-order / layering behavior
- object naming
- duplicate/copy workflows
- maximize / restore style object presentation
- explicit **Bring to Center** recovery
- image/video frameless presentation
- fading object chrome for media-focused viewing
- object-specific right-click actions
- contextual Quick Actions
- Simple and Advanced interaction modes
- native Save / Save As where supported
- workspace-wide snapshot export
- `.fcx` workspace save/reopen

A central rule of the project is:

> **The viewport moves. The artwork does not.**

Passive browser resize, toolbar wrapping, scrolling, or other UI changes should not silently rewrite the user's object positions.

---

# Images

Images are currently one of FrameChute's deepest utility surfaces.

## Core image operations

Current image tooling includes or exposes paths for:

- crop
- resize
- rotate left/right
- flip horizontal/vertical
- format conversion
- PNG / JPEG / WebP output
- quality/compression control for lossy formats
- transparent-background handling
- Save As
- batch conversion to ZIP
- paint / image editing mode
- trim transparent margins
- make a selected color transparent
- fill transparency with a background color
- blur or pixelate a selected region
- annotations
- straighten
- basic perspective correction

Some of the more advanced transform operations are currently being hardened so that their live workspace preview, undo behavior, and exported result always use the same canonical image state. See [Current limitations](#current-limitations).

## Multi-image operations

FrameChute also includes multi-image workflows such as:

- stitch images vertically or horizontally
- create a contact sheet
- generate common icon sizes
- compare two images with an opacity slider
- turn selected images into a PDF
- batch convert/compress images with one configuration
- ZIP selected results

The source image is generally kept intact unless the user explicitly chooses a destructive/save route; many operations create a new result object instead.

---

# Video and audio

Playable media can live directly on the workspace instead of forcing the user into a separate player application.

Current media behavior includes:

- local video playback
- local audio playback
- seeking
- movable media objects
- frameless media presentation
- fading controls/chrome
- extracting the currently decoded video frame as a PNG image object
- screen-recording output as a workspace media object
- microphone-recording output as an audio object
- advanced timing/synchronization features for playable media

Frame extraction is intentionally composable:

```text
seek video
 ↓
Extract Frame
 ↓
normal FrameChute image
 ↓
all normal image tools become available
```

Advanced `Sync with…` / independence behavior belongs to actual playable video/audio objects, not static images or documents.

---

# PDF

FrameChute includes a practical PDF editor/utility layer built from PDF.js for rendering and pdf-lib for document mutation/export.

Current PDF work includes:

- render normal PDF pages locally
- page navigation
- rotate page
- delete page
- duplicate page
- move/reorder page
- extract page(s)
- merge another PDF
- crop page margins
- conservative PDF re-save/compression attempt
- export PDF page images
- Save / Save As

## PDF text replacement

FrameChute also has a direct replacement-text model:

- click/select editable text regions
- replace text
- move a committed replacement field
- resize its field
- change font size
- nudge selected replacements
- undo / redo replacement operations
- keep the original source region masked in the live view
- serialize the replacement back into a PDF

The current replacement serializer uses a simple cover-and-redraw model. It is intentionally practical rather than a full Acrobat-style object editor.

---

# DOCX and text

FrameChute can open and re-save practical Word documents without converting the whole workflow into a remote service.

Current DOCX support includes:

- parse paragraphs and runs
- text editing
- bold
- italic
- underline
- paragraph styles
- alignment
- list representation
- tables
- embedded images
- adding images to the DOCX package
- preserving unique relationship/drawing identifiers for inserted images
- Save As DOCX

Where possible, ordinary text/format edits take a least-destructive path that patches the original OOXML package instead of rebuilding unrelated document content.

For larger structural changes, FrameChute can rebuild the supported subset honestly rather than pretending unsupported Word behavior will be preserved perfectly.

## Cross-document utilities

The current action system also contains useful document/text operations:

- Extract text from text/DOCX/PDF sources where selectable text exists
- Compare two text-oriented documents
- Find & Replace in text and DOCX
- Convert text/DOCX content to a simple PDF
- Convert text/PDF-extracted text to a simple DOCX

These are intentionally lightweight conversions, not claims of perfect office-suite fidelity.

---

# CSV and structured data

CSV files become editable table objects rather than inert downloads.

Current CSV features include:

- edit cells directly
- add rows
- remove rows
- remove columns
- click a header to sort
- live find/filter rows
- remove duplicate rows
- split a column by delimiter
- merge selected columns
- normalize whitespace
- remove blank rows during cleaning
- capitalization cleanup
- quick bar-chart generation
- merge compatible CSV tables
- Save As CSV

Quick Chart creates an SVG image result that can then be treated like another visual object on the workspace.

This is not yet a spreadsheet/formula engine. A richer grid/formula/reference system is a natural future substrate.

---

# ZIP and CBZ archives

FrameChute can inspect supported archives locally.

Current archive behavior includes:

- ZIP tree/list browsing
- open supported archive entries as new FrameChute result objects
- CBZ image navigation
- previous / next comic-page controls
- safe archive-budget checks to reduce decompression abuse
- persistence of supported archive state in the workspace

Current archive snapshots intentionally have limits; archives over 100 MB are not embedded into workspace snapshots by this path yet.

---

# Capture tools

FrameChute includes browser-native capture actions:

- Screenshot
- Record screen
- Record microphone

Screen and microphone permissions are requested when the user invokes the relevant action, rather than as broad always-on extension permissions.

Captured results become normal workspace objects, so a screenshot can immediately be cropped/annotated/exported and a recording can sit beside the rest of the work.

The screenshot path is currently being hardened around first-frame readiness on different Chromium/OS combinations. See [Current limitations](#current-limitations).

---

# Quick Actions and batch work

Quick Actions are the contextual utility layer for selected objects.

The underlying action registry supports both single-object and multi-object operations so the same mental model can scale from:

```text
resize this image
```

to:

```text
convert these images together
```

Current action families include:

- rename
- duplicate
- Copy To… where the browser exposes a writable directory picker
- image transforms and exports
- image comparison / contact sheet / stitching / icon generation
- image-to-PDF
- document text extraction / comparison / conversion
- CSV merge
- video frame extraction
- compress selected supported objects into a ZIP

The Quick Actions presentation itself is being simplified so it stays contextual rather than becoming a permanent application sidebar.

---

# Snapshots and workspace export

FrameChute has two different save concepts because they solve different problems.

## Save / Save As

Save the actual object as a normal file.

Examples:

```text
image → PNG / JPEG / WebP
PDF   → PDF
DOCX  → DOCX
CSV   → CSV
```

FrameChute should not trap ordinary files inside a proprietary workspace format just because they were edited in FrameChute.

## Take Snapshot

Take Snapshot creates a flattened image of the used visual workspace.

Current snapshot options include:

- Tight Bounds
- Square bounds
- PNG
- JPEG
- WebP
- scale control
- quality control where relevant
- transparent background where the output format supports it

The snapshot bounds are based on visible workspace objects rather than simply capturing the browser viewport.

## Export Workspace / Open Workspace

When the whole desk matters, FrameChute can save a `.fcx` workspace.

Conceptually:

```text
objects
+ positions
+ supported state
+ generated results
+ optionally packaged local assets
        ↓
      .fcx
```

The portable workspace path supports **Include Files** and **State Only** style behavior so a workspace can choose between stronger portability and lighter references where appropriate.

The project's persistence promise is:

> **Everything just as it was, as far as the supported object model can honestly preserve it.**

---

# Local-first privacy and security

FrameChute is designed around the idea that ordinary file chores should not require uploading personal material to a third-party server.

The current Chrome Web Store packaging gate enforces an unusually small extension security surface:

```text
Manifest V3
Extension API permissions: NONE
Host permissions: NONE
Broad host access: NONE
Remote executable code: NONE
Native companion: NONE
Python/EXE runtime dependency: NONE
```

The release script also rejects packaged remote script imports, `eval`, native-messaging dependencies, loopback/localhost dependencies, and several desktop-runtime artifacts.

FrameChute still uses browser permissions at the moment a user explicitly requests a browser-mediated capability, such as choosing a file/folder or starting screen/microphone capture.

The distinction is important:

> **FrameChute can browse what the user explicitly grants it access to.**

It should not quietly become a general filesystem or web surveillance surface.

---

# Simple and Advanced modes

FrameChute is intended to stay approachable as capabilities grow.

## Simple mode

Simple mode is for the normal file-work flow:

```text
open
move
resize
edit
save
```

The goal is to keep timing, synchronization, and other specialist controls out of the way unless they are actually needed.

## Advanced mode

Advanced mode exposes deeper capabilities such as media timing/synchronization and other specialist object behavior.

The distinction is a product rule, not a limitation of the substrate:

> **Power can exist without requiring every user to look at it all the time.**

---

# Example workflows

## Video frame to finished image

```text
Open video
 ↓
Seek to a frame
 ↓
Extract Frame
 ↓
Crop / resize / annotate / convert
 ↓
Save As or keep the result in the workspace
```

## Several images to one PDF

```text
Select images
 ↓
Make PDF
 ↓
PDF object appears
 ↓
Continue working or Save As
```

## Clean a CSV and explain it visually

```text
Open CSV
 ↓
Filter / sort / dedupe / clean
 ↓
Quick Chart
 ↓
SVG image result
 ↓
Place beside notes or a PDF
```

## Inspect an archive

```text
Open ZIP / CBZ
 ↓
Browse entries
 ↓
Open supported entry
 ↓
Entry becomes another workspace object
```

## Compare documents

```text
Select two text-oriented documents
 ↓
Compare documents
 ↓
Comparison result becomes editable text
```

## Preserve the entire working session

```text
files + layout + generated results
 ↓
Export Workspace
 ↓
.fcx
 ↓
Open Workspace later
```

---

# Development and testing

FrameChute is plain browser-side JavaScript/CSS/HTML plus packaged local libraries. The source tree is intentionally inspectable without requiring a large framework build system.

## Run tests

With a current Node.js installation:

```bash
node --test tests/*.test.mjs
```

## Check JavaScript syntax

For changed JavaScript files:

```bash
node --check path/to/file.js
```

## Check patch whitespace

```bash
git diff --check
```

## Run the release/package gate

```bash
bash scripts/package-web-store.sh
```

A normal development validation pass usually includes all four.

## Runtime dependencies

FrameChute packages the browser-side code and vendored libraries it needs with the extension. The Chrome Web Store release gate intentionally forbids a desktop companion or remote executable-code dependency.

---

# Project structure

The exact tree changes as FrameChute grows, but the major areas are:

```text
manifest.json
src/
  workspace.html / workspace.js / workspace.css
  actions/
    quick-actions.js
    image-operations.js
    data-utilities.js
    capture-actions.js
    native-save.js
    document-operations.js
  documents/
    pdf-document.js
    docx-document.js
  image-edit/
  fcx-format.mjs
  fcx-portable.js
  workspace-snapshot.js
  web-drop.js
  drop-local-sources.js
  media / gallery / toolbar / appearance modules
vendor/
assets/
icons/
tests/
scripts/
  package-web-store.sh
agents/codex/prompts/
```

A recurring architectural preference is to extract testable helpers/modules instead of letting `workspace.js` become the implementation of everything.

---

# Current limitations

FrameChute is ambitious, but the project is intentionally honest about where the current browser implementation is still being hardened.

## Image transforms

Several image operations already have raster/export implementations, but some are being unified around a stronger live-preview + undo model so the visible object and saved object can never disagree.

## Screenshot first-frame readiness

The current screenshot path is being hardened because some browser/OS combinations can deliver an unready/black first video frame if capture is sampled too early.

## PDF editing

PDF text replacement is currently a practical cover-and-redraw system, not arbitrary editing of every original PDF object. The current serializer uses a standard replacement font and a simple source cover.

Very large PDFs are not yet handled with the range-loading / virtual-page / bounded-cache architecture needed for Sumatra-like huge-file behavior.

## DOCX fidelity

FrameChute is not a complete Microsoft Word layout engine. It supports a useful subset and tries to preserve untouched OOXML least-destructively where practical.

## Snapshot fidelity

Workspace snapshots can represent local visual objects well, but cross-origin iframes cannot be freely rasterized by browser security rules. Web content may therefore appear as a placeholder. Video snapshotting may use an available poster rather than an arbitrary live frame.

## Archives

Large archive persistence is deliberately bounded. The current archive object path does not embed archives over 100 MB into workspace snapshots.

## Browser APIs

Some Save As, folder, capture, and codec behavior depends on browser/OS support. Chrome/Chromium is the primary target today.

---

# Roadmap

The roadmap follows one rule:

> **Do not build twenty separate applications. Build enough universal primitives that twenty useful workflows emerge.**

The following are directions, not claims about the current release.

## Camera, zoom, and a larger world

Planned spatial/camera work includes:

```text
Ctrl +     zoom in
Ctrl -     zoom out
Ctrl 0     100%
Fit Selection
Fit Workspace
```

Zoom should affect the **camera**, not rewrite object geometry.

The workspace should also become truly expandable beyond the initial viewport in every direction:

> **Push an object against an edge and FrameChute makes more desk.**

Work should be frameable/centerable instead of naturally collapsing toward the upper-left corner.

## Separate workspace UI from workspace zoom

Toolbar, Settings, media controls, Quick Actions, dialogs, and context menus should live in a UI/chrome layer that stays human-readable while the workspace itself zooms.

Quick Actions in particular is expected to evolve toward a floating, movable panel rather than behaving like a viewport-height fixed sidebar.

## Select Mode and region/frame export

The planned distinction is:

```text
Select Mode
→ select actual objects
→ move / group / batch / arrange

Region / Frame tool
→ draw a rectangle in world space
→ export exactly that visual area
```

Region output should support normal image formats and eventually one-page PDF output without depending on the user's current camera zoom.

## Better composition

Planned composition work includes:

- first-class multi-object Select Mode
- marquee selection
- bulk object actions
- selection-specific FrameSnap
- Arrange into PDF
- deterministic page ordering
- region snapshot/export

## Drawing and explanation primitives

FrameChute does not need hundreds of professional illustration tools to become useful for visual explanation.

A small dependable primitive set can unlock a lot:

- rectangle
- ellipse
- line
- arrow
- triangle/polygon
- text box
- panel/frame rectangle
- speech bubble with movable tail
- thought bubble
- better brush size
- hardness
- opacity
- smoothing
- simple brush shapes
- grouping
- align/distribute
- clipping/masks later

Those primitives can support:

- comics
- storyboards
- tutorials
- annotated screenshots
- classroom explainers
- visual notes
- diagrams
- memes
- simple page layouts
- manuals and handouts

A plausible comic workflow is already visible in the substrate:

```text
DOCX script
 ↓
copy dialogue into workspace
 ↓
arrange panel frames + images
 ↓
add speech bubbles / text
 ↓
frame the finished page
 ↓
export image or PDF
```

The goal is not Adobe-level complexity.

The goal is enough reliable primitives that useful complexity can emerge from combination.

## Richer documents and publishing

Longer-term document work can build on the same substrate with stronger Markdown/typography, font handling, print/PDF layout, and richer cross-format conversion while keeping the local-first model.

## Structured data

CSV utilities are the beginning, not the end. A future grid primitive could add cells, formulas, references, sorting/filtering, charts, and spreadsheet-style workflows without requiring a separate application architecture.

---

# Design principles

FrameChute is held together by a few rules.

## 1. If an action feels obvious, support it directly

```text
select the thing
 ↓
do the obvious thing
 ↓
see the result
```

## 2. Files become objects

A PDF, image, video, note, chart, archive entry, and generated result should be able to occupy the same conceptual workspace.

## 3. Results stay usable

The output of one action should be able to become the input to another without a download/re-upload ritual.

## 4. Native files remain native files

Save an image as an image, a PDF as a PDF, a DOCX as a DOCX, and a CSV as a CSV whenever the operation honestly supports it.

`.fcx` exists to preserve the **workspace**, not to replace ordinary file formats.

## 5. Local-first by default

If the browser and the user's computer can perform the operation locally, a server should not be mandatory merely because the software happens to run in a browser.

## 6. The viewport moves. The artwork does not

Passive UI changes are not permission to move the user's work.

## 7. Power should compose from small guarantees

> **Files become objects. Objects become scenes. Scenes can eventually become worlds.**

FrameChute becomes more capable by strengthening universal primitives rather than by accumulating disconnected mini-applications.

---

# What FrameChute is not

FrameChute is not claiming to replace the deepest professional capabilities of Photoshop, Premiere, Word, Acrobat, Excel, Blender, or specialist conversion systems.

It is aimed at a different problem:

> **You should not need a professional suite for every thirty-second file chore.**

A surprising amount of everyday computing is made of small transformations, comparisons, extractions, arrangements, and conversions. FrameChute tries to make those jobs feel like one coherent activity.

---

# In one sentence

**FrameChute is a local-first browser workbench where everyday files become movable, editable, composable objects that can be opened, changed, combined, converted, captured, and saved without bouncing between a pile of separate applications and websites.**

---

# License

See [`LICENSE`](LICENSE) for the repository's licensing terms.

The current repository license is proprietary / all rights reserved rather than an open-source license. Do not assume that public source visibility grants permission to redistribute or create derivative versions outside the rights explicitly granted by the license.

# Codex Request: Elevate FrameChute PDF to a Standard Reader + Editor

## Mission

Bring FrameChute's PDF object up to the same level of seriousness as the DOCX side: a dependable, standards-oriented PDF reader and editor that handles ordinary real-world PDFs the way users reasonably expect.

Do **not** replace the existing PDF implementation wholesale. Inspect it first, preserve what already works, and elevate it into a coherent subsystem.

The target is not Acrobat parity in one pass. The target is a strong, conventional PDF reader/editor with predictable behavior, native PDF interoperability, and an architecture that can continue growing without hacks.

## Existing foundation to preserve and build on

At the time of this request, FrameChute already has meaningful PDF infrastructure, including:

- PDF rendering through PDF.js
- selectable/rendered text layer
- text replacement/editing
- free-text edit geometry
- inserted images
- move/resize for inserted edits
- undo/redo for PDF edits
- standard font/size controls
- page add
- page delete
- page rotate
- page duplicate
- page move/reorder
- page extraction
- PDF merge/insert
- crop margins
- conservative compression
- page/image export
- native PDF save/save-as
- FrameChute workspace persistence around PDF state

Relevant code currently includes at least:

- `src/documents/pdf-document.js`
- PDF handling in `src/workspace.js`
- PDF UI/styles in `src/workspace.html` and `src/workspace.css`

Before changing architecture, inspect the repository for all PDF-related modules, tests, actions, menus, drag/drop integrations, and serialization paths.

## Product principles

### 1. Native PDF first

A PDF opened in FrameChute must remain a normal PDF.

Saving a PDF from FrameChute must produce a conventional PDF that can be opened by ordinary readers and editors such as Chrome, Firefox, Edge, Preview, Acrobat, PDF-XChange, Okular, LibreOffice Draw, etc.

Never require FrameChute metadata for the saved PDF to function.

FrameChute-only transient state may live in the FrameChute workspace format, but must not silently become a proprietary dependency of the PDF.

### 2. Standards and conventional geometry

Use conventional PDF concepts rather than inventing FrameChute-specific PDF mathematics.

Internally, reason in standard PDF page space:

- units: PDF points (1/72 inch)
- page boxes: MediaBox, CropBox, BleedBox, TrimBox, ArtBox where present
- page rotation respected
- PDF origin/coordinate conventions handled consistently
- transforms expressed as normal affine transforms/matrices
- viewport conversion centralized and tested
- zoom is a viewer concern, not stored document geometry

Do not store edit geometry in rendered CSS pixels when PDF-space coordinates can be stored instead.

All edit operations must behave correctly on rotated and cropped pages.

### 3. Preserve what FrameChute does not understand

Visible does not imply editable.

If an existing PDF feature cannot yet be safely edited, render it faithfully if possible and preserve it unchanged.

Never silently flatten, delete, rasterize, rebuild, or discard unsupported PDF structures merely because the current editor cannot manipulate them.

Avoid unnecessary whole-document reconstruction.

### 4. Familiar PDF behavior

A person who has used a normal PDF application should not need to learn a strange FrameChute interpretation of PDF editing.

Use familiar concepts:

- page number
- zoom percentage
- fit page
- fit width
- previous/next page
- search
- select/copy
- thumbnails
- rotate
- crop
- annotations
- text tools
- image tools
- forms
- print/download/save
- document properties

### 5. FrameChute object rules still apply

The PDF remains a FrameChute object.

Do not regress:

- Grab behavior
- header behavior
- initial viewport fitting
- highest-on-open object layering
- Fix to Viewport
- Show Header
- free workspace movement/resizing
- workspace persistence
- object menus
- drag/drop ownership
- file reconnect behavior

The PDF editor's internal page canvas must not fight the outer FrameChute object geometry.

---

# Required architecture pass

Before implementing large UI features:

1. Inventory the current PDF code paths.
2. Identify rendering state, document bytes, page state, edit state, history state, selection state, and UI state.
3. Separate concerns where practical:
   - PDF document model / byte operations
   - page geometry / coordinate conversion
   - renderer
   - text layer
   - annotation/edit overlay
   - page organizer
   - history
   - save/serialization
   - PDF UI controller
4. Do not move code solely for aesthetics. Refactor where it reduces coupling or prevents correctness problems.
5. Add tests around geometry and serialization before expanding destructive operations.

Prefer small composable modules over continuing to grow one giant PDF branch in `workspace.js`.

---

# Reader baseline

FrameChute PDF should provide a competent everyday reader.

## Navigation

Implement or verify:

- previous page
- next page
- first page
- last page
- direct page-number entry
- page count
- Page Up / Page Down behavior where sensible
- Home / End behavior where sensible
- keyboard navigation that does not interfere with editing fields

Page state must persist in FrameChute workspace saves.

## Zoom and fitting

Provide conventional viewer zoom behavior:

- zoom in
- zoom out
- percentage display/input
- Actual Size / 100%
- Fit Page
- Fit Width
- optional Fit Height if cleanly supported
- sensible min/max zoom bounds

Zoom must not mutate PDF edit coordinates.

Respect high-DPI rendering without making logical PDF geometry depend on devicePixelRatio.

## Scrolling / page presentation

Support a clean viewing mode suitable for ordinary documents.

At minimum:

- current single-page view remains solid
- preserve page aspect ratio
- clear page boundaries
- no stretching page content to fill arbitrary frame dimensions
- scroll correctly within the PDF object

If adding continuous-page mode, make it an explicit viewer mode rather than destabilizing current single-page editing.

## Text selection and copy

Users should be able to select and copy ordinary PDF text using the PDF.js text layer where supported.

Editing overlays must not unnecessarily destroy selection behavior.

## Search

Add document text search:

- Ctrl/Cmd+F while PDF object is active
- query field
- next result
- previous result
- current match / total matches
- visible highlight of matches
- search across pages
- jumping to a result changes the displayed page
- escape closes/clears search cleanly

Do not implement search by OCR.

## Thumbnails / page navigator

Add an optional compact page-thumbnails panel or popover:

- thumbnail for each page
- current page indication
- click thumbnail to navigate
- page reorder via a conventional interaction if stable
- avoid expensive full-resolution rendering
- lazy render thumbnails for large PDFs

The PDF object should remain usable on a low-memory machine.

## Document information

Provide a Document Properties / Info view for ordinary metadata where available:

- title
- author
- subject
- keywords
- creator
- producer
- creation date
- modification date
- page count
- page size for current page
- PDF version if available

Allow editing safe metadata fields when supported by the write library.

---

# Editing baseline

## Selection model

Create one predictable PDF selection model.

A user must be able to understand what is selected:

- source text item
- replacement/free-text object
- inserted image
- annotation
- form field
- page

Selection should drive the available toolbar/menu controls.

Escape should clear selection before escaping the outer FrameChute object.

## Undo / redo

All document edits should use one PDF history system.

Include:

- text edits
- free text
- image insertion/removal/move/resize
- annotation creation/deletion/change
- page operations where practical
- crop
- form-field changes where applicable

Use Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z; support Ctrl/Cmd+Y where already established.

Avoid pushing a history entry for every pointermove. Coalesce drag/resize gestures into one undoable action.

## Existing text editing

Elevate current text replacement behavior.

Requirements:

- double-click or explicit Edit Text action
- preserve source text position as closely as possible
- font family mapping among PDF standard fonts
- font size
- bold/italic variants where available
- text color
- rotation
- alignment for FrameChute-added text boxes
- multiline editing for free text
- predictable text-box growth/wrapping
- move/resize edited/free text
- delete/revert edit

Do not pretend arbitrary embedded PDF fonts can always be safely reconstructed.

If the exact original font cannot be embedded/reused, clearly treat the operation as a replacement using an available font rather than corrupting the source.

Keep untouched source content untouched.

## Add text

Provide an explicit Add Text / Free Text tool:

- click page to create
- normal text box
- move
- resize
- font
- size
- color
- bold/italic when supported
- alignment
- rotation
- multiline
- delete
- undo/redo

Saved output must contain real PDF text, not merely a screenshot.

## Images

Build on existing image insertion.

Expected behavior:

- insert PNG/JPEG from local file
- drag/drop compatible images into a PDF page
- move
- resize
- preserve aspect ratio modifier/control
- rotate
- duplicate
- delete
- copy/paste if practical
- layering order among FrameChute-added edits when feasible

Do not degrade the original image unnecessarily on save.

## Basic drawing / markup

Add common PDF markup tools using standard PDF annotations where practical:

- highlight
- underline
- strikeout
- freehand ink
- rectangle
- ellipse
- line
- arrow if cleanly representable
- note/comment
- text box/free-text annotation if compatible with architecture

Controls should include appropriate basics such as:

- color
- opacity
- stroke width
- fill where meaningful

Prefer standard PDF annotation objects over burning marks irreversibly into page graphics.

Render existing common annotations when PDF.js exposes them.

## Links

At reader level:

- existing hyperlinks should be clickable safely
- internal page links should navigate within the PDF
- external links should use safe browser behavior

At editor level, if practical in this pass:

- create/edit/remove link rectangles
- URL links
- internal page destination links

Do not invent a nonstandard link representation.

## Redaction

If implementing redaction, distinguish clearly between:

- visual covering/markup
- actual destructive redaction

A true Apply Redactions action must remove or irreversibly obscure underlying content to the extent the chosen PDF library can guarantee.

Never label a white rectangle as secure redaction.

If secure redaction cannot be guaranteed, expose only a clearly named visual mask/cover feature and leave true redaction for a later milestone.

---

# Forms

Support ordinary AcroForm interaction where the libraries allow it.

Reader:

- show form fields
- allow filling text fields
- checkboxes
- radio buttons
- dropdowns / choice fields
- buttons where meaningful

Editor:

- preserve existing fields
- saving filled values must produce a normal filled PDF
- optionally expose a Form mode for adding basic fields if this can be done without destabilizing the core editor

Do not discard AcroForm structures on unrelated saves.

XFA is out of scope unless existing libraries already support it safely.

---

# Signatures

Do not implement cryptographic digital signatures casually.

A simple visual signature/stamp feature may be supported as an inserted annotation/image and must be labeled accordingly.

Cryptographic PDF signing requires a separate design covering certificates, ByteRange handling, incremental save semantics, trust, and signature validation.

Existing signatures in PDFs must be preserved when possible. Any edit that invalidates a cryptographic signature should not be represented as preserving its validity.

---

# Page organization

Build a conventional page organizer around the operations FrameChute already has.

Expected page actions:

- add blank page
- delete page
- duplicate page
- rotate clockwise/counterclockwise
- move/reorder page
- extract selected pages
- insert pages from another PDF
- merge another PDF
- split by page ranges
- crop
- page size information
- optionally resize page only if semantics are clear

For multi-page operations, permit ranges such as:

- `1-3`
- `1,4,7-9`
- all
- odd
- even

Validate ranges before modifying bytes.

Never allow deleting the only remaining page.

## Crop

Respect page boxes.

Cropping should use CropBox semantics rather than destructively deleting content unless the user explicitly asks for a destructive trim feature in the future.

Provide:

- per-page crop
- apply same crop to selected/all pages
- numeric margins
- visual crop handles later if cleanly implementable

---

# Import / export / save

## Save

Maintain FrameChute's native-file principle:

- Save writes a normal PDF
- Save As writes a normal PDF
- edits survive reopen in third-party PDF readers
- no FrameChute dependency

## Preserve original structures

Unrelated saves should preserve as much untouched PDF structure as the current libraries permit, including:

- unedited pages
- annotations
- outlines/bookmarks
- metadata
- form fields
- attachments
- links
- page boxes
- rotations
- embedded assets
- optional content/layers where the library can round-trip them

If a chosen library cannot preserve a class of structures during a rewrite, document that limitation and avoid triggering that rewrite for unrelated operations.

## Export

Keep and polish existing page image export.

Useful conventional export actions:

- current page as PNG/JPEG
- selected/all pages as images
- extract pages to a new PDF
- text extraction where PDF text exists

OCR is not required for this milestone.

## Print

Provide a conventional Print action using a safe browser/native flow where feasible.

Do not create a custom raster print pipeline unless necessary.

---

# Bookmarks / outline

Reader support should include existing PDF outline/bookmarks where PDF.js exposes them:

- display outline in a compact panel
- click item to navigate
- support nested outline entries

Editing outlines/bookmarks is a later enhancement unless it is straightforward with the current write stack.

---

# Attachments

If PDF.js exposes embedded file attachments:

- show a compact attachments list
- allow user-initiated extraction/download of an attachment

Do not execute embedded files.

Editing/adding attachments can be a later milestone.

---

# Passwords / encryption

Handle encrypted PDFs gracefully.

At minimum:

- allow PDF.js/password callback flow for PDFs the user has a password for
- show a comprehensible password prompt
- wrong-password state should be recoverable
- do not pretend protected PDFs are corrupted

Before editing/saving encrypted PDFs, inspect whether current libraries can preserve encryption.

Do not silently remove encryption or permissions on save.

If encryption-preserving edits are not supported, disable unsafe save operations with a clear explanation rather than producing a deceptively unprotected replacement.

---

# Performance and robustness

FrameChute must remain viable on lower-end hardware.

Requirements:

- lazy page/thumbnail rendering
- cancel obsolete PDF.js render tasks when page/zoom changes
- do not rasterize every page at once
- avoid keeping giant decoded bitmaps alive
- release object URLs/resources
- avoid cloning the entire PDF byte array repeatedly inside pointer gestures
- debounce expensive rerenders
- keep edit overlays lightweight
- test larger documents

Rendering failure on one page should not destroy the FrameChute workspace.

---

# UI direction

Do not create a giant always-visible Acrobat clone.

Use a compact PDF toolbar consistent with FrameChute.

Suggested primary row:

- previous
- page number / count
- next
- zoom out
- zoom %
- zoom in
- fit menu
- search
- select/edit mode
- Add Text
- Annotate
- Pages
- More

Put less-frequent actions into compact menus/popovers:

- page organizer
- insert image
- crop
- merge/extract/split
- metadata
- export
- print
- document properties

Use text labels when room exists and compact icons when necessary, consistent with FrameChute's responsive toolbar philosophy.

Do not introduce ugly permanent horizontal scrollbars merely to fit every PDF command.

---

# Keyboard expectations

Where they do not conflict with browser or text editing:

- Ctrl/Cmd+F: PDF search
- Ctrl/Cmd+Z: undo
- Ctrl/Cmd+Shift+Z: redo
- Ctrl/Cmd+Y: redo
- Delete/Backspace: delete selected editable PDF object
- Escape: leave edit mode/clear PDF selection first
- +/-: zoom when PDF viewer has appropriate focus
- Ctrl/Cmd+0: 100% or Fit behavior only if conventional and unambiguous
- arrow keys: nudge selected FrameChute-added edit
- Shift+arrow: larger nudge

Do not steal global shortcuts when an input/contenteditable field is active unless that behavior is explicitly expected.

---

# Serialization rules

Establish a documented PDF edit model.

Every editable overlay object should have:

- stable ID
- page number
- kind
- PDF-space geometry
- rotation
- style
- content/payload
- z/order if relevant

Do not use PDF.js text-item array index as the sole long-term identity for user-created objects.

Source-text replacement may reference source text items, but should retain enough original geometry/content information to remain understandable and recoverable.

FrameChute workspace persistence may retain richer reversible edit history than the final PDF itself.

Saving to PDF should compile that edit model into standard PDF constructs.

---

# Testing

Add automated tests for the parts that can be tested without browser screenshots.

At minimum:

## Geometry

- viewport -> PDF -> viewport round trip
- rotated pages 0/90/180/270
- CropBox offsets
- resize geometry
- movement/nudge geometry
- zoom independence

## Page operations

- add
- delete
- duplicate
- move
- rotate
- extract
- merge
- crop
- page ranges

## Serialization

- unchanged PDF can be opened after round trip
- text added remains extractable/searchable
- inserted image remains present
- unedited pages remain intact
- existing metadata survives unrelated edit where supported
- existing annotations/forms survive unrelated edit where supported
- page count and boxes preserved

## History

- add -> undo -> redo
- edit text -> undo
- move/resize one gesture -> one undo item
- page operation history if implemented in the common history layer

## Regression

Preserve tests for existing PDF functionality.

The repository's current GitHub workflow validates manifest, JavaScript syntax, package build, and package inspection. If Node/browser unit tests exist, run them explicitly as well; do not assume the packaging workflow executes them.

---

# Implementation strategy

Do not try to land everything as one enormous unsafe commit.

Use staged milestones, keeping `main` working after each milestone.

Recommended order:

### Milestone 1 — architecture + reader polish

- inventory/refactor seams
- coordinate/geometry tests
- navigation
- zoom/fits
- search
- thumbnails
- outline
- metadata/properties
- rendering task cancellation/performance

### Milestone 2 — coherent editing core

- stable PDF edit model
- selection
- unified history
- Add Text
- elevate text replacement
- image editing polish
- colors/alignment/rotation
- keyboard behavior

### Milestone 3 — annotations

- highlight/underline/strikeout
- ink/shapes
- notes/comments
- existing annotation rendering/preservation

### Milestone 4 — page/document tools

- organizer UI
- ranges
- merge/split/extract
- crop workflow
- metadata editing
- print/export polish

### Milestone 5 — forms and difficult-file hardening

- AcroForm filling/preservation
- encrypted/password PDFs
- signed PDF preservation warnings
- large/odd/rotated/cropped PDF fixtures
- unsupported-feature preservation audit

If a milestone reveals that the current write library cannot safely preserve important standard PDF structures, stop and document the limitation before introducing a destructive workaround. Evaluate a narrowly scoped library addition only if necessary and appropriate for a Chrome extension, including license, bundle size, browser compatibility, and low-memory impact.

---

# Acceptance standard

The PDF side is considered elevated when a user can open an ordinary PDF and reasonably expect to:

1. read and navigate it comfortably;
2. zoom and fit pages conventionally;
3. select/copy and search text;
4. inspect thumbnails/bookmarks/properties;
5. make common text and image edits;
6. add text and ordinary markup;
7. undo and redo edits;
8. organize pages;
9. merge/extract/crop common documents;
10. fill common forms where supported;
11. save a normal interoperable PDF;
12. reopen that result in FrameChute and third-party readers;
13. retain unsupported/untouched content rather than silently losing it.

The implementation should feel like **FrameChute has a real PDF subsystem**, not a collection of disconnected PDF buttons.

---

# Instructions to Codex

Start by reading this file and then inspect the actual current repository. Do not assume this brief's snapshot of existing functionality is exhaustive.

Produce a short implementation plan based on the current code, then begin Milestone 1.

You are authorized to improve/refactor PDF-specific code where necessary, but:

- do not redesign unrelated FrameChute systems;
- do not regress DOCX;
- do not regress object placement/dragging/viewport behavior;
- do not change native-file philosophy;
- do not introduce proprietary PDF state into saved PDFs;
- do not silently discard unsupported PDF structures;
- keep low-end Chromium performance in mind;
- commit coherent stages rather than one monolithic rewrite;
- validate each stage before proceeding.

When an existing feature already satisfies a requirement, preserve it and integrate it into the standardized architecture rather than rebuilding it for novelty.

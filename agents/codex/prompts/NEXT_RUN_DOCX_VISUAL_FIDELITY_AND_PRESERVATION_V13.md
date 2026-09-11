# NEXT RUN V13 — DOCX VISUAL FIDELITY + PRESERVATION SUMMIT

## Authority / starting point

Work in repository:

`thanks-cohn/framechute`

Start from the latest `main` after PR #58.

Read first:

1. `agents/codex/prompts/NEXT_RUN_DOCX_FIRST_PDF_MAX_STANDARDIZATION_V12.md`
2. `src/documents/docx-document.js`
3. the DOCX rendering/editor path that consumes `parseDocx()`
4. the DOCX Save / Save As path and current tests touching DOCX

Treat this V13 prompt as the single authoritative prompt for this run where anything conflicts.

This is an **implementation run**, not a planning/audit-only run. Do not merely add another prompt, TODO list, capability matrix, or debug note. Make material changes to the actual DOCX parser/model/renderer/preservation/serializer and tests.

Do **not** spend this run expanding PDF, WEBX, Canvas, media, 3D, game logic, menus, or unrelated features unless a tiny regression fix is strictly required to keep the DOCX implementation working.

Use the available runtime aggressively. If full coverage cannot be completed in one run, implement the broadest high-value vertical slices possible and leave a precise handoff. Do not stop just because existing tests are green.

---

# Mission

Make FrameChute a **broad, trustworthy DOCX viewer first and editor second**.

The target user experience is:

> **Open a DOCX and SEE essentially everything a normal Word document contains, even when FrameChute cannot edit every object yet.**

Editing breadth is secondary in this run. Display breadth and preservation are primary.

The product law is:

> **Show almost everything. Preserve nearly everything. Edit what FrameChute can serialize safely. Never silently make visible source content disappear.**

A user should be able to open a rich DOCX containing unusual Word constructs and feel that the document is still there.

---

# P0 — NO SILENTLY MISSING DOCX CONTENT

Every source construct that contributes visible or meaningful document content must end up in one of these explicit capability classes:

```text
editable
readOnlyRenderable
preservedFallback
unsupportedPreserved
```

Meaning:

1. **editable** — FrameChute can render, edit, and serialize it safely.
2. **readOnlyRenderable** — FrameChute can render it faithfully enough but should not permit destructive editing.
3. **preservedFallback** — FrameChute cannot natively render the structure, but the DOCX provides an alternate/fallback/preview representation that can be displayed safely.
4. **unsupportedPreserved** — no useful visual fallback exists; show a compact explicit placeholder instead of making the object vanish, and preserve the underlying OOXML/relationships/package parts.

Hard rule:

> **There must be no fifth state called “silently omitted.”**

Unknown body children, DrawingML objects, fields, embedded objects, revision wrappers, content controls, or other constructs may not simply disappear from the user-visible document because FrameChute does not understand them.

---

# P0 — AUDIT AND FIX THE CURRENT LOSS POINTS

Start by tracing the actual current pipeline:

```text
DOCX ZIP
-> parseDocx()
-> canonical/model blocks
-> DOM/document renderer
-> edits
-> serializer
-> DOCX ZIP
```

Audit `src/documents/docx-document.js` carefully.

The current parser already handles some paragraphs, runs, images, styles, math and tables, and stores raw body children. Build on that rather than replacing working behavior.

Specifically verify and correct these classes of failure:

- body children that are recorded as `preserved` but not visibly represented;
- preserved/raw structures that may be dropped by serialization;
- paragraph child elements that are skipped because the walker only knows a small whitelist;
- field instructions/results that vanish or flatten incorrectly;
- tracked-change wrappers whose visible content is lost or whose revision semantics disappear;
- content controls and smart tags that lose their visible content or identity;
- table properties/merges/grid structure that are discarded;
- numbering that stores definitions but does not resolve actual displayed labels/counter state;
- drawings/text boxes/shapes/charts/SmartArt/OLE that are ignored because they are not simple raster images;
- headers/footers/notes/comments that are not part of the current body-only rendering path.

Do not paper over these with screenshots of the whole document. Keep the document structurally meaningful wherever possible.

---

# P0 — DISPLAY-FIRST RENDERING FALLBACK LADDER

For every DOCX artifact, use this exact preference order:

## 1. Native semantic rendering

Render the actual structure in FrameChute using DOM/CSS/SVG/MathML/canvas as appropriate.

Use this for things FrameChute understands well enough to display faithfully.

## 2. Native read-only rendering

If the structure is understood visually but editing would be unsafe, render it read-only.

Read-only must be a first-class success state, not an error.

The UI may indicate that the object is preserved/read-only, but it should look like document content rather than a broken warning whenever possible.

## 3. Existing OOXML fallback / preview

Honor safe source-provided fallback content, including where applicable:

- `mc:AlternateContent` / `mc:Fallback`;
- preview images;
- embedded raster/vector fallback representations;
- cached field results;
- cached chart/diagram previews;
- VML or DrawingML alternate representations.

Prefer the representation that most closely matches what Word would visibly show.

## 4. Explicit preserved placeholder

Only when no faithful rendering path or fallback exists.

The placeholder should be compact and useful, for example:

```text
[Embedded Excel object — preserved]
[SmartArt diagram — preserved]
[Unsupported drawing object — preserved]
```

It must not expose raw XML to ordinary users.

It must preserve the original package parts and relationships.

---

# P0 — DOCX ARTIFACT COVERAGE TARGET

The goal is extremely broad viewing support. Cover as many of these classes as technically practical in this run, prioritizing common visible artifacts first.

## A. Text, runs and character formatting

Render/preserve:

- normal text;
- bold / italic / underline / double underline where practical;
- strike / double strike;
- font family and size;
- theme fonts;
- font color;
- highlight;
- shading;
- superscript / subscript;
- small caps / caps where practical;
- character spacing / kerning where practical;
- hidden text without accidentally exposing it as normal visible body text;
- soft hyphen;
- nonbreaking hyphen;
- nonbreaking space;
- tabs;
- line breaks;
- symbols / `w:sym`;
- language/direction metadata where it affects rendering;
- RTL / bidi runs where practical.

Do not flatten unsupported run properties in a way that destroys them on Save As.

## B. Paragraph formatting and styles

Render/preserve:

- paragraph styles and based-on inheritance;
- headings;
- alignment;
- left/right/first-line/hanging indents;
- before/after spacing;
- line spacing;
- borders;
- shading;
- tab stops and leaders where practical;
- keep-with-next / keep-lines;
- widow/orphan control;
- page-break-before;
- explicit page breaks;
- contextual spacing where practical;
- outline level.

## C. Numbering and generated labels

This remains a P0 regression.

Resolve actual visible numbering, not just list metadata.

Support/preserve:

- decimal;
- decimalZero / zero-padded variants where present;
- lower/upper Roman;
- lower/upper letters;
- bullets;
- arbitrary `w:lvlText` patterns such as `[%1]` and `[Claim %1]`;
- nested/multilevel numbering;
- continuation;
- restart;
- `start`;
- `startOverride`;
- `lvlOverride`;
- style-linked numbering;
- legal numbering where practical.

Maintain counter state across paragraphs.

Known acceptance examples include:

```text
[0001]
[0015]
[0016] [Math. 1]
[0017] [Math. 2]
[0019] [Table 1]
[Claim 1]
[Claim 2]

1.
  i.
  ii.
a.
b.
4.
```

Do not hard-code these strings. They must emerge from generic OOXML numbering semantics.

## D. Fields and generated/cached results

Preserve field structure and visibly render the stored/cached result where present.

Cover common fields such as:

- PAGE;
- NUMPAGES;
- DATE / TIME;
- SEQ;
- REF;
- PAGEREF;
- HYPERLINK;
- TOC;
- TOA;
- INDEX;
- caption sequences;
- document properties;
- simple `fldSimple` fields;
- complex `fldChar begin/separate/end` fields.

Rules:

- display cached/stored field result when recalculation is unsupported;
- recalculate only fields FrameChute can calculate correctly;
- do not replace a field permanently with plain text during unrelated edits;
- do not show field instruction code as ordinary body text unless the user explicitly asks for it.

## E. OMML / equations

FrameChute already has an OMML parser foundation. Expand and stabilize it.

Render/preserve common:

- fractions;
- superscripts/subscripts;
- combined subscript/superscript;
- radicals;
- n-ary operators;
- delimiters;
- accents;
- bars;
- group characters;
- functions;
- limits;
- matrices;
- equation arrays;
- boxes/border boxes;
- phantom content;
- special mathematical glyphs;
- display vs inline math.

If direct editing is unavailable, render read-only and preserve the exact original OMML subtree.

Equations must never simply disappear because one construct is unknown. Unknown OMML should degrade to the closest preserved readable representation or placeholder while keeping the source XML.

## F. Tables

Upgrade tables from a text-grid approximation to structurally aware rendering.

Render/preserve:

- `tblGrid`;
- rows/cells;
- `gridSpan`;
- `vMerge`;
- column widths;
- cell widths;
- row heights;
- borders;
- cell shading;
- cell margins;
- horizontal and vertical alignment;
- nested paragraphs;
- nested lists;
- nested tables where practical;
- table alignment/indent;
- repeated header rows where practical;
- table captions/descriptions where present;
- cell text formatting.

A merged Word table must look recognizably like the original merged table.

Do not collapse table structure into detached paragraphs or one-cell pseudo-tables.

## G. Images and drawings

Render/preserve:

- inline images;
- floating/anchored images;
- position/size;
- crop;
- rotation where present;
- wrap mode;
- behind/in-front;
- alt text/title/description;
- common raster images;
- SVG when browser-safe;
- legacy VML image representations.

Distinguish the outer FrameChute object frame from the DOCX drawing geometry.

## H. DrawingML shapes / text boxes / lines / callouts / groups

These must not vanish.

Implement a lightweight read-only renderer for common DrawingML primitives where practical:

- rectangles;
- rounded rectangles;
- ellipses;
- lines;
- arrows;
- basic preset geometry;
- fill;
- outline;
- rotation;
- text boxes;
- grouped shapes;
- basic transforms.

SVG is an appropriate browser rendering target for many of these.

If exact geometry is not supported, use a safe fallback/preview or preserved placeholder.

Do not convert the underlying object to a raster image on Save As unless the user explicitly performs a flatten/export operation.

## I. Charts

Charts should at least be visible.

Preferred order:

1. render a faithful chart from chart XML + workbook/cache data when practical;
2. otherwise use an embedded/cached chart preview if available;
3. otherwise show a preserved chart placeholder.

Preserve the chart parts, embedded workbook/data, style/color parts and relationships.

Do not pretend chart editing is supported unless it really is.

## J. SmartArt / diagrams

At minimum:

- detect them;
- display existing fallback/preview imagery where available;
- otherwise display a preserved read-only placeholder;
- keep diagram data/layout/style/color parts and relationships untouched.

Never make SmartArt disappear because FrameChute cannot edit it.

## K. WordArt / text effects

Render a recognizable approximation where practical:

- transformed text;
- outline;
- fill;
- shadow;
- rotation.

Preserve unsupported effects.

## L. Headers / footers / page decorations

Render/preserve:

- default header/footer;
- first-page variants;
- even/odd variants;
- page-number fields;
- text/images/tables inside headers and footers;
- section-specific references;
- basic page borders where practical.

A DOCX with visible header/footer content must not look like that content vanished.

## M. Footnotes / endnotes

Render them in a recognizable document-view form:

- superscript/reference marker in body;
- note content at page/end section or a practical read-only note panel if true pagination is not ready.

Preserve note IDs, parts and relationships.

## N. Comments / annotations

At minimum:

- preserve comment range anchors and comment parts;
- render a visible comment indicator;
- provide readable comment author/text in a side panel/popover or equivalent;
- do not strip comments during unrelated edits.

Editing comments is optional for this run.

## O. Tracked changes / revisions

Never silently accept or reject revisions.

Recognize/preserve/render:

- insertions;
- deletions;
- moved-from / moved-to where practical;
- revision metadata such as author/date where available;
- formatting-change wrappers where practical.

A simple readable revision style is acceptable.

The critical requirement is that revision semantics remain visible and preserved.

## P. Content controls / structured document tags

Render the visible contents normally.

Preserve:

- SDT wrapper;
- alias/title/tag metadata;
- lock state;
- dropdown/checkbox/date semantics where safely detectable.

Full editing controls are optional. Visibility and preservation are not.

## Q. Hyperlinks, bookmarks and cross-references

Render/preserve:

- external hyperlinks;
- internal anchors;
- bookmarks;
- REF/PAGEREF cached results;
- tooltip where practical.

Keep the current editor interaction law where applicable: normal click edits/selects; Shift+Click follows a link.

## R. Sections, page geometry and columns

Render/preserve:

- section boundaries;
- page size;
- portrait/landscape;
- margins;
- multiple sections with different geometry;
- multi-column sections where practical;
- section-specific headers/footers;
- page breaks.

If exact pagination is not yet possible, preserve the structure and provide the closest faithful page-flow layout rather than flattening it away.

## S. Embedded / linked objects and OLE

Safety rule: do not execute embedded active content.

For OLE/package objects:

- detect and preserve;
- display an existing preview/icon/fallback if available;
- otherwise show a compact preserved placeholder;
- retain the embedded package/object bytes and relationships.

Examples include embedded Excel/PowerPoint/Visio objects.

## T. AlternateContent, compatibility markup and unknown extensions

Implement `mc:AlternateContent` handling:

- prefer a Choice FrameChute understands;
- otherwise use Fallback;
- preserve the entire original structure on round-trip.

Unknown extension content must remain in the package unless the user explicitly deletes that object.

---

# P0 — HEADERS, FOOTERS, NOTES, COMMENTS AND RELATIONSHIPS ARE REAL CONTENT

Do not limit “document content” to `word/document.xml`.

Build a reusable relationship/part resolver capable of loading relevant parts from:

- `word/header*.xml`;
- `word/footer*.xml`;
- `word/footnotes.xml`;
- `word/endnotes.xml`;
- `word/comments.xml`;
- chart parts;
- drawing/diagram parts;
- embedded object parts;
- media;
- related `.rels` files.

Resolve relationships relative to the owning part, not only `document.xml.rels`.

This is necessary for images in headers, charts, comments-related artifacts, and other non-body content.

---

# P0 — PRESERVATION / SAVE AS MUST BE NON-DESTRUCTIVE

Viewer fidelity is not useful if opening and saving destroys unsupported content.

Hard preservation rules:

- untouched ZIP parts should remain byte-identical whenever practical;
- untouched XML subtrees should remain unchanged whenever practical;
- unknown package parts must not be discarded;
- unknown relationships must not be discarded;
- `AlternateContent` must not be flattened destructively;
- comments/revisions/fields/content controls must survive unrelated text edits;
- embedded objects must survive;
- chart/SmartArt parts must survive;
- headers/footers/notes must survive;
- unsupported body children must survive.

When the user edits ordinary text, mutate only the structures required by that edit.

Do not regenerate a complicated source document from only the simplified visible model.

If the current serializer architecture makes that impossible, refactor toward an edit-minimizing patch/preservation model rather than accepting destructive save behavior.

---

# P0 — RENDERING ARCHITECTURE

Do not let `docx-document.js` become a single unmaintainable switch statement.

It is acceptable and encouraged to introduce focused modules such as:

```text
src/documents/docx/
  relationships.js
  numbering.js
  fields.js
  math.js
  tables.js
  drawings.js
  notes.js
  comments.js
  revisions.js
  renderer.js
  preservation.js
```

Exact filenames are flexible.

Prefer small pure functions for:

- QName/local-name matching;
- relationship resolution;
- numbering counter state;
- OOXML length/unit conversion;
- field state machines;
- AlternateContent selection;
- artifact classification;
- table merge resolution;
- drawing geometry extraction.

Avoid a second competing DOCX model. Evolve the current canonical model.

---

# P0 — ARTIFACT INVENTORY / DIAGNOSTICS

Add an internal artifact inventory during parsing so tests and debugging can prove that content was seen.

For example:

```js
model.artifacts = [
  { kind: "paragraph", capability: "editable", ... },
  { kind: "equation", capability: "readOnlyRenderable", ... },
  { kind: "chart", capability: "preservedFallback", ... },
  { kind: "ole", capability: "unsupportedPreserved", ... }
]
```

The exact structure may differ.

This is not primarily a user-facing debug panel. It is a correctness tool.

Tests should be able to assert:

> source contained 2 equations, 1 chart, 3 comments and 1 embedded object, and FrameChute accounted for all of them.

No artifact-count mismatch should be silently ignored.

---

# REQUIRED TEST CORPUS

Create a deterministic repository-local DOCX fidelity corpus or test fixture generator.

Do not rely solely on hand inspection.

At minimum cover:

1. rich run formatting;
2. multiple paragraph styles;
3. generated padded numbering;
4. custom `[Claim %1]` numbering;
5. nested decimal/Roman/letter lists;
6. simple and complex fields;
7. at least five structurally different OMML constructs;
8. merged table cells horizontally and vertically;
9. nested table;
10. inline image;
11. anchored/floating image;
12. basic DrawingML shape;
13. text box;
14. header with text/image;
15. footer with PAGE field;
16. footnote;
17. endnote;
18. comment;
19. tracked insertion/deletion;
20. content control;
21. bookmark + internal reference;
22. `mc:AlternateContent` with fallback;
23. preserved unknown extension/body artifact;
24. an embedded package/OLE placeholder case;
25. chart/diagram fallback case where practical.

Handcraft small OOXML fixture packages where necessary. They do not need to originate from Microsoft Word if the package is standards-valid and deterministic.

Add at least one “kitchen sink” fixture that contains many artifact classes in one file.

---

# VISUAL ACCEPTANCE GATE

Tests must prove more than “the parser did not throw.”

For important artifact classes, assert the rendered document contains recognizable visible output.

Examples:

- generated number appears before its paragraph;
- equation DOM contains expected operators/fraction structure;
- merged table has correct rowspan/colspan semantics;
- header/footer are visible;
- comment indicator exists;
- deleted tracked text is visibly distinguishable;
- text box/shape is visible;
- chart/SmartArt/OLE fallback does not vanish;
- unsupported preserved object has an explicit placeholder.

Where browser integration testing is unavailable, isolate render-to-DOM/HTML functions so they can be tested deterministically.

---

# ROUND-TRIP ACCEPTANCE GATE

For every fixture:

```text
parse
-> render
-> make one unrelated ordinary editable-text change
-> Save As
-> reopen saved DOCX
-> re-inventory artifacts
```

Assert:

- artifact classes/counts remain accounted for;
- untouched package parts remain present;
- unknown parts remain present;
- relationships remain valid;
- comments/revisions/fields remain;
- header/footer/note parts remain;
- chart/diagram/OLE parts remain;
- equations remain;
- numbering definitions remain;
- the edited text changed exactly where expected.

For untouched binary parts such as images/embedded packages, compare bytes/hashes.

For untouched XML parts, prefer exact byte preservation where architecture permits; otherwise perform structural assertions that prove the subtree/data survived.

---

# KNOWN SAMPLE-DOCUMENT REGRESSION TO SOLVE

A Word document used during this work visibly contains paragraph labels and artifacts such as:

```text
[0015] ordinary paragraph
[0016] [Math. 1] + equation
[0017] [Math. 2] + equation
[0018] ordinary paragraph
[0019] [Table 1] + merged table
[0020] [Table 2]
[0022] [Chem. 1]
[Claim 1] ...
[Claim 2] ...
```

The target is that FrameChute no longer loses generated labels, equations, structured tables, chemical/drawing artifacts, or claim numbering merely because those structures are more complex than plain text.

Do not special-case these literal labels. Fix the general OOXML mechanisms.

---

# SAFETY

Never execute:

- macros;
- ActiveX;
- OLE executable content;
- embedded scripts;
- external code.

External links remain inert during normal editing and follow the existing deliberate navigation behavior.

External linked images/objects should not silently fetch untrusted remote content merely to render a DOCX. Prefer embedded/cached representations unless the product already has an explicit safe user-approved fetch path.

---

# REGRESSION PROTECTION

Do not regress existing working DOCX behavior:

- ordinary text editing;
- formatting controls;
- headings;
- page setup;
- lists;
- hyperlinks;
- image insertion;
- image resize/wrap/free placement;
- Undo/Redo;
- Save / Save As;
- DOCX-native context menu;
- internal image drag ownership / no global ingest overlay.

Do not regress the object-menu ordering or image Save As behavior merged in PR #58.

---

# EXECUTION PRIORITY

Work in this order:

1. map current DOCX parse -> render -> save loss points;
2. introduce reusable part/relationship resolution beyond document.xml;
3. implement visible artifact accounting and the no-silent-omission fallback path;
4. fix numbering display/counter resolution;
5. stabilize/expand OMML rendering;
6. upgrade table structure and merges;
7. render fields/cached results;
8. render headers/footers;
9. render notes/comments/revisions/content controls;
10. render common DrawingML/text boxes/shapes;
11. add chart/SmartArt/OLE fallback handling;
12. harden AlternateContent/unknown-part preservation;
13. add deterministic fidelity corpus + visual assertions;
14. add round-trip preservation assertions;
15. run the complete repository gate.

If runtime runs short, prioritize **visible coverage + preservation** over editability.

---

# REQUIRED VALIDATION

Run at minimum:

```text
node --test tests/*.test.mjs
node --check <every touched JS/MJS file>
git diff --check
bash scripts/package-web-store.sh
```

Add focused DOCX tests rather than relying only on the existing suite.

If a browser/manual test environment is available, open the kitchen-sink fixture and inspect it visually.

Do not claim Word/LibreOffice manual verification unless actually performed.

---

# COMPLETION STANDARD

This run is successful only if actual DOCX implementation code changes.

A prompt-only, documentation-only, menu-only, or test-only PR is not completion.

The resulting PR should materially increase the number of DOCX artifact classes FrameChute can:

1. detect;
2. display;
3. preserve through Save As.

The handoff must include a table like:

```text
Artifact                 Display                 Edit             Save/Preserve
Paragraph                native                  yes              yes
OMML equation            native/read-only        no/partial       exact preserved
Merged table             native                  basic            yes
Comment                  indicator + panel       no               yes
SmartArt                 fallback/placeholder    no               yes
OLE object               preview/placeholder     no               yes
...
```

Also report:

- branch and head SHA;
- PR number;
- files changed;
- new DOCX modules/primitives;
- artifact classes newly visible;
- artifact classes still placeholder-only;
- exact preservation guarantees implemented;
- tests and results;
- manual checks actually performed;
- remaining P0 visual omissions;
- any known data-loss risk;
- exact next highest-leverage continuation.

Leave the branch coherent, buildable, and reviewable.

# NEXT RUN V4 — post-PR51 spatial/document creation pass + WEBX package standard

Start from the latest `main`. Read and execute `agents/codex/prompts/NEXT_RUN_POINT_CONTEXT_AND_FOUR_DIRECTION_CANVAS_V3.md`, then apply this V4 as the authoritative override. If there is any conflict, V4 wins.

Use up to 30 minutes. At the 30-minute mark, **conclude active implementation and provide a handoff**.

## Naming correction: LightComp is the system/editor; `.webx` is the file format

Do not use `LightComp` as the document extension or serialized file type.

Product model:

```text
LightComp
= FrameChute's lightweight web-first authoring/editing system

.webx
= the portable web-ready document/package produced and opened by LightComp
```

User-facing creation should therefore be:

```text
New ▾
  WEBX
  DOCX
  PDF
```

It is acceptable for supporting copy to say `WEBX (LightComp)` or `LightComp WEBX`, but the file extension and actual save target must be `.webx`.

PDF and DOCX conversion menus should likewise be:

```text
Convert ▾
  WEBX
  DOCX
  PDF
```

The current format remains disabled/no-op rather than producing meaningless duplicates.

---

# P0 — `.webx` is a portable ZIP-like web composition package

Treat `.webx` as an archive/package, conceptually similar to a ZIP container, whose contents are directly useful for web deployment and for interchange with web-oriented editors/publishing tools.

A good V1 package contract is:

```text
example.webx
├── manifest.json
├── index.html
├── styles.css
├── app.js
├── content.md            # optional but strongly preferred semantic source
└── assets/
    ├── image-1.png
    ├── image-2.svg
    └── ...
```

The exact internal filenames may evolve, but V1 must establish a deterministic documented package layout and versioned manifest.

`manifest.json` should identify at minimum:

```text
format: "webx"
version
entryHtml
styleSheets
scripts
assets
semanticSource?   # e.g. content.md
createdWith: "LightComp" / "FrameChute"
```

Do not make `.webx` depend on opaque runtime state that only FrameChute understands.

Core promise:

> **Unpack a `.webx` and you already have normal web files.**

That means a technically capable user should be able to rename/copy/extract the package and see ordinary HTML/CSS/JavaScript/assets without a proprietary decode step.

---

# P0 — web deployment readiness

A saved `.webx` must be useful as a deployment artifact, not just an editor project.

At minimum, it should support:

```text
.webx
→ unpack
→ static web folder
→ host on ordinary static hosting
```

Target output should work without FrameChute-specific servers or APIs unless the document explicitly uses an advanced feature that requires them.

V1 should favor self-contained, relative-path, static-site-friendly output:

- `index.html` as the obvious entry point;
- local `styles.css`;
- local `app.js` only when behavior is actually needed;
- assets stored under `assets/` with relative references;
- no remote executable-code dependency required for basic documents;
- no extension-only URLs inside saved content;
- no hidden dependency on IndexedDB/local browser state.

If JavaScript is unnecessary for a document, the package may contain an empty/minimal script or omit it according to the manifest. Prefer the simplest honest output.

---

# P0 — semantic source + rendered web output should coexist

The `.webx` format should preserve both:

```text
semantic authoring source
        +
ready-to-run web representation
```

Recommended V1 shape:

```text
content.md / CommonDocument semantics
        ↓
renderer
        ↓
index.html + styles.css + app.js + assets
```

This lets LightComp remain Joplin-like and easy to edit while still making every save immediately web-ready.

Do not make `index.html` the only source of truth if doing so would make later editing/conversion unnecessarily lossy.

The CommonDocument/semantic bridge from V3 remains the shared intermediary for DOCX/PDF/WEBX conversion.

Updated architecture:

```text
PDF ─────┐
DOCX ────┼→ CommonDocument → WEBX package
WEBX ────┘                  → DOCX
                            → PDF
```

For WEBX, CommonDocument should preserve at least paragraphs, headings, bold/italic/underline, lists, links, line breaks, basic alignment, images/assets, and simple tables where supported.

---

# P0 — standardization/interoperability direction

Design `.webx` so other web-ready publishing/editing environments can consume it through ordinary standards rather than requiring native `.webx` support on day one.

The interoperability ladder should be:

```text
WEBX
├── native package contract (.webx)
├── HTML/CSS/JS/assets
├── Markdown semantic source where practical
└── manifest metadata
```

This gives future adapters a straightforward path to environments such as:

- Joplin-like Markdown editors;
- static-site generators;
- CMS importers;
- website builders;
- documentation/publishing tools;
- code editors and IDEs;
- ordinary browsers/static hosts.

Do not claim those tools natively support `.webx` unless they actually do. The standardization goal is that `.webx` is composed from broadly accepted web primitives so adapters/import/export paths are thin.

## Joplin/editor interoperability target

Work toward simple interchange such as:

```text
WEBX → Markdown + assets
Markdown + assets → WEBX
WEBX → HTML bundle
HTML/Markdown import → WEBX
```

Where a target editor cannot preserve JavaScript/CSS behavior, preserve the semantic content and assets rather than silently flattening or corrupting them.

Future-specific adapters can live above the WEBX core format instead of changing the core package for each application.

---

# P0 — WEBX creation behavior

`New → WEBX` should create a real LightComp editing surface backed by a WEBX-capable runtime.

V1 flow:

```text
New → WEBX
→ clean Joplin-like writing surface
→ semantic Markdown/CommonDocument content
→ web preview
→ optional CSS/JS enhancement hooks
→ Save / Save As
→ `.webx`
```

The initial user should not need to write HTML/CSS/JavaScript manually. Those technologies are the package/output substrate, not a prerequisite for using the editor.

Advanced users may later inspect/edit the generated HTML/CSS/JS directly, but ordinary document creation remains simple.

---

# P0 — WEBX Save As / Open / round-trip

Required behavior:

```text
New WEBX
→ author content
→ Save As
→ example.webx
→ close
→ reopen example.webx
→ same semantic content, assets, and rendered result return
```

Opening `.webx` should parse the manifest/package and rebuild a LightComp editing object.

Saving again should be deterministic and should not accumulate duplicate assets or path drift across repeated save/open cycles.

Use the existing bundled ZIP tooling where appropriate rather than inventing a bespoke binary container.

---

# P0 — conversion menus and target naming

Every V3 reference to `LightComp` as a conversion *format* should now be interpreted as `WEBX`.

Examples:

```text
DOCX → Convert → WEBX
PDF  → Convert → WEBX
WEBX → Convert → DOCX
WEBX → Convert → PDF
```

LightComp remains the editor/runtime/system responsible for WEBX authoring.

Do not save files as `.lightcomp` or advertise `LightComp` as the extension.

---

# Preserve all V3 priorities

Everything else in V3 remains in force, including:

- PR #51 residual fixes: Quick Actions red `×` always visible when panel visible, PDF Text Size mini-popover, no dead/orphan menu commands;
- point-based right-click context without preselection;
- true four-direction expanding canvas with stable world coordinates and no left/top clamp;
- PDF/DOCX editor-specific right-click menus;
- Simple-mode restrictions;
- video-only `Sync with…` / `Make independent` capability;
- snapshot native Save As requirement;
- frameless/header restore idempotence;
- internal-drag ingest-overlay suppression;
- preview/serialization correctness.

Only the web-first document naming/package contract changes:

```text
old wording: LightComp document / LightComp file
new wording: LightComp editor/runtime producing WEBX (.webx) packages
```

---

# Tests / validation additions

Add or update focused tests for:

1. New menu exposes `WEBX`, `DOCX`, `PDF` rather than `LightComp` as a file target;
2. WEBX Save As uses `.webx`;
3. WEBX package contains a valid versioned manifest and declared entry HTML;
4. unpacked package contains ordinary web-ready files/assets;
5. WEBX reopen reconstructs semantic authoring state;
6. WEBX save/open/save does not duplicate assets or drift paths;
7. DOCX → WEBX and PDF → WEBX create a real WEBX object while preserving the source;
8. WEBX → HTML/Markdown interchange helpers preserve semantic content where supported;
9. no `.lightcomp` extension or obsolete LightComp-as-format target remains in new UI/logic/tests;
10. existing V3 spatial/menu/document tests still pass.

Run full `node --test tests/*.test.mjs`, syntax checks for touched JS/MJS, `git diff --check`, and Web Store packaging/release gate.

---

# Updated 30-minute priority order

```text
1. preserve/fix V3 PR51 residual invariants
2. point-context resolver
3. true four-direction canvas
4. New → WEBX / DOCX / PDF
5. WEBX package contract: manifest + HTML/CSS/JS/assets + semantic source
6. WEBX Save/Open round-trip
7. Convert → WEBX / DOCX / PDF through CommonDocument
8. interoperability/export adapters (Markdown/HTML) as time allows
9. tests + validation
```

Do not over-invest in advanced CSS/JS authoring before the core WEBX package, semantic source, round-trip, and ordinary web deployment path are correct.

At the 30-minute mark, **conclude active implementation and provide a handoff** with completed primitives, WEBX contract/version, files changed, tests/results, manual checks, remaining interoperability adapters, risks/issues, exact next steps, branch, commit, and PR.

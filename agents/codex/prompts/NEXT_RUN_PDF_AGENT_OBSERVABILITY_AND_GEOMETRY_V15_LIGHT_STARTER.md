Read and execute `agents/codex/prompts/NEXT_RUN_PDF_AGENT_OBSERVABILITY_AND_GEOMETRY_V15.md` on the latest `main`. Treat it as the single authoritative prompt for this run.

This is an **agent-infrastructure run**, not a feature-polish run.

The goal is to stop debugging PDF layout from screenshots and guesses. Make every relevant PDF object fully localizable and inspectable across:

- original PDF-point geometry,
- canonical semantic geometry,
- expected viewport geometry,
- actual DOM layout geometry,
- actual visible text/glyph ink geometry,
- mask/erase geometry,
- serialized Save geometry,
- idle / hover / selected / editing / committed / reopened state,
- layer/z-order and ownership.

A CSS box being correct is not enough. Distinguish the text container from the actual rendered glyph ink. Use browser text-range geometry and font metrics where appropriate so an agent can detect surviving tail fragments, clipped ascenders/descenders, overflow, and visual text outside its nominal field.

Add stable IDs to source runs, semantic lines/blocks, edits, masks, images, wraps, and generated lines. Add a JSON-serializable one-page diagnostic snapshot plus structured invariant validation. The snapshot must let ChatGPT/Codex answer exactly what object is wrong, where it should be, where it actually appears, what owns it, what it collides with, what changes on hover/edit, and what Save will erase/draw.


**Treat the current saved document as a hard version boundary.** FrameChute may keep undo/history data internally, but historical/superseded text must be completely inert in the active document. After Save + reopen, the PDF must be a clean current-version slate that looks exactly like the user remembers: no old dead text may reappear on hover, selection, rerender, zoom, edit mode, search, or extraction. Old source runs, replacement fields, masks, and overlays must not remain renderable or hit-testable. If prior states are retained, expose them only through an explicit **Previous Versions** / version-history path. Undo data likewise remains inert until Undo/Redo is explicitly invoked. Add diagnostics and tests that fail if superseded objects participate in current rendering or return after Save + reopen.

Live and Save must be directly comparable from the same diagnostics. If text is hidden live but reappears after Save, diagnostics should identify the exact source object/mask mismatch. If something looks different only on hover, the state snapshot should reveal the CSS/geometry/layer change without needing a screenshot.

Add an advanced/debug action such as **Copy Page Diagnostics** and optionally **Show Geometry Overlay**, without cluttering normal users. Keep diagnostics cheap/on-demand and do not make observed DOM geometry canonical.

Build synthetic tests for multi-run lines, terminal fragments, tight leading, two columns, images, moved/reflowed text, CropBox/rotation/zoom, hover/idle/editing state, and live-vs-saved parity. Run the full PDF/repo validation gates and open one clean PR against latest `main`.

Do not add fancy fonts or broad new PDF features in this run. First make the system so observable that an agent can diagnose the ugly mash-up precisely from coordinates, structure, state, and ink bounds alone.

# Imperative: dependable DOCX editing and a dedicated DOCX context menu

## User request and completion standard

Substrate (previously FrameChute) must provide basic, dependable DOCX functionality. This is a priority implementation request, not an investigation-only task. Implement, exercise, repair, and verify the complete workflow. Do not stop at a plan, a toolbar mockup, passing helper tests, or a partially working editor.

The essential outcome: a user can open an ordinary Word document, select and edit its content, use familiar formatting and document-specific right-click actions, save a genuine DOCX, and reopen it with their edits and supported formatting intact.

Work autonomously on routine implementation decisions. Continue resolving reproducible failures until the acceptance criteria pass. If an external dependency or unavailable environment genuinely blocks verification, state exactly what is blocked and what remains unverified. Never claim a pass without evidence. This request does not authorize bypassing permissions or approval requirements.

## Inspect first, then implement

Read applicable repository instructions and existing Codex requests. Trace the current DOCX ingestion, editor DOM, selection, command dispatch, context-menu routing, undo/redo, model synchronization, native save, serialization, and workspace persistence.

Start with:
- src/documents/docx-document.js
- src/actions/document-operations.js
- src/actions/native-save.js
- src/actions/quick-actions.js
- src/workspace.js and the actual document UI/context-menu modules
- DOCX-related tests and scripts/package-web-store.sh

These are starting points; discover actual wiring rather than assuming it.

Reuse sound existing functionality. Extract focused modules where appropriate. Preserve local-first operation, packaged runtime dependencies, and existing extension security constraints.

Code inspection identified questions to reproduce and resolve, not pre-proven bugs:
- parseParagraph currently infers bullet versus numbered lists from specific numId values. Resolve actual numbering definitions, levels, and style inheritance instead of assuming arbitrary documents use those IDs.
- serializeDocx includes a text-count/run-order based patch path. Verify empty runs, multiple text nodes, tabs, line breaks, split formatting runs, hyperlinks, and edits that change document structure; counts alone must not establish source-node identity.
- Verify that structural edits, image changes, and hyperlink changes reach the saved package, including existing relationships, without silently discarding unrelated content.

## Required basic editing

1. Open and create
   - Open ordinary DOCX through supported Open, drop, and workspace reopen paths.
   - Create a new blank DOCX through the document creation flow.
   - Show editable paragraphs, headings, lists, ordinary tables, hyperlinks, and inline images.
   - Render sensible document width, margins, wrapping, and scrolling; no overlapping controls.
   - Handle malformed/unsupported input with an actionable error instead of an empty or frozen object.

2. Reliable text interaction
   - Caret movement, drag selection, word/paragraph selection, typing, deletion, Enter, Shift+Enter, and multiline editing.
   - Cut, Copy, Paste, Paste as Plain Text, and Select All.
   - Ordinary rich text paste preserves supported structure; plain text paste removes formatting.
   - Undo/Redo covers text and document formatting/structural operations in a predictable history.
   - Find, next/previous match, Replace, and Replace All within the active document.
   - Preserve selection and caret across toolbar clicks, context-menu opening, dialogs, and commands.
   - Support composition/IME and Unicode text without corruption or duplicate input.

3. Familiar formatting
   - Bold, italic, underline, strikethrough.
   - Font family, font size, text color, highlight, and clear direct formatting.
   - Normal paragraph and Heading 1/2/3 styles.
   - Left, center, right, justified alignment.
   - Bulleted/numbered lists, list nesting through indent/outdent, and correct continuation.
   - Paragraph indentation, line spacing, and before/after paragraph spacing.
   - Apply formatting to the selection; collapsed selections set insertion formatting.
   - Reflect active/mixed formatting state honestly.
   - Never serialize a visual-only approximation as if it were a supported document feature.

4. Basic document objects
   - Insert/edit/remove hyperlinks with correct saved targets.
   - Insert an inline image at the caret; select, resize with aspect ratio preserved by default, replace, and remove it.
   - Insert a simple table, edit cells, add/delete rows and columns, and delete the table.
   - Preserve ordinary table content, basic dimensions/borders, and images through save/reopen.
   - Support explicit page breaks and basic page size, orientation, and margins. Do not fake exact Word pagination; preserve document settings and make layout limitations explicit.

5. Save and reopen
   - Save and Save As produce valid .docx files; never HTML with a DOCX extension.
   - Use the existing writable-file handle when available and the established Save As fallback otherwise.
   - Flush pending editor changes before serialization.
   - Retain dirty state on cancellation or failure; clear it only after successful saving.
   - Ensure workspace export/reopen also preserves edited DOCX state and required assets.
   - Preserve untouched package parts, styles, numbering, relationships, section settings, headers/footers, and unsupported content wherever possible.
   - An ordinary edit must not silently strip unrelated document content.
   - If a particular unsupported edit cannot preserve content safely, explain the limitation before a potentially lossy export and offer a safe alternative.

## Dedicated DOCX right-click menu is mandatory

Right-clicking inside DOCX content must open a menu designed for word processing, routed by the actual document/target type.

Text and paragraph commands:
- Undo / Redo
- Cut / Copy / Paste / Paste as Plain Text
- Select All
- Font and basic formatting controls
- Paragraph alignment, spacing, indentation
- Bullets / Numbering
- Insert Link
- Find / Replace
- Save / Save As

Context-sensitive additions:
- Hyperlink: Open Link, Edit Link, Remove Link.
- Inline image: Replace Image, Resize Image, Remove Image.
- Table/cell: Insert Row Above/Below, Insert Column Left/Right, Delete Row/Column, Delete Table.

Requirements:
- Preserve an existing text selection when opening the menu over it.
- With no selection, resolve the caret/target at the click position.
- Menu commands operate on that document and target, not a stale selection in another object.
- Show relevant groups/submenus rather than one huge flat menu; disable unavailable actions accurately.
- Keep workspace object actions on the document frame/chrome or in a clearly separate Workspace submenu.
- No video, image-canvas, PDF, capture, or unrelated transformation actions in the document editing menu.
- Delete inside the editor removes selected document content, never the entire workspace object.
- Other object types retain their own functioning menus.
- Support keyboard opening (Shift+F10/context-menu key), arrow navigation, Enter, Escape, focus restoration, and viewport-safe placement.
- Clipboard restrictions must be handled honestly: use permitted browser APIs or offer the appropriate keyboard action when unavailable. Do not show a successful paste that did nothing.

Keep a compact, discoverable DOCX toolbar for frequent operations. Do not make right-click the only route to essential functionality. Toolbar, keyboard shortcuts, and context-menu commands must share document-aware command behavior.

## Keyboard and workspace isolation

Use familiar shortcuts where the browser allows: Ctrl/Cmd+B, I, U, Z, redo, A, C, X, V, F, H, and S. Scope handlers to the active editor. A browser-reserved shortcut may need an explicit UI alternative.

Editing a document must not trigger workspace deletion, object movement, global select-all, unrelated media actions, or a second document's commands. Verify two DOCX objects open simultaneously. Scrolling/editing within a document must not unexpectedly drag its workspace frame.

## Verification and acceptance gate

Create focused regression tests and representative DOCX fixtures, including independently authored OOXML or external-editor documents. Do not validate only files produced by our own serializer.

Required fixtures:
- New blank document and simple paragraphs.
- Mixed formatting, empty paragraphs, multiple runs/text nodes, tabs, line breaks, Unicode.
- Heading styles and bullet/number lists with nonstandard numbering IDs and nested levels.
- Ordinary tables, inline images, hyperlinks, margins, page breaks.
- Untouched headers/footers and at least one unsupported construct to test preservation.

Exercise these end-to-end paths in a real supported browser:
1. Create blank DOCX, type multiple paragraphs, format a selection, save, reopen.
2. Open a fixture, edit across run boundaries, use Undo/Redo, save, reopen.
3. Right-click selected text, change formatting, verify the same range changed.
4. Insert and edit a table, image, and hyperlink; use their own context menus; save/reopen and verify.
5. Find and replace, including Replace All, then Undo.
6. Switch between two documents and verify selection, shortcuts, history, and menu isolation.
7. Cancel a save, simulate a save failure, retry, and verify dirty state and recoverability.
8. Export/open the workspace and verify the document's latest edits.
9. Confirm image/video/PDF menus and ordinary workspace actions still function.
10. Repeat essential flows in Simple and Advanced modes and a narrow window.

Unzip saved DOCX files and check valid XML, required content types/relationships, unique drawing IDs, styles, numbering, image targets, and unrelated part preservation. Open representative saved files in Word or LibreOffice when available and inspect text, layout, and formatting. If neither is available, explicitly report that interoperability check as unverified; do not substitute a claim of compatibility.

Run relevant regression tests, syntax checks, whitespace checks, and the repository's release/package gate. Add tests for actual discovered failures. A helper-only pass does not prove the editor works.

Completion requires:
- Every mandatory basic command above is wired and exercised, with no placeholder success.
- Text editing, selection, formatting, menu routing, save/reopen, and workspace persistence pass.
- No silent data loss in the supported fixture set.
- Evidence from actual browser interactions, plus recorded test results.
- Any remaining limitation is specific and accurately disclosed.

## Deliverable

Implement the changes and provide a reviewable commit/PR using the repository's normal workflow. Report the root causes fixed, resulting user behavior, exact verification performed, and any real remaining blockers. Do not mark this task complete while a required basic workflow is known broken. Update documentation only to match verified behavior.

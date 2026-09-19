# Proposal: Small Controls, Foundational Freedom

**Date:** 2026-09-19  
**Status:** Product and architecture proposal, not a claim of implemented behavior  
**Product:** SUBSTRATE / FrameChute  
**Related:** [PDF-first workbench](pdf-first-universal-browser-workbench.md) and [deterministic layout core](deterministic-layout-core-and-extractable-js-ts-packages.md)

## The question

"Why can't this be simpler? I just want to do my homework, fill out my form, correct a sentence, add a picture, and save."

SUBSTRATE should answer that question without asking the user to learn a specialist application. We are not trying to pack every feature of Acrobat, Word, or a design suite into one toolbar. We want the smallest set of dependable, combinable operations that makes ordinary and surprisingly ambitious work possible.

A person should be able to open a document, select the thing they mean, change it, and save a portable result. Power should come from combining basic operations and entering precise numbers where needed, not from multiplying permanent controls.

## The foundational grammar

Every meaningful object has an identity, bounds, content, and a relationship to its page or parent. The same actions work wherever sensible:

- Select an object and edit its content.
- Move it directly, or set its exact X/Y position.
- Resize it directly, or set width, height, and font size numerically.
- Set an appropriate font and simple formatting on text.
- Choose alignment/arrangement without a separate editor for each object.
- Undo, redo, save, and reopen without changing the result unexpectedly.

The default toolbar remains small. A contextual inspector can reveal precise values without occupying the page all the time. Basic operations must cover common edge cases such as long university forms, multi-page assignments, captions, narrow columns, and images beside paragraphs.

**Quality rule:** a primitive is not done until it behaves during hover, drag, typing, commit, zoom, save, and reopen. Correctness cannot depend on whether the object is original PDF content or newly inserted content.

## What Padding means now

Keep a single, modest **Padding** control for *page margins only*. It defines the legal content rectangle, not cell padding, paragraph gaps, field insets, or the white source-glyph erasure mask.

- Choose pixels (px) or percentage (%) and set top/right/bottom/left, linked or separately.
- A user-created or user-reflowed text region must stay inside the resulting bounds; when the right boundary is reached, the line wraps forward.
- Existing imported PDF content is not silently repositioned merely because the user changes a margin setting.
- Internal geometry should be canonical and zoom-independent; pixel values must have an explicit reference scale and percentages resolve against page width or height.
- Keep original-glyph masking separate from margins and spacing. Margins must never be implemented as a bigger white rectangle over neighboring text.

We will add other padding targets only when actual user needs justify them.

## Next indispensable primitive: images that participate in document flow

The ordinary intent of inserting an image into a document is not "drop an opaque rectangle over letters." It is "make room for this image while retaining all my words, their order, and a readable page."

For editable/reconstructed document content, adding, dragging, or resizing an image should offer two comprehensible placement behaviors:

**Flow (ordinary default):** the image occupies space in a paragraph/page. Text wraps beside it if a readable lane exists, otherwise clears below it. Overflow moves in reading order to the next line and, if necessary, the next page. Reflow affects the smallest necessary region, not unrelated pages.

**Overlay (explicit):** the user deliberately places an image over content for art, watermarks, or annotation. Overlap is intentional and undoable; do not pretend it is a normal paragraph reflow.

A small numerical image-to-text gutter can eventually be a contextual field, not a new toolbar or a replacement for page margins. The Flow/Overlay choice and page-margin values are enough for the first implementation.

### Simple example

Before: "This is a long paragraph explaining the experiment."

Insert an image into the paragraph. The engine measures available horizontal lanes around the image, places complete words in readable lanes, moves the remaining words forward, and keeps the original sentence intact. When the image grows, the flow recalculates; when it shrinks or is deleted, text fills the released space. The user's active editing point, object identities, and undo history remain coherent.

### The engineering boundary

Many PDFs are fixed-position drawing instructions, not true flowing paragraphs. A PDF text-content array is **not** by itself a reliable paragraph model. Do not blindly move scattered glyph runs, stretch line boxes, or overwrite unrelated original content.

Use the existing semantic layout and deterministic geometry work as the shared basis. Preserve immutable source objects and their provenance; form a reconstructed flow region only when reading order, grouping, font/width measurements, and ownership can be established with adequate confidence. Preview the proposed reflow before committing it. When reconstruction is ambiguous (scans, columns, tables, forms, overlapping art, unusual fonts), preserve the original, explain the limit plainly, and offer a safe explicit overlay or region-specific edit. Never silently mangle a document to claim that reflow worked.

Layout decisions belong in pure/testable rules, not one-off pointer event handlers. The PDF, DOCX, future CSV/grid, and native-format adapters should reuse object identity, legal geometry, collision policy, undo transactions, and serialization without falsely treating all media as paragraphs.

## What "good enough to stop needing another editor" means

Common tasks must be boringly dependable: correct a typo, add or replace a word, change a font/size, complete a form, insert a labeled diagram, reposition an image, rearrange pages, and save a PDF that looks right in another viewer. Support keyboard and pointer input; remain usable on modest hardware; keep local work private by default; preserve a document's accessibility and reading order wherever our supported edit path can do so.

This is not a promise to replace specialist redaction, certified digital signatures, accessibility remediation, complex prepress, or every native PDF object operation today. Those require their own correctness and security work; a drawn signature is not the same as a cryptographically verifiable signature.

**The product promise:** Open it. Change the thing you meant. Everything else stays sensible. Save it. Keep going.

## Sequencing and success gates

1. **Master ordinary PDF editing:** stable text and image behavior, no mask ghosts or disappearing fields, explicit page margins, deterministic image-aware flow on supported content, exact positioning, undo, externally faithful export, and clear fallback on difficult source PDFs.
2. **Lightweight CSV editing:** a small, keyboard-friendly row/column grid for loading, changing, adding/removing rows and columns, searching and optionally sorting/filtering, preserving types-as-text and CSV quoting/encoding, then writing an ordinary CSV. No obligation to become Excel or promise formula/chart parity.
3. **Our own portable content format:** design a documented, inspectable native document/scene representation for mixed text, images, geometry, layout rules, and later interactive material. A working name in earlier plans is WEBX; name and schema remain to be specified. This is distinct from the existing FCX workspace-session file. Keep import/export to ordinary files so users are not trapped in a proprietary workflow.

Stop adding controls when the same foundational operation already expresses the user's intent. Add a new primitive only when it removes a genuine limitation, not merely because a larger application has a menu entry.

## Acceptance in human terms

A student can add a picture to a paragraph without manually rebuilding the paragraph; a professor can move and resize a figure without losing citations; a person can fill out a form without learning the PDF's rendering internals. The interface stays understandable to a first-time user, while exact numeric positioning remains available to someone who needs precision.

No feature is complete on the strength of green CI alone. Verify real representative PDFs and DOCX files at multiple zoom levels, with narrow margins, dense text, columns and forms, save/reopen in an external viewer, and capture screenshots before declaring the result dependable.

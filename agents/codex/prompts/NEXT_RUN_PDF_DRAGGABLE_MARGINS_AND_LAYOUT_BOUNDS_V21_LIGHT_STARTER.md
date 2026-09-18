Read and execute:

agents/codex/prompts/NEXT_RUN_PDF_DRAGGABLE_MARGINS_AND_LAYOUT_BOUNDS_V21.md

This is a substantial architecture run, not a cosmetic patch.

Implement the visible feature first:

Margins [ ON ] / Margins [ OFF ]

ON shows four subtle draggable dashed page margins.
OFF hides the guides only.

Margin enforcement stays ON by default even while the guides are hidden.

All Substrate-editable PDF boxes should be kept inside the active content rectangle by default:
- replacement text
- free text
- inserted images
- moved/resized/duplicated editable objects

If margins move inward, reconcile existing editable boxes inward when they can fit. Do not rewrite untouched native PDF source content merely because it lies outside the authoring margins.

Build the math in PDF points, never persisted client pixels.

Most importantly, lay down reusable architecture for future:
- Text Blocks
- Image Blocks
- mixed Content Blocks
- union bounds
- member-relative geometry
- whole-group translation constrained by margins

Do NOT add the final Grab Text Block / Grab Image Block / Grab Content Block UI yet unless it is trivially safe. The group math and tests must exist now so those features do not require a rewrite later.

Minimum expectation: at least 300 meaningful new/changed implementation lines, with 500–700 completely acceptable. Do not game line count. Build the architecture needed for success.

Preserve PR #78 behavior, stable three-row toolbar, current hover authority, Enter-to-finish, Copy, masks, save/reopen parity, and diagnostics OFF by default.

Use diagnostics to prove:
- Margins ON/OFF does not move the page
- margin dragging does not move the page
- editable geometry remains inside bounds
- guide projection matches canonical PDF-point margins

Run focused tests plus the full Node suite before opening the PR.

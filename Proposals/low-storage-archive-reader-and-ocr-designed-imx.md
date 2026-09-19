# SUBSTRATE Proposal: Low-Storage Archive Reader and OCR-Designed IMX

Status: Proposal only. Do not modify existing application code, editors, viewers, or existing files.
Project: SUBSTRATE / FrameChute

## 1. Primary user need

A user has a ZIP or CBZ archive but not enough free disk space to extract the whole archive alongside the original. SUBSTRATE should open the archive directly and let the user browse its images without making a full uncompressed copy on disk. The original archive remains unchanged. The first shipping scope is image-only browsing; other file types are optional follow-ons.

## 2. Image-first ZIP / CBZ viewer MVP

- User selects or drops a local ZIP or CBZ; open a separate optional archive frame using existing workspace window controls. No upload, silent extraction, full-file duplication, or persistent caching is required.
- Read ZIP central-directory metadata and entry offsets from the original file using bounded File/Blob slices when possible, rather than loading the whole ZIP into an ArrayBuffer.
- Show folder tree, archive entry names, image count, optional sizes, natural filename/page ordering, and clear errors for unsupported formats.
- Decode only the selected image and a strictly limited preview/next-page cache. Support previous/next, zoom, fit-to-frame, and lazy thumbnails. Optional continuous comic reading and right-to-left order can follow.
- Feed selected, bounded entry data through an adapter into the existing SUBSTRATE image viewer. Do not replace the current standalone image pipeline or alter PDF/DOCX behavior.
- Export a selected entry only on the user's request. Phase 1 is strictly read-only: viewing or editing an image never silently rewrites the archive; edited images save as independent outputs.
- On switch/close, cancel pending work and free temporary buffers, object URLs, and caches. Respect user-selected destinations and never create a complete extracted copy.

### Honest resource limits and safety

Browsing without unpacking to disk does not mean zero memory/decompression: each displayed image needs to be decompressed and decoded. An enormous image may still exceed RAM. Enforce limits and provide useful errors. Test peak additional disk and memory usage on low-storage machines.

Implement bounded parsing/decompression, safe offsets, CRC/integrity checks where feasible, image dimension caps, filename traversal protection, ZIP bomb defenses, malformed archive handling, and no execution of archive contents. Start with stored/DEFLATE entries; report unsupported encryption/compression/ZIP64 cases explicitly until implemented. Never infer trust from file extension alone.

## 3. Experimental .imx: an image designed for OCR from day one

**Canonical proposed extension: .imx (not .imc).** This is a separate format research track and must not block the ZIP/CBZ MVP.

The user's core concept: IMX is an image-first document whose text is visually rendered using a purpose-designed, aesthetically pleasing but OCR-friendly font and layout. The image itself should support excellent text recovery even if embedded text metadata is absent or damaged. Do not redefine it as merely a normal text file wearing an image skin.

### Visual design principles

- Design and test a distinctive IMX typeface with unambiguous glyph shapes, generous spacing, consistent baselines, distinguishable characters (e.g. O/0, I/l/1, rn/m), resilient punctuation, clear accents/diacritics, and high legibility at intended viewing and scan resolutions.
- Use deliberate visual cues for line starts/ends, text blocks, columns, reading order, page/tile identity, and consistent quiet zones. Explore subtle baseline guides, margin fiducials, line numbering or registration marks that are ignorable by human readers but useful for layout recovery.
- Keep decorative graphics separate from text regions. Preserve selectable choices for normal appearance, reduced-motion, and accessibility; don't let OCR optimization make reading unpleasant.
- Treat visual guides as a hypothesis requiring testing, not a guarantee of instant or perfect OCR. In particular, guide marks themselves can confuse OCR; compare guided vs unguided samples on multiple engines and resolutions.
- Use lossless or text-safe near-lossless encoding for text-bearing image regions. Avoid resampling, antialiasing or aggressive lossy compression that destroys character distinctions; consider separate compression strategies for photos and glyph regions.

### Container and access model

- Explore a versioned, indexed compressed container holding page imagery or independently decodable image tiles, page dimensions, image/text region boundaries, optional OCR alignment metadata, and integrity information.
- Where available, retain a separately indexed machine-readable UTF-8 text layer plus reading order and coordinates for instant search/copy/accessibility and authorized agent use. This layer is a helpful optimization and recovery cross-check, **not a substitute for the image being OCR-readable by design**.
- If no text layer exists, the native reader should be able to run optional OCR on only the selected region/page. A compressed image still requires decompression of the selected data before visual display or OCR; it need not require full-archive extraction.
- Use structured visual markers and optional checksums to aid alignment and detect corrupted text recovery, but never claim certainty from OCR alone. Expose confidence/verification and allow correction where needed.
- Benchmark file size, visual fidelity, OCR accuracy, extraction speed, disk usage, and RAM against practical PDF/CBZ/image-plus-text alternatives before settling the format. Investigate existing uses of the .imx extension for interoperability.

## 4. Integration and non-regression requirements

- Keep archive browsing and IMX support behind their own opt-in routes/feature flags. Preserve existing image, PDF, DOCX, media, and workspace behavior and avoid unrelated refactors.
- Agents may query archive entries, IMX visual regions, OCR output, and optional text/geometry only through the existing scoped-permission and tracing design. Displaying a file does not grant an agent unrestricted access.
- Save/export must never mutate source archives or images without an explicit, user-visible action. Restrict temporary storage, and keep working-set memory bounded.

## 5. Acceptance criteria and order of work

1. Define representative image-heavy ZIP/CBZ test files and low-disk/low-RAM limits. Verify browsing succeeds without a full on-disk extraction or full archive copy.
2. Ship only a read-only, image-first archive viewer prototype behind an opt-in entry point; verify paging, zoom, folder navigation, cleanup, corruption handling, and safety limits.
3. Run regression tests for existing standalone image, PDF, DOCX, frame controls, persistence, and save/export workflows. The original ZIP remains byte-for-byte unchanged.
4. Prototype IMX separately: generate sample page images using candidate OCR-oriented fonts and visual guides; compress and selectively decode; evaluate with multiple OCR engines and realistic rescaling, screenshots, and scans.
5. Decide IMX's v1 specification only after comparative OCR, readability, interoperability, file-size, and low-storage benchmarks. No implementation of IMX is authorized merely by approving the ZIP/CBZ viewer.

Success criterion: a low-storage user opens and reads pictures directly from a compressed archive without extracting it all, while existing SUBSTRATE functionality remains unaffected. Separately, IMX demonstrates that a deliberately designed image can remain both visually pleasant and unusually recoverable as text.
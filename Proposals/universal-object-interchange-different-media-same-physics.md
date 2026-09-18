# Proposal: Universal Object Interchange — Different Media, Same Physics

## Summary

SUBSTRATE should make file-format boundaries feel increasingly irrelevant during ordinary manipulation.

The user should be able to see a meaningful thing, grab it, move it, and drop it somewhere else even when the source and destination are different media.

Examples:

- image in PDF -> drag into DOCX
- image in DOCX -> drag onto workspace
- Text Block in PDF -> drag into WEBX
- chart derived from CSV -> drag into a report
- image + caption + explanatory text -> move together as one Content Block
- future video/image/text/spatial objects -> reuse the same interaction grammar wherever the medium permits it

The principle is:

> **Different media, same physics.**

This proposal does not redefine the canonical model, package plan, PDF layout architecture, or WEBX schema described elsewhere. It adds the product-level interoperability law that those systems should serve.

---

## 1. The User Mental Model

Users should not have to think in terms of:

- PDF XObjects
- OOXML relationships
- HTML nodes
- CSV rows
- browser blobs
- future WEBX serialization details

They should think:

> “I want this thing over there.”

The medium-specific translation belongs underneath the interaction.

The simplest desired interaction is:

~~~text
see thing
↓
grab thing
↓
move thing
↓
drop thing somewhere else
~~~

SUBSTRATE should make that interaction increasingly universal.

---

## 2. A Substrate Object Is the Portable Unit

A meaningful object should be representable independently of its current file container.

Conceptually:

~~~text
SubstrateObject
  id
  kind
  content
  bounds
  transform
  reading/spatial order
  semantic role
  provenance
  relationships
  capabilities
  source context
~~~

Not every object uses every field.

An image may primarily carry an asset and geometry.

A Text Block may carry ordered runs and line relationships.

A table may carry structured rows and cells.

A video clip may carry time.

A future 3D object may carry depth and transforms.

The common object model should be broad enough that the same command vocabulary can operate on all of them without pretending the media are internally identical.

---

## 3. Frames as a Useful Interaction Metaphor

The UI may treat many meaningful objects as frame-like entities:

- Image Frame
- Text Block
- Image Block
- Content Block
- Table
- Chart
- media clip
- future spatial object

“Frame” does not have to become the internal type name for everything.

The useful idea is:

> a bounded, identified piece of material that can be selected, moved, copied, grouped, converted, or transferred between contexts.

This gives the user one coherent manipulation grammar.

---

## 4. Medium Adapters Realize the Same Object Differently

A drag operation should express intent once.

Conceptually:

~~~text
Move / Copy SubstrateObject
        ↓
target medium adapter
        ↓
native representation
~~~

For example, the same image object may become:

~~~text
PDF
-> inserted image object with PDF-point geometry

DOCX
-> OOXML image relationship + placement

WEBX
-> native semantic image object

Workspace
-> world-space object

HTML
-> DOM/image representation
~~~

The user does not need a separate drag model for each file type.

The adapter specializes the operation.

The medium should specialize a primitive, not redefine it.

---

## 5. Transfer Should Preserve More Than Pixels

When possible, cross-format drag/drop should preserve semantic payload, not merely a screenshot.

An image object might carry:

~~~text
asset
caption
alt text
source citation
stable object ID
semantic role
layout relationship
provenance
~~~

A target format should preserve everything it can represent.

Anything that cannot be represented natively should remain available in SUBSTRATE provenance / source metadata where practical.

This is especially important for Substrate-produced documents, where rich metadata is already known.

---

## 6. Text Blocks Are First-Class Transferable Material

The current PDF work toward mathematically identified text blocks should eventually enable:

~~~text
Right-click
-> Grab Text Block
-> drag
-> drop elsewhere
~~~

The important property is that the Text Block retains:

- stable identity
- member order
- member-relative geometry
- semantic relationships
- source provenance

The block should not become an accidental raster snapshot unless the destination has no richer representation available.

---

## 7. Mixed Content Blocks

The same architecture should extend naturally to mixed material.

Example:

~~~text
Content Block
├── paragraph
├── image
├── caption
└── follow-up text
~~~

Moving the Content Block should preserve its internal relationships.

Dropping it into another medium should invoke the best target representation available.

This is where the current group-bounds and member-relative-geometry work becomes strategically important.

---

## 8. File Type Becomes a Storage / Rendering Boundary

The long-term direction is not that PDF, DOCX, CSV, WEBX, images, video, and future spatial formats become identical.

They remain different media with different constraints.

The goal is that those differences stop dominating the interaction model.

Conceptually:

~~~text
SOURCE FORMAT
      ↓
adapter
      ↓
SUBSTRATE OBJECTS
      ↓
shared commands
      ↓
target adapter
      ↓
TARGET FORMAT
~~~

The file type becomes increasingly a serialization / rendering concern rather than a user-facing application silo.

---

## 9. Shared Commands Across Media

Where reality permits, the same conceptual commands should apply:

- select
- move
- resize
- group
- ungroup
- duplicate
- delete
- copy
- paste
- align
- constrain
- inspect
- convert
- reflow
- save

A PDF Text Block, DOCX image, WEBX object, workspace image, or future scene object should use the same command contract when the operation means the same thing.

Medium-specific behavior belongs in adapters.

---

## 10. Parallelizable Architecture

This structure also makes the project easier to develop in parallel.

A shared primitive can improve once:

~~~text
constrainTranslation()
flowAroundObstacle()
unionBounds()
translateGroup()
~~~

and multiple media can benefit.

Meanwhile separate workstreams can improve adapters independently:

~~~text
PDFAdapter
DOCXAdapter
CSVAdapter
WEBXAdapter
ImageAdapter
VideoAdapter
future SceneAdapter
~~~

as long as they obey the shared object and command contracts.

This makes complexity additive rather than multiplicative.

---

## 11. WEBX Becomes the Native Case

WEBX should eventually be the format that can preserve the richest Substrate object representation with the least translation loss.

That means:

~~~text
SubstrateObject -> WEBX
~~~

should be close to native serialization.

Other formats may require constrained translation:

~~~text
SubstrateObject -> PDF
SubstrateObject -> DOCX
SubstrateObject -> CSV
~~~

The stronger the adapters become, the more seamless traversal becomes.

This is one reason WEBX should be informed by real experience editing PDF, DOCX, structured data, images, video, and agent-readable objects before its core schema is frozen.

---

## 12. Substrate-Produced Files Gain an Advantage

An ordinary imported PDF may require reconstruction.

A Substrate-produced PDF can already know:

- object IDs
- text blocks
- reading order
- image relationships
- margins
- semantic groups
- provenance
- layout constraints
- source metadata

That means dragging an object back out of a Substrate PDF can be dramatically richer and more reliable than extracting from an arbitrary external PDF.

The same principle can apply to other Substrate-produced artifacts.

---

## 13. Graceful Degradation

Cross-format traversal must be truthful.

If a target cannot preserve a source feature:

- preserve the highest-fidelity supported representation
- retain provenance where possible
- never silently pretend that unsupported semantics survived intact

Examples:

- rich Text Block -> plain text if destination supports only text
- mixed Content Block -> grouped raster fallback only if richer structure is impossible
- unsupported layout relationship -> preserve content and report loss

The ideal path is semantic.

The fallback path is visual.

The system should know which happened.

---

## 14. Success Definition

This vision succeeds when a user can increasingly work like this:

~~~text
open PDF
grab image
drop into DOCX

grab paragraph
drop into WEBX

grab CSV-derived chart
drop into report

grab image + caption + text
move as one Content Block

save to another format
~~~

without mentally switching applications or learning unrelated manipulation rules for every medium.

The desired feeling is:

> **Everything is material on the same workbench.**

---

## Final Principle

SUBSTRATE should reduce the distinction between media at the interaction layer without erasing the real constraints of those media underneath.

The universal rule is:

> **Files are containers. Meaningful things inside them are objects. Objects should be free to travel.**

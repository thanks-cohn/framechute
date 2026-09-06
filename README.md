# FrameChute

**Open it. Change it. Save it.**

FrameChute is a lightweight browser workspace for the everyday file jobs that somehow still send people hunting through different apps, websites, subscriptions, and tabs.

Drop something in. Paste it. Open it. Put it beside something else. Change it. Pull something useful out of it. Save the result.

That is the idea.

```text
The usual way

file
 ↓
which app opens this?
 ↓
editor / converter / PDF site / media app / another tab
 ↓
export
 ↓
open something else


FrameChute

file
 ↓
FrameChute
 ↓
what do you want to do with it?
 ↓
move · edit · extract · resize · combine · convert · save
```

> **Your browser has tabs. FrameChute gives it a desk.**

---

## What FrameChute offers

FrameChute gives different kinds of files one shared place to live and be worked on.

You can put images, PDFs, Word documents, video, audio, CSV tables, ZIP/CBZ archives, notes, screenshots, recordings, and supported webpages onto the same workspace.

They become things you can actually work with instead of files that immediately disappear into separate applications.

You can:

- open, drag, or paste files into the workspace
- move and resize objects directly
- keep related material beside each other
- edit and convert images
- crop, resize, rotate, flip, annotate, compress, and save images
- work on many images at once
- extract a frame from a video and keep working on it as an image
- play local video and audio directly in the workspace
- edit and rearrange PDFs
- edit practical DOCX documents and save them again
- inspect and clean CSV tables
- open ZIP and CBZ archives and work with supported contents
- capture screenshots
- record the screen or microphone
- create new result objects from things you extract or generate
- save individual files normally
- save the entire FrameChute workspace when you want to come back to it later

The important part is not the number of tools.

It is that the tools **work together**.

A video frame can become an image. That image can be cropped, resized, annotated, converted, and saved. A PDF can sit beside the notes you are taking about it. A chart created from a CSV can become another movable object instead of a download you have to hunt for.

> **The result of one action can become the starting point for the next.**

---

## The kind of jobs FrameChute is for

FrameChute is for the irritating little jobs that are too small to deserve a giant application but too common to ignore.

Things like:

```text
"Resize this image."
"Resize this whole folder of images."
"Pull this frame out of a video."
"Turn these pictures into a PDF."
"Reorder these PDF pages."
"Open this CBZ."
"Clean this CSV."
"Convert this image to WebP."
"Put this screenshot beside my notes."
"Save this edited file somewhere else."
"Why do I need another program just to do this?"
```

That last question is the one FrameChute is built around.

---

## It is a workspace, not a collection of disconnected tools

A lot of web utility sites work like this:

```text
upload file
 ↓
do one thing
 ↓
download result
 ↓
leave
```

FrameChute works more like this:

```text
bring the thing in
 ↓
work on it
 ↓
keep the result here if useful
 ↓
combine it with something else
 ↓
keep going
 ↓
save when you are done
```

The workspace is spatial on purpose.

A file does not have to become a tab, a modal, or a whole new application. It can simply sit where you put it.

Images and video can also be made visually frameless, so after the controls fade away the workspace can show the content itself rather than a pile of miniature application windows.

---

## Save the file, or save the whole desk

FrameChute treats these as two different things.

### Save / Save As

Save the individual thing you are working on as a normal file.

Examples:

```text
image → PNG / JPEG / WebP
PDF   → PDF
DOCX  → DOCX
CSV   → CSV
```

FrameChute should not force you into its own format just because you used FrameChute.

### Export Workspace

When you want the whole workspace back later, FrameChute can save a portable `.fcx` workspace containing the supported state and assets.

```text
your files
+ their positions
+ generated results
+ workspace state
        ↓
      .fcx
```

The file remains a file. The workspace remains a workspace.

---

## Local-first

FrameChute is designed to do ordinary work locally whenever practical.

Your files do not need to be uploaded to a FrameChute server just so you can crop an image, inspect an archive, arrange files, edit a document, or perform other supported local actions.

You choose the files and folders FrameChute is allowed to use. Browser security still applies.

This matters because a basic file chore should not automatically require:

- making an account
- uploading personal material
- waiting for a server
- accepting another subscription
- downloading the result from a temporary webpage

For many jobs, the computer sitting in front of you is already perfectly capable of doing the work.

---

# Who are the competitors?

FrameChute overlaps with several excellent products, but usually in only one part of what it is trying to do.

### [Photopea](https://www.photopea.com/)

Photopea is an extremely capable browser photo editor and can work fully locally. It goes much deeper than FrameChute in professional image editing.

FrameChute is not trying to beat Photopea at being Photoshop in a browser. The difference is that an image is only one kind of object in FrameChute. It can live beside a PDF, video, document, archive, table, note, or generated result and participate in the same workspace.

### [Smallpdf](https://smallpdf.com/)

Smallpdf is focused on making PDF jobs easy: edit, compress, convert, merge, split, sign, and related work.

FrameChute wants those ordinary PDF chores to be part of a broader file workspace rather than a destination that begins and ends with PDFs.

### [CloudConvert](https://cloudconvert.com/)

CloudConvert supports a huge range of file conversions and is excellent at the specific job of turning one format into another.

FrameChute treats conversion as one possible action on an object, not the entire experience. The converted result can remain in the workspace and immediately become useful for something else.

### The less glamorous competitor

The real competitor is often this:

```text
Downloads folder
+ six browser tabs
+ one heavy desktop app
+ one random converter website
+ "where did it save that?"
```

FrameChute is an attempt to collapse a surprising amount of that routine into one understandable place.

It is **not** claiming to replace the deepest professional features of Photoshop, Premiere, Word, Acrobat, or specialist conversion systems.

The proposition is simpler:

> **You should not need a professional suite for every thirty-second file chore.**

---

# Why now?

For a long time, the browser looked powerful while still being strangely helpless around ordinary local files.

A webpage could show amazing things, but the moment you wanted to open a folder, save back to a file, perform heavy processing locally, or work seriously with media, the answer was often awkward, limited, or dependent on a server.

That changed gradually.

There was no single announcement saying "the browser can now become a small personal computing environment."

Instead, the pieces arrived one by one:

- browsers became fast enough to do serious work locally
- WebAssembly made it practical to bring mature processing code into the browser
- browsers gained much better access to user-approved local files and folders
- true Save and Save As workflows became possible
- local storage became much more capable
- browser media tools became strong enough for serious audio/video work
- background workers made heavy jobs less likely to freeze the interface
- the libraries for PDFs, documents, archives, images, and media became dramatically more mature

By roughly **2020 to 2022**, enough of those pieces existed at the same time that something like FrameChute stopped being merely a clever demo and started becoming a credible product.

Today the browser is not just somewhere documents are viewed.

It can increasingly be the place where the work itself happens.

---

# Why wasn't this practical before?

Because the old browser model fought the idea.

Historically, browsers were intentionally separated from the computer underneath them. That was important for security, but it also meant a browser application often could not behave like a normal local program.

A few years ago, a FrameChute-like workflow would repeatedly run into problems such as:

```text
can't really save back to the file
can't comfortably browse a chosen folder
processing is too slow
video work needs a server
large files are awkward
local persistence is fragile
browser libraries are not mature enough yet
```

So developers usually did the sensible thing and specialized.

One team built a photo editor.
Another built a PDF service.
Another built a converter.
Another built a video editor.
Another built a whiteboard.

Each solved one vertical very well.

FrameChute is based on a different observation:

> **A lot of those "different" jobs are really the same human action: give me this digital thing and let me do something useful to it.**

The technology needed to make that idea pleasant arrived slowly enough that it was easy not to notice the larger possibility.

---

# Why an extension?

Because the browser is already where an enormous amount of modern computer work begins.

Images arrive there. Downloads arrive there. Documents arrive there. Videos arrive there. References, articles, screenshots, links, and copied material arrive there.

FrameChute does not ask the user to leave that environment before the useful work can begin.

```text
see something
 ↓
open / drop / paste
 ↓
FrameChute
 ↓
do the job
```

The ambition is not to replace the operating system underneath the browser.

The operating system still handles the machine, hardware, security, networking, and filesystem.

FrameChute is interested in something higher up:

> **the part of computing where a person has a thing and wants to do something to it.**

---

# The design rule

FrameChute should remain understandable even as it becomes more capable.

The preferred interaction is:

```text
select the thing
 ↓
do the obvious thing
 ↓
see the result
 ↓
save it or keep working
```

Not:

```text
learn an application
 ↓
find the correct panel
 ↓
understand its terminology
 ↓
configure a workflow
 ↓
finally perform a tiny task
```

That is why FrameChute favors direct manipulation, contextual actions, previews, Save As, optional result objects, and batch operations that reuse the same simple ideas.

---

# A few current workflows

### Video frame to finished image

```text
video
 ↓
seek
 ↓
Extract Frame
 ↓
image object
 ↓
crop / resize / annotate / convert
 ↓
Save As
```

### Several images to one result

```text
select images
 ↓
stitch / contact sheet / PDF / batch action
 ↓
result
 ↓
keep working or save it
```

### PDF work

```text
open PDF
 ↓
reorder / remove / duplicate / extract / merge pages
 ↓
Save As PDF
```

### CSV work

```text
open CSV
 ↓
edit / sort / clean / split / merge / chart
 ↓
CSV or visual result
```

### Keep the whole session

```text
files + objects + layout + generated work
 ↓
Export Workspace
 ↓
.fcx
```

---

# Where FrameChute is going

The long-term goal is not to bolt hundreds of unrelated buttons onto the browser.

It is to keep expanding a small set of useful ideas:

- files become objects
- objects can be moved and changed directly
- transformations can be previewed before committing
- results can be saved, kept in the workspace, or both
- one action can feed naturally into the next
- batch work should feel like the same tool applied to many things
- deeper image, document, media, spatial, and eventually time-based tools should share the same workspace rather than becoming separate mini-apps

The test remains very simple:

> **Why am I opening a giant application just to do this?**

If FrameChute can make that job immediate, local, understandable, and saveable, then FrameChute has done its job.

---

# Install

## Chrome / Chromium

The Chrome Web Store build is the straightforward way to use FrameChute.

The GitHub repository generally contains the newest work first.

## Current GitHub build

Clone or download this repository, then open your Chromium browser's extension page:

1. Turn on **Developer mode**.
2. Choose **Load unpacked**.
3. Select the FrameChute extension directory.

---

# In one sentence

**FrameChute is a lightweight, local-first browser workspace for opening, arranging, changing, extracting, combining, converting, and saving the everyday digital things that otherwise send you bouncing between applications and websites.**

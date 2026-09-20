# Artwork for the first playable attempt

The game expects these four files in this directory: `town.png`, `overworld.png`, `hero.png`, and `npc.png`.

The pixel-art assets originate from the user-supplied **Tiny RPG Town** archive by Ansimuz, licensed CC0 according to the archive's included `public-license.pdf`. The archive is deliberately not committed wholesale: it contains unrelated artwork and PDFs.

To build the exact town and overworld images used by the standalone prototype, obtain `tiny-rpg-town-files.zip` from the asset provider and run from the experiment directory:

```bash
python -m pip install pillow
python tools/build_assets.py /path/to/tiny-rpg-town-files.zip
python -m http.server 8000
```

Then visit http://localhost:8000/. This generates all ten PNGs used by the original prototype, including the four runtime images above. The standalone complete ZIP provided in the project conversation also contains the prebuilt assets.

**Status:** binary PNG files have not yet been added to this GitHub branch; the HTML page will report an asset-loading error until the generator is run. This branch contains the source and reproducible asset builder, not yet a zero-setup clone-and-play package.

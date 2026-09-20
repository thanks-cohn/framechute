# Artwork for the first playable attempt

The following four runtime assets are **included in this branch**:

- `town.png` — original town composition, optimized to 256×192 pixels and scaled crisply by the game canvas.
- `overworld.png` — original overworld composition, optimized to 256×192 pixels and scaled crisply by the game canvas.
- `hero.png`, `npc.png` — palette-optimized 16-bit-style animated sprites.

The pixel-art assets originate from the user-supplied **Tiny RPG Town** archive by Ansimuz, licensed CC0 according to its included `public-license.pdf`. The entire source ZIP is deliberately not committed; it contains unrelated artwork and PDFs.

The checked-in optimized assets are sufficient to **play immediately**: open `index.html` from the experiment's root. The original full-resolution maps and sprite sheets are available in the previously provided standalone prototype ZIP. To regenerate full-resolution artwork directly from the original free `tiny-rpg-town-files.zip` source, run from the experiment directory:

```bash
python -m pip install pillow
python tools/build_assets.py /path/to/tiny-rpg-town-files.zip
```

That optional builder also produces the extra environment and building PNGs retained in the original prototype. Neither Pillow nor the original asset archive is needed to play the checked-in optimized version.

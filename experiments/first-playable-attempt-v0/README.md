# SUBSTRATE — Little Town (standalone playable prototype)

**Phase 1 only: one desktop town + walking + an overworld exit + return.** This is a standalone, asset-backed feasibility build, **not yet integrated with FrameChute/SUBSTRATE's live file editor or persistent desktop switching**. The second overworld town is deliberately marked as a placeholder. The ship and globe do not exist in this build.

## Play

Open `index.html` in Chrome/Chromium/Firefox; if your browser disallows local asset loading, run `python -m http.server 8000` in this folder and open `http://localhost:8000/`. No packages, runtime dependencies, API keys, internet, or sign-in required. Controls: WASD / arrow keys walk; hold Shift to run; E interacts. On touchscreens use the D-pad below the map.

From First Desktop's central square, walk south to the marked **SOUTH GATE**. Cross the lower edge of the town on the central road to enter the overworld. The east road also exits. On the overworld, return to the western town marker and press **E**; you reenter First Desktop. Click **Start over** to reset. The last map and character location persist locally in the browser.

## Files

- `assets/town.png`, `assets/overworld.png`: custom-composed sample maps made from the CC0 tileset and hand-drawn layout.
- `assets/hero.png`, `assets/npc.png`: sprite sheets from the supplied CC0 ZIP.
- `game.js`, `index.html`, `style.css`: standalone browser game and screen UI. `tools/build_assets.py`: optional reproducible art assembly script if you retain the original ZIP; Pillow is required only to rebuild map assets, not to play.

## Integration plan (later)

Keep the prototype renderer separate from FrameChute's editable HTML workspace. Introduce an opt-in world view; map **stable desktop IDs** to town markers, rather than storing documents in game scenes. Trigger checkpoint/recovery before changing actual desktops, then resolve desktop state through the existing workspace persistence API. Never intercept typing or PDF editing while the world is inactive. Retain non-game desktop access. Upgrade the static overworld to a freely navigable ship mode after local movement and entry/exit contracts have been validated.

## Licensing

Town tiles, trees, hero/NPC sprites and other selected raster art originate from **Tiny RPG Town, Luis Zuno / Ansimuz**, included in the ZIP supplied by the user. The package's `public-license.pdf` states that all included assets are licensed **CC0**, including use, modification and redistribution in commercial projects without attribution. We retain this note to document the provenance. This prototype's new game code and original layout are offered under MIT; see `LICENSE-CODE.md`. The prototype does not contain images from the commercial games discussed as visual references.
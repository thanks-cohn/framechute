# SUBSTRATE — From the Little Globe to a Living World

**Status:** Product pitch / proposed experience, not an implemented feature.  
**Related:** `worlds-rend-multiscale-perspectives-descent-and-engine-handoff.md` and `worlds-rend-agent-native-spatial-desktops.md`.

## The pitch

SUBSTRATE begins with a **small, rotatable globe**: a charming miniature representation of the user's desktop. Exaggerated buildings, landmarks, islands, or other recognizable structures mark actual desktop locations, projects, and workspaces. The user spins the globe, chooses a location, and clicks it.

A brief animated **descent** carries the camera toward that selected place. The viewpoint then **tilts upward**: a beautiful sunny sky appears, or perhaps a slightly overcast afternoon, a heavily overcast sky, twilight, or a star-filled prairie night. As the camera settles, the little globe gives way to the *inside* of the chosen world. We are no longer looking at a map of a place; **we are there**, surrounded by its sky, horizon, scenery, and reachable destinations. A prairie at night can be the default starting world, with other moods and environments selectable per location.

This is **one recognizable destination across multiple presentations**, not a globe that disappears forever or a separate unrelated game. The globe remains the navigational hub. The user can return to it, select another location, or open a normal desktop resource directly without an animation.

## Descent and arrival

1. **Globe / overview:** rotate the small world; oversized buildings and landmarks make desktop destinations easy to identify and select.
2. **Selection / approach:** highlight the chosen location and begin a short, skippable camera move toward it. Assets for the destination can load behind the transition.
3. **Look up / reveal:** the camera tilts from the miniature land toward the sky. The sky may be bright and sunny, lightly clouded, largely overcast, dusk, or a clear starry night. The weather and time of day establish the mood of the actual destination.
4. **Arrival / inhabit:** the view settles at a human or character scale *inside* that location — perhaps an open prairie beneath a night sky, a sunny field, or a compact navigable ship. The user's selected movement/presentation mode takes over.
5. **Return / switch:** rise back to the globe, jump to a different destination, or go straight to conventional windows and files. Preserve the selected place and the user's work.

The animation does **not** require constructing a continuous, fully modeled 3D planet or generating unseen sides of 2D artwork. A simple zoom, tilt, sky reveal, crossfade, and mode-specific arrival scene can deliver the intended feeling quickly.

## Three user-selectable ways to inhabit the same place

The destination, file links, permissions, and important state are the same. Its visual complexity and controls change to suit the user's hardware and preference:

- **3D walkable mode — stronger computers:** arrive in a fully navigable, stylized 3D prairie, village, or other environment. Walk through it and look around freely; use atmospheric sky and lighting where affordable.
- **2D / 2.5D RPG mode — modest computers:** arrive as a controllable character in a top-down, isometric, or side-on RPG-like scene with convincing depth and a beautiful sky/horizon. Move between buildings, entrances, and workspace destinations without needing full 3D geometry.
- **Compact traversal mode — weakest computers or quickest build:** arrive in a constrained, side-view or layered 2.5D journey, reminiscent in *feel* of a contained airship/vehicle traversal in classic RPGs. A small set of scenic stops and interactive landmarks gives the sensation of traveling through a larger world with minimal rendering cost.

Offer an automatic recommended default based on observed rendering performance **and a manual choice**; do not equate device RAM alone with render capability. If a mode cannot load or runs poorly, move to a lighter presentation without losing the destination or the underlying workspace. The conventional flat desktop is always available.

## Fast first proof

Ship **one globe, one selectable building, one descent-and-look-up animation, and one prairie destination**. Start with a light 2D/2.5D arrival scene and a sunny or starry-sky option; add slightly overcast and heavily overcast sky treatments as inexpensive scene variants. Make the arrival navigable with a few clearly linked desktop locations. The 3D walkable scene and compact traversal version can be added as interchangeable renderers of the same place, not as prerequisites for the first demo.

**Core experience:** Rotate the little globe → click a desktop location → descend → look up to a beautiful sky → find yourself *inside* a living world → navigate it in 3D, RPG-style 2D/2.5D, or compact traversal mode according to hardware and choice.

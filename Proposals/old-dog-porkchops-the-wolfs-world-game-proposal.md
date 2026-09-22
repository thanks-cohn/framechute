# Game Proposal: OLD DOG PORKCHOPS — The Wolf's World

**Status:** Original game / boss-encounter concept and proposed ÆXIS engine showcase; design only, not implemented.
**Date:** 2026-09-22
**Homes:** Framechute and SUBSTRATE `Proposals/`.
**Related engine ideas:** artist-first animation, positional-truth character representations, 2D/2.5D/3D world descent, artist-controlled locked camera special moves and counters, dimensional emergence/collapse, and the ÆXIS character/style transposer. This is a **standalone game proposal**, not a request to change existing application behavior.

## 1. Premise and identity

**OLD DOG PORKCHOPS** is an eerie, funny, fairy-tale-inspired game encounter that begins as an advertisement and becomes a dimensional boss battle. Old Dog is the smiling, ravenous face of a suspicious meat brand seen all over the world. He is a **brown anthropomorphic wolf** called a dog; little pigs repeatedly object that he is clearly a wolf, while other characters insist he is clearly a dog. He does not need to resolve the argument.

He is no polished salesman. His recognizable original silhouette: worn straw hat; broad upper body; patched, weather-beaten professor's tweed jacket; exactly one suspender; torn pants; toeless socks; a bib; fork in one paw and spoon in the other. He looks shabby, hungry, pleased with himself, comically ecstatic, and a little malicious. His chin rises to howl an elongated O-vowel while he eyes the pork chops directly beneath him. Perspective can exaggerate his upper body with a restrained fisheye effect. He is funny before he becomes frightening; the comedy **must survive** his frightening phases.

His fictional product artwork uses a vintage print aesthetic and original artwork, not copied frames or a particular studio's character design. On the posters retain:
- Brand: **OLD DOG PORKCHOPS**
- Ecstatic call: **“GOOOOD!”**
- Product slogan: **“A LITTLE RAGGED, A LOT MORE FLAVOR”**; optional alternate line **“NOW SERVING 25% MORE MEAT!”**
- Badge: **“EST. 1932”**
- Other badge: **“STILL HUNGRY, STILL SMILIN’”**

The cheerful commercial styling is deliberate: the audience initially regards Old Dog as a silly mascot rather than a looming fight.

## 2. Long-form foreshadowing — from poster to predator

Throughout ordinary exploration, the world contains many Old Dog posters, product labels, storefront signs and other tasteful sightings. Near the game's later sequence, the advertisements begin to change *incrementally*: less comfortable eyes, more direct gaze, broader smiles, aggressive poses, swollen ink, unsettling red accents, subtly animated print. Do not overplay the earliest changes or force every player to notice. The pig/dog running joke can recur.

At the reveal, the protagonist enters an **otherwise empty room with a single Old Dog poster**. Sound and clutter drop away. The printed surface swells and bubbles; the wolf's body and pork chops strain against paper as something tries to burst through. The protagonist flees. In the town square, they briefly believe they are safe—until perspective and surface detail reveal the **entire square is a gigantic Old Dog poster**. The square itself bubbles and swells. It was not one haunted image: Old Dog can propagate his image through and impose its logic on the environment.

The square changes color, first sepia and then an ominous red/green-corrupted print treatment. Old Dog's outline, color and body become increasingly alive, while the city and protagonist lose ordinary dimensionality. The player discovers that the creature can pull others into its medium, not simply step out of a framed image.

## 3. Dimensional phase language

Use a dramatic **white flash** as a repeatable visual grammar for swaps between an illustration/plane and a developed, rigged 3D character. It can cover switching assets, camera rigs and shader modes without pretending the engine automatically generates a perfect rig from any drawing. The special creature can appear first in 2D, swell through its flat shell, and eventually burst into a 3D form while retaining selective **cartoon logic**: elastic limbs, inflated gloves/paws, exaggeration, flat silhouettes, implausible props, and local changes to the world's appearance and action rules.

Keep **character identity, canonical position, health, encounter state and actions** distinct from the selected visual representation. An artist can supply counterpart art and animation; an optional style transposer converts compatible player characters to the encounter's look. Both art-only conversion and deeper movement/camera-rule conversion must be deliberate and declared rather than silently assumed. If matching artwork/rig is unavailable, provide a clear supported fallback rather than promise automatic hand-drawn equivalence.

## 4. Near-defeat transition — “I always hated that city air.”

Late in the urban fight, when Old Dog appears nearly finished, he suddenly **lunges at the protagonist** instead of simply dying. A threatening filter switch tears through the scene, followed by a cool, bomb-like white burst. For one suspended instant, Old Dog is seen as a raw pencil/ink sketch outline between representations.

When vision returns, the protagonist looks down at their own hand. It has changed: their body is now stylized according to **Old Dog's drawn world**. The camera reveals an old rural landscape—dusty roads, fences, distant fields, old houses, storybook sky and vintage illustrated shading. Old Dog is already there, at ease, smugly picking his teeth and watching his guest.

He says, **“I always hated that city air.”**

This line is both a joke and the mechanical reason he brought the protagonist here: **in his own world he can huff and puff freely**. The urban fight may look more imposing and elaborate, but the rural domain gives his folklore power room to work. Do not characterize the rural phase as a simple downgrade or an arbitrary second boss health bar.

## 5. Rural phase — pathetic tricks, real damage

Old Dog now fights like a grubby old cartoon nuisance. His low-rent toolkit is intentionally almost laughable:
- Smack the protagonist with a frying pan, including a distinct ringing hit reaction.
- Toss dirt into the protagonist's eyes, briefly interrupting sight or aim with an intelligible, recoverable status effect.
- Poke or jab with a stick, potentially from a ludicrously exaggerated reach.
- Fumble, slip, miss, pant, posture, pick his teeth, taunt or perform other sloppy feints.

**These moves do real gameplay damage**; the joke is in their visual staging, not that the player or boss is invulnerable. Old Dog also visibly **takes damage**: rubber-hose squash, dented pan, face contortions, exaggerated recoil, rumpled clothing, and an increasingly irritated expression. He should grow genuinely angry as attacks land. Keep the escalation from comfortable buffoonery to wounded pride to sudden fury legible without dropping the comic personality.

Use the rural world's authored cartoon rules for stretch, timing, camera, impact, prop presentation and local scene deformation. An advanced creator may give Old Dog camera-locked signature attacks and hand-authored 2D animations while underlying positional/hitbox truth persists. The player should be able to read attack windups despite deliberately silly poses.

## 6. Signature attack — the huff and puff

At a significant combat beat Old Dog plants his feet, gets furious, and draws in **an absurd volume of air**. His chest and cheeks swell beyond normal anatomy, his coat and bib strain, grass and loose objects lean inward, the illustrated horizon deforms, and a prominent inhalation warning tells the player what is coming. Then he huffs and puffs with a devastating blast across the arena.

**Design intent: the attack is not spatially dodged.** Jumping does not bypass it; sprinting out of a simple wind cone is not the solution. Its challenge is **timing**, such as bracing, guarding, anchoring or a specifically taught counter on a clear release cue. An ordinary failed response can remove **half the player's then-current health**, independent of how much damage they previously dealt to Old Dog. Damage dealt to him during the windup does not trivialize the signature move. A successful timed response mitigates the loss or otherwise preserves survival according to the final combat tuning; do not claim an arbitrary automatic dodge or a permanently unavoidable scripted death.

The apparent slapstick phase makes the giant huff/puff all the more startling: the monster's signature folklore attack is devastating in precisely the rural reality where he feels most comfortable. Author clearly readable anticipation, a learnable timing window and a recovery phase so the attack feels punishing but fair. Define health rounding, minimum surviving HP, cooldowns, accessibility timing options, checkpoint behavior and repeated-attack limits during implementation. Do not confuse this conceptual half-current-health signature with a finalized balance table.

Possible spectacle: distant rural houses flex, fences blow apart as *game-world props*, the camera compresses/locks for the burst, wind lines fill the 2D plane, and the protagonist's new art style stretches under the impact. None of these game effects may damage real desktop content, files, or workspace state.

## 7. ÆXIS creator-facing feature showcase: character transposer

The encounter should demonstrate an optional **style/representation transposer** for compatible player characters made with the engine:
1. Creators define one durable entity ID and canonical state, plus 3D and/or 2D visual variants, rig/animation mapping, pivot points, scale, collision conventions and material/shader style.
2. A scene or boss ability declares a target art-style package (here: aged rural ink-and-paper cartoon) and camera/gameplay policies.
3. During the white transition, the game switches or adapts the player's visual representation into that style while preserving identity, health, equipped abilities and permitted world position.
4. The protagonist inspects their newly illustrated hand as an intentional in-game confirmation of transposition.
5. On leaving the domain, the character returns to their previous permitted representation with persistent gameplay state intact.

The feature is a **creator-controlled capability**, not a universal promise that any arbitrary uploaded 3D model becomes beautiful hand-drawn animation automatically. Offer: (a) an authored matching 2D pack, (b) a sprite/plane render or toon/ink shader fallback, and (c) advanced mapped rig/deformation for authored hybrid behavior. Expose conversion preview, camera lock, asset requirements, hitbox/contact overlays, and a clear distinction between changing only appearance versus changing movement and interaction rules. Support creator-defined transitions and reversibility.

Use budget-friendly preloading and clip reuse: the white burst masks art/rigger swaps but is not itself a substitute for preloading large assets or measuring performance. On lower-end hardware permit sprite/plane versions with the same encounter state and timing semantics. The encounter should be playable without forcing every creator to build two complete independent characters.

## 8. Narrative / gameplay beats for an initial vertical slice

1. Place a harmless branded poster and a gradually corrupted variant in a short navigable city route.
2. Empty room, poster bulge, escape route and town-square-as-poster reveal.
3. Urban first fight with localized cartoon effects and a near-defeat trigger.
4. Wolf's lunge → ominous filter → white blast → sketch intermediary → protagonist's transformed hand → rural reveal.
5. Old Dog tooth-picking and “I always hated that city air.”
6. Comically low-rent but damaging rural attacks (pan, dirt, stick); wolf receives funny damage reactions and gets angry.
7. Telegraph, timed defense and devastating half-current-health huff/puff.
8. Continue combat, resolve encounter and return from Old Dog's visual domain while preserving canonical character state.

The initial slice can use a simple original 2D drawing, lightweight planes, fixed rural camera, conservative collision volumes, and a preauthored player-style variant. Advanced mesh unfolding, universal transposition, full hybrid cartoon physics and world-scale artistic transformations can be incremental future extensions. Let creators replace every sample image, rig and animation with their own original assets.

## 9. Quality bar and rights

- **Storytelling:** posters evolve gradually, empty room and square reveal are distinct surprises, wolf is smug before furious, and the rural destination explains the huff/puff rather than merely relocating the fight.
- **Combat:** pan/dirt/stick have real consequences; Old Dog visibly takes damage; huff/puff tests well-telegraphed timing, not jumping; health impact is explicit and tunable.
- **Engine:** representation switches preserve identity and combat truth, only declared art/logic changes occur, camera transitions remain readable, and fallbacks run on modest devices.
- **Originality:** fairy-tale wolf and vintage mascot *ideas* are points of inspiration; create original character art, performance, packaging, sound and animations rather than reusing a particular studio's protected expressive design. Verify the final commercial name/branding before release.
- **Scope:** this is a **proposed game and engine showcase**, not existing gameplay, a commitment that the transposer is implemented, or permission to alter a user's actual workspace or documents during fictional dimensional events.

**Core payoff:** “I always hated that city air.” Old Dog drags the player into a ridiculous hand-drawn countryside, plays the shabby fool with pans and sticks, and then, furious, breathes away half their health. The hand-drawn style is no mere filter: in ÆXIS, it is a domain, a character capability and a creator-authored way to experience the same living entity across media.

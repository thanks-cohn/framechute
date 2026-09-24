# Creator battles, cinematic moves and Nemesis rivals

**Status:** Long-range cross-repository proposal. No multiplayer event, combat system, broadcast director, cash prize program or employment program is shipped by this document. Shared across Tiled-223D, SUBSTRATE and FrameChute.

## The vision

People who create games and worlds on the platform can bring their characters, styles, worlds and signature move sets into a shared competition. A creator's character carries the myth built in their own game: a crossover matters because players already know what that creator can do. The event can be streamed live with a deliberate broadcast language, original music chosen by engineers and DJs, and camera angles that show both the spectacle and the actual play.

A recurring event pits a small Creator team against a larger challenger team in a wide, destructible or movable world. The Creator has ordinary player-scale speed, damage and basic combat rules, but a larger health pool sized to survive focused team attacks. Their advantage is familiarity with their world and a deep library of prepared moves. One opposing creator may also have a deep move library; other competitors, including Creator teammates, bring a bounded match kit of roughly 20 moves each. Library size is not the same as simultaneous active moves, free damage or immunity. Define a fair match loadout and consistent resource, cooldown, range, warning, collision and counter rules.

## What a fight can look like

A scissors-wielding challenger begins with a playful tombstone-cup flourish, then lands shockingly precise hit after hit. A voice declares **“INSOLENCE”** and calls comets into the arena. The camera first shows their scale, then follows the challengers as they dodge, parry or counter.

A Creator special move projects a giant image behind them: *“It was over before it began.”* Hand signs summon afterimages and shadow aspects that strike across the team. Each strike remains readable and parryable. The Creator raises a hand, eyes glowing red, and sends one player to a temporary shadow realm, leaving a silhouette behind. A broad directional blast makes the rest reposition rather than tracking them unavoidably. The shadowed player needs a defined return, counter or rescue route. Camera close-ups and the soundtrack make the sequence frightening without hiding timing or changing its mechanical result.

A challenger grows into a giant toon beast. The Creator answers: *“Beautiful form. But who do you think built that style? HENSHIN.”* The transformation creates a kaiju-scale duel with slower, weighty movement. Both sides land visible hits; the broadcast gives the challenger credit for real openings. Teammates fight around them. Later: *“It was fun, but I think we've overstayed.”* A hand sign, fire breath and a clap send flame forward. Challengers can build similarly spectacular moves under the same combat rules.

These are examples of authored choreography, not mandatory attacks or scripted victories. Player input and match state decide hits, parries, dodges, defeats and wins. The broadcast can select views and effects, never falsify an outcome or conceal counterplay.

## Shared world actions become combat tools

The world-building verbs can eventually be used live: place a GLB, lift it, carry or throw it, and preview its landing. The same applies to a building or identified landmass if the event rules allow it. Creators can provide lift, flight, throw, landing and impact animations, including waves or dust. Authoritative world state keeps object identity, support, collision, terrain, ownership and undo separate from the animation. The simulation validates a placement or throw against protected regions, distance, mass/scale, occupancy and event budgets. Lower-end machines may display inexpensive visual proxies while receiving the same authoritative result.

This depends on earlier work: stable world/landmass IDs, precise placement and spatial operations, GLB import, deterministic simulation, validated moves and eventually networked play. Do not describe it as a capability of today's local world API.

## Move authoring and broadcast format

Provide a versioned move package with creator identity and rights, character/asset dependencies, semantic phases (wind-up, active, recovery), targeting and hit volumes, costs, cooldowns, counters, accessibility cues, and optional transformation, camera, audio, VFX and animation tracks. A submitted move must have a readable beginning, action and result. It can be cinematic and original without forcing a camera cut on the player's own view.

Competitors submit a playable move set and a small broadcast package before an event. Validate performance, visibility, counter windows and licensing. A camera director may choose wide scale shots, player close-ups, special-move angles and replays, with priority rules so simultaneous moves do not cause incoherent cuts. Preserve an uncropped player view and authoritative replay/timeline for adjudication. Engineers and DJs select or create the soundtrack for the live broadcast; music changes presentation, not match timing. Creators may design their own styles and camera suggestions without acquiring control of other players' inputs or the match outcome.

## Recurring Nemesis competitors

A returning competitor can earn **Nemesis status** through a published, measurable rule rather than favoritism. Track event-specific history: encounters, survival, progress, damage avoided/dealt, successful counters, assists, objectives, wins and noteworthy creator rivalries. Display a compact Nemesis card with statistics whose definitions and season boundaries are clear. A competitor chooses their own public Nemesis name, subject to ordinary moderation and uniqueness rules. The Creator can recognize them on stream: *“Well, if it isn't my nemesis…”*

Nemesis status is an identity and storytelling layer. It must not silently grant combat power or override matchmaking. Offer players control over whether a recurring rivalry is publicly highlighted, and reset or archive seasonal stats explicitly.

## Prizes and credibility

Proposed tiers for the Creator event:

| Result | Cash | Employment outcome |
| --- | --- | --- |
| Defeat the Creator under the event's published win condition | **$5,000 per winning player** | An offer for a salaried game developer role, subject to terms disclosed before entry |
| Reach the published high-progress threshold but lose | **$2,000 per qualifying player** | **Possible** job offer; no guarantee |
| Win the Creator event in two consecutive years | **Eligible for a $100,000 team prize**, divided among the qualifying teammates under published rules | No additional job offer is implied by this tier |

For the two-year tier, publish what counts as the same team, the qualifying roster for each year, whether substitutes qualify, and the division formula before the first qualifying event. Winning twice establishes eligibility for the team prize; it does not silently trigger payment without the published conditions and verification. The $100,000 is a shared team amount, unlike the $5,000 per-player victory prize.

Before holding a paid event, define qualifying progress, team size, prize pool, tie/disconnect handling, eligibility, regions, tax/payment treatment, cheating rules, dispute procedure and who receives a job offer. Publish role, salary range, work arrangement and hiring criteria before promising an offer. Do not equate a strong match with demonstrated professional development skill without a clear hiring process. These are future event terms to design and fund, not a current promotion.

## Delivery order and proof

1. **World/asset truth:** stable IDs and transforms for maps, GLBs, landmasses, placement and movable objects. Verify saves, collisions, permissions and protected geography on the existing low-end target.
2. **Authorable combat prototype:** two characters, a small set of submitted moves, readable telegraphs, parry/dodge responses, a deterministic combat log and an offline replay. Test equal basic stats and a team-scaled health pool.
3. **Creator tools:** versioned move packages, 20-move bounded match loadout, transformation and world-action prototypes, validation and creator-editable camera/VFX suggestions.
4. **Broadcast rehearsal:** a spectator director and music timeline driven by the authoritative replay. Test simultaneous special moves, camera priority, readable counters and a fallback stream on constrained hardware.
5. **Networked event pilot:** server-authoritative matches, latency handling, adjudication, moderation, anti-cheat and published rules. Only then consider cash prizes and employment offers.
6. **Recurring seasons:** opt-in Nemesis identities, named rivalries, well-defined statistics and archival across seasons.

A low-end player must be able to participate with reduced effects and the same hit/counter truth. Spectacle and rich broadcast rendering can scale separately. No specific prize, staffing commitment or launch date exists until independently announced and funded.

## Repository responsibilities

- **Tiled-223D:** world identities, placement, terrain/GLB motion semantics, cheap previews, deterministic operations and spatial validation.
- **SUBSTRATE:** creator workspace, permissioned authoring of characters and moves, linked 2D/3D views and event tools.
- **FrameChute:** interoperable visual frames, animation/camera composition, broadcast assets and creator-facing presentation controls.

See the shared `artist-first-endless-worlds-and-editable-sky.md` proposal for the broader world-building foundation. This document extends its creator agency into playable and spectated events.
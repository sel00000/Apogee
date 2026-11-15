# Traces of Earth

Twelve spacecraft are placed at current UTC positions from NASA/JPL Horizons:
Juno, Mars Reconnaissance Orbiter, Mars Odyssey, Webb, Juice, Psyche, Dawn,
STEREO-A, New Horizons, Voyager 1, Voyager 2, and the ISS. Eleven archival models
are shared across these targets (the Voyagers share a design). The source library
remains untouched; runtime assets are in `public/assets/spacecraft/`.

Games start at Uranus or Neptune (earlier Jupiter journeys resume where they were).
Every new route passes Mars as its last stop before Earth (a Mars-only detour always
fits the 35% route budget), because the relay there is the journey's one required
encounter. No spacecraft is moved onto the route; availability and proximity follow UTC. On
2026-09-29 the craft sit here relative to today's routes (Uranus → Jupiter → Mars →
Earth, 24.2 AU; Neptune → Saturn → Mars → Earth, 31.4 AU):

| Craft | Where | Met |
|---|---|---|
| Mars Odyssey, MRO | ~3,700 km from Mars, 295–7,457 km apart | every route; the required relay after reaching Mars |
| Juno | 5.4–5.7 million km from Jupiter | Uranus route, after reaching Jupiter |
| JWST, Juice, ISS | near Earth (L2; 0.5–2.4 million km, receding; low orbit) | free roam after the homecoming |
| Dawn | ~3,700 km from Ceres | free roam, a Ceres detour |
| Psyche, STEREO-A, New Horizons, Voyagers | near no world | not encountered |

## Encounter

Voice only; there is no panel. Once a flight has settled (8 s) and the dialogue has
been quiet for 3 s, an unobscured live craft within 8 million km becomes a faint
scanner contact: it joins Bearings as an UNIDENTIFIED OBJECT and Astra says there is
a tiny object out there. Until you are home, craft within 8 million km of a route world
you have not reached yet (Earth included) wait until you arrive there, even if you fly
there out of order, so the Mars pair belongs to Mars and the near-Earth craft never
interrupt the homecoming approach. Astra speaks at most once every three
minutes (the Mars pair gets one line); the bearing moves to the contact only when she
speaks, and never away from the next world's bearing.

Fly within 10,000 km of an eligible craft and the ship brakes. The test is swept along
each frame's path, so a fast or time-compressed pass still counts. The view then glides
in (a log-distance dolly, 2.5–4.5 s, straight at first, arcing over its close half so
the craft's world sits beside it rather than behind it) and holds alongside in the
craft's frame, at a distance that fits the model to the narrower screen axis. On the
first inspection Astra identifies it and a short exchange follows; later inspections get
one line (batch12: no screen copy after it; craft launched after 2017 are named with their year). The view orbits
slowly about the axis away from the craft's world; drag, A/D, the arrow keys and
Shift/Space orbit it, and the wheel dollies when touchpad scrolling is set to thrust.
W or S (or the thrust wheel), X, Escape or another target releases the view where you
are, restoring the bearing you had (or the next world), and the look eases onto that
bearing (over the limb of a world in the way, just clear of the craft), so W leaves the
craft behind. With the approach assist on, a craft that cannot be captured (already
inspected, just left, or waiting for its world) is a 25 km bumper: the ship holds there
and Astra mentions it once. Craft within 15,000 km are
then disarmed until the ship is farther than that, so the Mars twin cannot regrab you;
selecting a craft revisits it deliberately. With reduced motion the glide is a cut and
the hold does not orbit by itself.

Ordinary scans identify spacecraft within 1,000 km; the hold identifies them too. These
scanner ranges are fictional instrument capabilities, not optical visibility. Encounters
are optional, except the relay below, and never prevent arrival at Earth; the journey
waits during a view. After the homecoming nothing is unknown: scans identify craft at any
range, a detected craft joins Bearings under its own name, and Astra names it instead of
calling it a tiny object. It counts towards VEHICLES once scanned or held alongside.
Detected and examined craft persist per starting world; Reset game clears them.

## The relay

Arriving at the last world before Earth (Mars on every new route), Astra says "you made
it to Mars. we're nearly there." and then hears something still transmitting; the
Traveller asks "to who?". The journey enters a `relay` stage: the craft joins Bearings
as an UNIDENTIFIED OBJECT, selected, and Earth's bearing waits. Candidate order: a live
craft within 8 million km of that world (Mars Odyssey, then MRO; Juno if an older route
gates at Jupiter), an unobscured one first; otherwise Webb, at least 300,000 km from
Earth; otherwise the relay is waived and the journey plays as before. Arrival waits for
the spacecraft feed's first attempt after a reload. The Mars twin beside it is marked
detected without a line.

The craft, and any craft beside it, are unarmed until the introduction has finished and
the dialogue has been quiet for 1.5 s, so the glide answers "to who?". Parked above Mars
(on the approach assist's stand-off shell), the relay is already within 10,000 km and the glide
starts by itself; from farther out you fly to it (steering cues and the target guide
point at it when nothing else is chosen). While the introduction plays, the approach
assist keeps a ship flying at the selected relay 8,000 km from it, inside the capture
sphere, so arriving early never overshoots; inside that shell, turning away holds the
ship there too (with the assist off there is no hold). If Mars hides it, the guide reads
FAR SIDE OF MARS and Astra says it's round the far side: look along the horizon and fly
round.

Holding alongside either Mars twin completes the relay as the hold begins: the craft's
name joins the route (`RELAY · MARS ODYSSEY` in the flight log and film), Earth returns
to Bearings, and after the usual first-inspection lines Astra borrows its bearing and
sends a hello ("will anyone answer?"). Releasing the view selects Earth and turns the look
onto it (over Mars's limb when Mars is in the way), so W heads home. On the last leg,
after 1.5 s of silence and either 10 s of flight since the hold ended or within 150 million km
of Earth, Earth answers once. Routine approach notices wait until the reply is heard. If the feed later drops the relay, the next candidate
takes over silently, or Astra says it has gone quiet and selects Earth. Earth's arrival
always ends the journey, relay or not. Saved routes without Mars are re-planned unless
their journey is already under way. The relay lines are drafts in the *Traces of Earth*
section (labelled "The relay · …").

The VEHICLES total (shown after the homecoming) counts live craft within 8 million km
of a catalogued world, plus any already found, so every counted vehicle can be reached,
detected and identified. It reads 7 today and 6 once Juice leaves Earth's neighbourhood
(about 6–7 October) unless Juice was already found.

The first inspection includes the player lines **“it came from Earth, too…”** and
**“ask me when we land”**. All lines are in the narrative editor's *Traces of Earth*
section. The future-relic framing is fiction; it does not assert that a present mission
has ended.

## Cassini's Grand Finale (historical scene)

Cassini is not a live craft. Its mission ended on **15 September 2017**, when it was
sent into Saturn's atmosphere so that it could never contaminate Enceladus or Titan.
It never joins the spacecraft feed, the Bearings or the bodies list. Once you have
arrived at Saturn (identified, inside its arrival sphere, slow), the view leaves the
ship for one short **archive reconstruction**, timed to Astra's line:

- **"there was once a probe called Cassini here."** Three illustrative Grand Finale
  loops draw on from the ship, threading the gap between the cloud tops and the rings,
  and a marker rides the final orbit. Toast: `CASSINI · 1997–2017 · ARCHIVE RECONSTRUCTION`.
- **"it spent thirteen years watching Saturn and its moons."** The view glides in. The
  NASA model's feature edges sweep on as a wireframe, then the solid craft fades in under them.
- **"when its work was finished,"** the wireframe and the orbits leave, and the camera
  chases the craft down toward the limb.
- **"they sent it into the atmosphere."** The camera stops 8,000 km above the clouds.
  The craft sinks toward the haze and fades out gently, with no flare.
- **"to protect the worlds it had helped them understand."** The view pulls back to the
  ship, and Saturn, its rings and its moons come back into frame. Caption:
  `GRAND FINALE · 15 SEP 2017 · ILLUSTRATIVE DESCENT`.

**What is real and what is staged.**
- Real: the date, the 62° inclined orbits with periapsis in the ring gap, entry about
  1,900 km above the clouds, and the high-gain antenna held on Earth.
- Staged from your own position: the orbit's orientation, the camera, the timing and
  the sink. These are chosen so the descent is lit (from Saturn's night side the craft
  comes down beyond the limb, into the day), the glide stays well clear of the clouds and
  the Sun stays out of frame. It is not Cassini's reconstructed trajectory or attitude.
- The model is NASA's *Cassini-Huygens (A)*, credit NASA/Brian E. Kumanchik
  (`docs/cassini/README.md`).

**Who hears what.**
- The first viewing plays the full line. If the journey still owes the fire conversation,
  the scene carries it (**"it came from Earth too. humans can't help but to explore."**,
  then the relic).
- If another probe already told it, the coda is **"it came from Earth too."** instead.
- Every later return to Saturn, from beyond twice its arrival radius (free roam
  included), replays the descent silently.
- Thrust (Space and Shift too), Escape or another target returns you to the ship at once;
  View console ends the scene before it opens. Astra always finishes her sentence.

## Position data and failure behavior

`/api/live/spacecraft` assembles independently cached mission ephemerides. Each
mission has a six-hour cache with the existing five-minute failure cooldown and
serialized JPL requests. Planet orbiters (including ISS and Dawn) use one-minute
samples; cruise trajectories use hourly samples. The same UTC Hermite sampler and
ICRF → `[x,z,-y]` render transform as the planets are used. Flight time compression
does not advance the sky. No extrapolation is allowed outside supplied windows.

A failed mission does not suppress other spacecraft. Missing/expired states are
hidden, and the client retries a failed refresh after five minutes. Each mission
gets its own D1 cache row, keeping dense orbital sample tables below the 2 MB row
limit. Saved spacecraft-relative anchors resolve through `/api/live/body/<id>`.
ISS uses Horizons target `-125544`; its duplicate CelesTrak `25544` marker is omitted.
Other station traffic continues to use SGP4.

These are ephemeris predictions, not a live telemetry stream. Dawn's trajectory is
a long-term estimate after tracking ended in 2018; the Sources dialog notes this.
STEREO-B is excluded because its available ephemeris ended in October 2024.
The feed provides no measured spacecraft attitude.

## Model treatment

Models load when a craft is detected or captured, or once it resolves to a few pixels. Draco was decoded
offline; no runtime decoder or external model request is needed. Every runtime
GLB has zero Khronos validation errors. Total model assets: about 53.7 MB, fetched
individually. Webb uses the lighter source model, not the 1,600-mesh alternative.

Authored source units are calibrated to published dimensions. Most use maximum
model extent; named solar panels or dishes calibrate STEREO, Odyssey, New Horizons
and Voyager. Their whole-model spans are approximately 6.47, 8.27, 3.31 and 16.41 m
respectively. This is an approximate visual calibration of archival meshes.
The fixed model orientation is illustrative. The inspection material preserves
texture/colour, uses the live solar direction and adds a small display fill so
shaded details remain visible. Positions and model scale are not enlarged.
Only distant point markers are amplified for visibility. Seven detached, disc-shaped
helper nodes in the NASA ISS source are omitted at render time; the three assembled
station meshes are preserved. Source GLBs are unchanged.

Credits, original URLs, checksums and conversion provenance are in the runtime
manifest and README. Original materials, transforms and image bytes are retained
in the GLBs; the runtime inspection material replaces lighting only.

## References

- [NASA/JPL Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
- [JPL API fair-use requirements](https://ssd-api.jpl.nasa.gov/doc/)
- [Juno spacecraft](https://www.jpl.nasa.gov/news/press_kits/juno/spacecraft/)
- [Dawn spacecraft](https://science.nasa.gov/mission/dawn/technology/spacecraft/)
- [Webb sunshield](https://science.nasa.gov/mission/webb/webbs-sunshield/)
- [Psyche spacecraft](https://science.nasa.gov/mission/psyche/spacecraft/)
- [Juice specifications](https://www.esa.int/Science_Exploration/Space_Science/Juice/Juice_spacecraft_specs)
- [STEREO spacecraft](https://stereo-ssc.nascom.nasa.gov/spacecraft.shtml)
- [Voyager dimensions](https://science.nasa.gov/mission/voyager/frequently-asked-questions/)
- [MRO press kit](https://www.nasa.gov/wp-content/uploads/2015/03/119004main_mro.pdf)
- [Mars Odyssey press kit](https://assets.science.nasa.gov/content/dam/science/psd/mars/downloadable_items/4/4/44750_odysseylaunch.pdf)
- [New Horizons press kit](https://www.nasa.gov/wp-content/uploads/2015/03/139889main_presskit12_05.pdf)
- [ISS dimensions](https://www.nasa.gov/international-space-station/space-station-facts-and-figures/)

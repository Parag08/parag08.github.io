# The descent — 3D prototype

A standalone Three.js/WebGL scene with a rigged human avatar, a light climbing helmet,
a backpack, a narrow rocky trail, trekking poles, sunrise lighting, and real shadows.
The scene sits on the right of the page. At the top, the hiker stands upright
facing the sunrise with hands resting on planted trekking poles. Breathing, occasional glances and
a small weight shift suggest a quiet pause; scrolling eases into the trek downhill.
The portfolio's homepage uses this journey at `../index.html`; `../about.html` redirects there.
The previous homepage is available from **Old Site** at `../old-site.html`.
The standalone prototype remains available in this folder.

## Website integration

`../index.html` reuses the career chapters and text unchanged, with a personalised
opening introducing Parag as a Product Manager and a short career summary.
The scroll arrow gently nudges downward, pauses outside the opening, and respects
reduced-motion preferences. The existing site navigation, mobile menu, footer,
page title and metadata are retained.
`about-journey.css` applies the website's grey/white surfaces and its existing
blue, indigo, gold, peach and teal accents. Alternating surfaces and accent
dividers distinguish the roles. These integration styles apply only to the journey homepage.

The homepage restores the original loading screen, cycling Hello → नमस्ते
(Hindi) → 你好 (Singapore Mandarin) every 900 ms while loading. `../journey-loader.js`
waits for `journey:ready`, emitted only after the hiker is loaded and rigged,
the backdrop and fonts are ready, shaders are compiled, and the first scene frame
is rendered. Download progress and preparation milestones update its percentage.
Repeat visits and reduced-motion settings still wait for that first frame; the
old homepage retains its quick loader. Scene errors release the page, and slow
connections expose an optional Continue button after eight seconds. With JavaScript
disabled, the loading overlay is hidden and the career text stays accessible.

The site entry point loads the shared navigation script, this folder's CSS and
ES module, and an import map pointing to the local Three.js library. Model and
module paths resolve relative to `descent.js`; the site's footer is excluded
from the climber's scroll range, so arrival still happens at the last chapter.

## Preview

Serve the repository over HTTP (ES modules and model loading need a server):

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Visit http://127.0.0.1:8765/mountain-demo/. Scroll down to descend and up to
retrace the route. The climber turns to face uphill while ascending, with knees,
feet, and arms oriented uphill. The camera follows along the trail, showing
only the nearby ledge. **Closer look** zooms toward the avatar; **Trail view**
restores the wider framing.

The sunrise opening is followed by seven employer chapters, latest first:
Valeo Health, Strymin (formerly EverHaus Group), Nutanix (both roles in one chapter), Touchnote, Eleven01, Amantya and
Cognizant. Each employer has its own full-screen section with dates, location,
company context, responsibilities and results. Education and a closing profile
with contact links follow. On narrow screens content may grow rather than clip.
The original opening copy and scene are retained; its scroll link now leads to
the latest experience. The descent spans the entire career timeline, while the
sunrise remains confined to the opening section.

Every employer has a distinct pastel background, matching heading accents and a
visible chapter boundary. The canvas keeps the same size across all chapters,
including the opening-to-first-role transition on mobile.

## How it works

Scroll distance drives the avatar position and alternating steps. Two-bone
inverse kinematics places the feet on the same centerline used to construct
the trail surface. The arms move with alternating trekking poles. A sample
Ready Player Me human model supplies a real skeleton, face, clothing, and skin
textures. The helmet, rucksack, poles, trail, sunrise, and motion are built for
this demo. The sunrise fades as the hiker leaves the summit; scrolling back to
the top restores the resting pose and sunrise.

The hiker wears a modern Decathlon-style blue technical shell with dark panels,
a stand collar, front zip, pocket zips, and a small chest wordmark. The long coat
torso is replaced by a hip-length skinned jacket body that uses the original
skeleton and sleeves. Charcoal hiking shorts, blue-and-white athletic trail shoes,
the earlier light helmet with blue trim, and a compact navy backpack complete the
outfit. The shoes have light foam soles, dark tread, blue uppers, and lace details
that move with the feet.
The shorts have an above-knee hem and a relaxed fit. Bare knees and calves are
attached to the existing leg bones so they follow the climbing and walking poses.

The route is approximately 23 world metres for the current ten chapters, about
three times the original distance. `trail.mjs` generates additional descending
bends for each chapter added to `main`, preserving the flat summit and arrival.
The path's shoulders start with raised snowbanks, gradually reveal rocky ground,
and become green with grass tufts lower down. The center stays clear underfoot.
Climate follows the position along the route, so going uphill returns to snow.
Snowbanks use instancing and trail grass shares one geometry to limit draw calls.
The sun and its shadow target follow the hiker along the longer route.

A continuous snowy summit ridge follows the trail elevation smoothly downhill,
with lower distant peaks showing the height of the vista. The ridge extends behind
the opening stance to support the hiker and planted poles. Shared vertices give
the terrain smooth shading. Solid terrain fills the outer side of the scene, away
from the text, dropping from snow into rocky ground and meadow. Instanced evergreen trees appear below the snow line and become more
frequent lower down. The walking lane stays clear. Mobile shows half the trees,
and its camera keeps the hiker larger while cropping the outer scenery.

The walking strip has soft edges rather than exposed vertical side walls. Vertex opacity feathers its outer
edges, while static soft cloud banks follow both sides and the summit edge. The center
stays readable underfoot while the clouds drift gently in the wind.

At the bottom, the trail levels onto a fixed clearing with gravel texture, small
rocks, a green perimeter, grass, and contact shadows. Clouds thin out as the hiker approaches
this solid ground. The clearing is stationary in the scene.

The summit backdrop is a single static image (`assets/summit-sunrise.jpg`), with
layered snowy peaks and a sunrise. It stays still behind the 3D hiker and softly
fades as the summit is left behind. The image is approximately 280 KB.

The speaker icon next to **Closer look** enables or mutes mountain sound, muted
by default. `sound.mjs` creates soft wind and naturalistic walking textures locally
with Web Audio after a click. Alternating footfalls follow the avatar's .60-metre
stride in both directions; snow crunch gradually becomes gravel and grass.
Footsteps stop when the hiker stops, and reduced-motion jumps do not trigger
skipped footsteps. Wind continues softly while sound is enabled, using native
audio nodes without an extra animation loop. Hiding the tab, leaving the page,
or losing the WebGL context suspends sound. The icon has an accessible label and
pressed state; unsupported browsers keep it hidden. No audio downloads are needed.

Idle motion uses a 30 FPS frame budget, while scroll, zoom and pose transitions
keep full frame-rate feedback. Trees sway around their fixed roots, with crowns
and snow caps following the same movement. Idle motion pauses when the tab is
hidden or WebGL is unavailable; reduced-motion preferences keep the environment
and summit pose still. Feet and pole tips stay anchored during the idle sequence. The walk uses
speed and acceleration limits, longer strides, and eased changes in direction
and body height. Deep links start at their actual scroll position, and elapsed
time is capped after a paused tab. Pixel ratio is capped at 1.5 and shadows use a
1024-pixel map. Reduced-motion preferences remove smoothing and stepping; direct
scroll feedback remains. The overlay permits page clicks except on its camera
and sound buttons. On phones, the scene scales down; reserve space when integrating it.

## Add it to your website later

1. Keep `descent.js`, `motion.mjs`, `trail.mjs`, `sound.mjs`, `avatar.mjs`, `landscape.mjs`, `idle.mjs`, `assets/`, `models/`, and `vendor/` together in this directory.
2. Copy the `<aside class="descent">…</aside>` into your page.
3. Copy the CSS beginning at `/* TRAIL COMPONENT`, plus the `.descent*`
   declarations inside the media queries. Demo page typography is independent.
4. Copy the `importmap` in `index.html`, adjusting the `three` path for your page.
5. Load `<script type="module" src="mountain-demo/descent.js"></script>`.
6. Adjust `.descent`'s width, right, bottom, and the stage height to suit the page.

All engine and model files are hosted locally. No runtime CDN or build step is
required. The sample avatar can be replaced with a custom glTF model; this
prototype expects the named humanoid bones used by Ready Player Me/Mixamo.

## Motion checks

From the repository root, run `node --test mountain-demo/tests/*.test.mjs`.
Checks cover large scroll jumps, long/negative frames, smooth reversals, exact
arrival, reduced motion, and consistent pace at 30/60/120 FPS. Trail checks cover
route growth, walkable slopes, level arrival, and gradual snow-to-green transitions.
Sound checks cover muted startup, toggling, hidden tabs, navigation, rapid clicks,
permission failures, and footfall timing at 30/60/120 FPS in both directions.
Avatar checks use the shipped GLB to verify cuff weights and prevent stretched
sleeve strips during arm movement. Landscape checks verify finite geometry,
clear walking lanes, the tree line, and responsive tree density.
Loader checks cover first-frame gating, cached state, model/import failures,
slow connections, reduced motion, and compatibility with the previous homepage.
Earlier browser checks
also verify identical canvas dimensions before and after entering the first role.

## Asset credits

- Three.js 0.186.1, MIT. License: `vendor/THREE-LICENSE.txt`.
  Source: https://www.npmjs.com/package/three/v/0.186.1
- Sample avatar: © Ready Player Me, from the Three.js examples
  `examples/models/gltf/readyplayer.me.glb`:
  https://github.com/mrdoob/three.js/blob/dev/examples/models/gltf/readyplayer.me.glb
  The original model metadata and copyright remain embedded in the GLB.
- Demo font: the portfolio's existing self-hosted Inter, with Arial fallback.
- Summit backdrop: generated with the built-in imagegen tool, then encoded as
  JPEG for the website. Exact generation prompt: `assets/summit-sunrise.prompt.txt`.

[![make.fun · gta6-cover-art-01](https://make.fun/badge/gta6-cover-art-01.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![rank](https://make.fun/badge/gta6-cover-art-01/ndus/makefun-gta6-cover-art/rank.svg)](https://make.fun/bounty/gta6-cover-art-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)
[![reward](https://make.fun/badge/gta6-cover-art-01/ndus/makefun-gta6-cover-art/reward.svg)](https://make.fun/bounty/gta6-cover-art-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-cover-art-01)

# Vice Poster Studio

Your photos, recast as a cinematic city story. Vice Poster Studio is an original multi-panel cover maker with angled frames, warm neon color, oversized lettering, and a quiet dark editor. It uses no official game artwork, logos, characters, or fonts.

## Open the studio

Run `node serve.ts` with Node 22 or newer, then open the local page on port 8080 in desktop Chrome. No installation or build step is needed. You can also open `app/index.html` directly; the page includes an embedded ES-module fallback and smaller embedded sample-photo copies for local-file browsing, keeping PNG export safe under Chrome’s local-file origin rules. All assets stay within the app, with no remote services or network dependencies.

1. Pick a layout. Two included sample photos let you explore immediately.
2. Add multiple photos with the file picker or drop them onto the photo area.
3. Click a preview frame or its numbered button, then click a tray photo to assign it. Drag the preview to crop, use the zoom slider, or use arrow keys for precise movement (Shift moves faster). The reset button restores the selected crop.
4. Write a title and subtitle, choose a color grade, and select your export format.
5. Click **Export your cover** to download a full-resolution PNG without editor selection marks.

Photos are decoded on your machine through local object URLs. Nothing is uploaded; there are no accounts. Work lives in the current tab, so export before closing or refreshing it.

## Four compositions, four moods

- **Collage Five** places a large hero frame between four angled supporting frames.
- **Triptych** uses three slanted vertical slices.
- **Duo Split** pairs two photos across a diagonal seam.
- **Hero Solo** gives one photo the entire canvas.

Each frame has its own photo, position, and zoom. Reuse a favorite photo across frames or assemble a cast from separate images. Switching layouts preserves the five available frame slots.

**Vice Sunset** blends apricot and magenta; **Neon Night** shifts toward teal and pink; **Gold Hour** warms the scene with honey tones; **Clean** retains the original photo colors. All four receive the studio's restrained vignette, procedural grain, frame lines, and lettering. Available PNG sizes are 1080 × 1080, 1080 × 1350, and 1920 × 1080.

## How it is made

Everything is drawn with Canvas 2D. Normalized polygon paths define the composition, and each photograph is scaled to cover its own panel before clipping. Per-frame offsets and zoom provide independent crops with edge limits. Thin light borders sit over dark seams. Gradient blend passes create the grades; radial shading and a seeded pixel texture add depth and consistent grain. Identical inputs produce identical renders.

The renderer draws the title in heavy system capitals, fits each line to the available width, and adds gradient color, an outline, and a shadow. Subtitle and cover credit are canvas text too. There are no downloadable fonts or third-party runtime packages.

The code is split into `app/src/cover.js` (rendering and geometry), `main.js` (editor state and interactions), and `shots.js` (deterministic scene setup). The local-file fallback embeds the same modules in `index.html`; when maintaining the source, keep that fallback synchronized. The served editor loads the source modules directly.

## Scenes and packaging

`shots.json` defines four intended captures: a landscape cover, the editor, a portrait cover, and a square cover. Scene parameters support `layout`, `grade`, `size`, `photos` (comma-separated `boulevard` and `pier`), `title` (use `|` for a line break), and `subtitle`. `?shot=cover` fills the viewport with the poster, while `?shot=editor` seeds the editor. `window.__shotReady` becomes true two animation frames after the images and canvas are ready.

Run `mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts` to copy the app and existing screenshots into `out/` and generate `out/dossier.json` using the unmodified vendored packager. Screenshot images are captured separately; the current capture folder is retained for the next pass.

MIT licensed. The two supplied sample images are included for experimenting with the editor.

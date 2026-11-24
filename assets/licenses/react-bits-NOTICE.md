CircularGallery engine adapted from DavidHDev/react-bits main, retrieved 2026-10-23.
Original copyright (c) 2026 David Haz. MIT + Commons Clause license accompanies this source.
Only the rendering/interaction engine is adapted; no React runtime, external font loader or sample images are included.

Masonry interaction reference: DavidHDev/react-bits, src/content/Components/Masonry/Masonry.jsx,
consulted 2026-10-27. The local native DOM adaptation in src/masonry-gallery.js uses
the requested column-width layout and interaction contract with the portfolio's
existing local pictures, batch loader and Lightbox. No demonstration images or
external runtime dependencies are included. The accompanying license is retained.

StarBorder, Magnet and Lanyard interaction references consulted 2026-11-04:
https://reactbits.dev/animations/star-border
https://reactbits.dev/animations/magnet
https://reactbits.dev/components/lanyard
The scoped src/creative-interactions.* files are independently written native
DOM/SVG/CSS adaptations of the requested behaviour. No React, Three.js,
physics runtime, remote models, sample images or React component source was used
for that earlier DOM version.

Lanyard update, 2026-11-25: src/vendor/lanyard-scene.js and lanyard-physics.js adapt
the Three.js geometry, lighting, joint constraints, rotational inertia and
pointer picking from the React Bits Lanyard source supplied by the site author.
src/portrait-lanyard.js connects it to the static About page, bilingual semantic
controls, the existing portrait and an existing-data back face. Three.js 0.170.0
is provided locally under its MIT license (assets/licenses/three-LICENSE.txt).

TargetCursor reference consulted 2026-11-04:
https://reactbits.dev/animations/target-cursor
src/home-target-cursor.* is an independently written, Home-only native DOM/CSS
reticle implementation. No React component code or animation dependency is used.

TechText interaction reference consulted 2026-11-06:
https://reactbits.dev/text-animations/tech-text
src/welcome-motion.* independently implements a native canvas letter-outline
effect and three scroll-driven text stages. It retains the portfolio's local
fonts and semantic heading; no React component source or runtime is included.

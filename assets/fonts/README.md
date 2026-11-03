# Local portfolio fonts · batch 9

Vendored on 2026-11-03 from the official Google Fonts CSS2 distribution. The website contacts no external font service. Exact sources, local filenames and license URLs are recorded in `manifest.json`.

- Instrument Serif: display titles, upright 400.
- DM Sans: body/UI upright 400, 500, 600; genuine italic 400 for the English Footer tagline.
- Noto Serif TC: Traditional Chinese display glyphs, upright 500.
- Noto Sans TC: Traditional Chinese body/UI glyphs, upright 400, 500, 600.

The Noto TC families are the Google Fonts Traditional Chinese distribution corresponding to the Source Han serif/sans design direction. Their official WOFF2 unicode shards are retained, not bundled into a single full CJK download. Reused URLs across weights refer to the same downloaded file. There are 222 unique active WOFF2 files; a page requests only the ranges it uses. English pages request no CJK shards. Latin text on Chinese pages uses Instrument Serif or DM Sans first.

`faces.css` defines the locally hosted faces with `font-display: swap`. `../typography.css` defines display, body and unchanged brand roles. Fonts are not stretched or given synthesized weights/styles. Only the two primary upright Latin files are preloaded; Chinese shards and the real italic face load on demand.

Each family includes its unmodified SIL Open Font License in a matching `*-OFL.txt`. Keep those files with the fonts. To refresh the official distribution, run `node scripts/prepare-fonts.mjs` (network access required), then `npm run build`. An environment with an enterprise proxy may need `node --use-system-ca scripts/prepare-fonts.mjs`. Ordinary builds/dev preview use the checked-in local files and require no font downloads.

The original Barlow/Inter files and licenses are retained only for historical comparisons; there are no active faces, preloads or requests for them. Do not re-record the immutable pre-batch-9 card baseline: the regression test explicitly excludes the newly authorized font/title-case changes while still comparing artwork, colours, spacing and interaction transforms.

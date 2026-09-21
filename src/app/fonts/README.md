# Self-hosted fonts

Nunito (body) and Baloo 2 (display), served from the app instead of fetched
from Google at build time.

## Why these are in the repo

`next/font/google` downloads the font files during `next build`. When that
request fails the whole build fails, with a `module-not-found` on the
generated `[next]/internal/font/google/…module.css`, and it takes the
deployment with it. That happened twice on this project, once on production,
where a failed build means `main` looks merged while the old bundle keeps
serving. Self-hosting removes the network from the build entirely.

## What these files are

Variable fonts (one file per family, every weight), subsetted to exactly the
`latin` + `latin-ext` ranges Google serves, which is what the app requested
before. Nothing was lost in the subsetting: every codepoint each font has in
those ranges is still present. `latin-ext` matters beyond accents here, since
it carries the IPA and modifier letters used by pronunciation strings.

| File | Family | Axis | Size |
|---|---|---|---|
| `Nunito-Variable.woff2` | Nunito | `wght` 200-1000 | ~58 KB |
| `Baloo2-Variable.woff2` | Baloo 2 | `wght` 400-800 | ~51 KB |

Both are SIL Open Font License 1.1; the licenses sit beside them and must stay
with the files.

## Regenerating

Sources are the variable TTFs from the `google/fonts` repo
(`ofl/nunito/Nunito[wght].ttf`, `ofl/baloo2/Baloo2[wght].ttf`). With
`fonttools` and `brotli` installed:

```bash
LATIN="U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"
LATIN_EXT="U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF"

pyftsubset "Nunito[wght].ttf" --output-file=Nunito-Variable.woff2 \
  --flavor=woff2 --unicodes="$LATIN,$LATIN_EXT" \
  --layout-features='*' --name-IDs='*' --notdef-outline
```

The ranges are Google's own, copied from the `css2` API response; re-check
them against that response if you regenerate, since Google revises subsets.
Do not pass any instancing flags: the `wght` axis has to survive, or the
weights collapse to one.

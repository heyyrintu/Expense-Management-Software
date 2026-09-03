# Fonts

Self-hosted, loaded by `app/layout.tsx` through `next/font/local`. Why they
are here rather than fetched through `next/font/google` is explained at the
top of that file: the rupee sign lives outside Google's `latin` subset, and
the automatic fallback fetched 109 KB of `latin-ext` on every screen.

| File | What it is | Served |
|---|---|---|
| `inter-latin.woff2` | Inter, variable weight 100–900, Google Fonts `latin` subset | preloaded |
| `inter-symbols.woff2` | Inter, only the glyphs in `GLYPHS` (`scripts/subset-symbol-fonts.mjs`) | on first `₹` |
| `bodoni-moda-latin.woff2` | Bodoni Moda, variable weight 400–900 + `opsz` axis, Google Fonts `latin` subset | preloaded |
| `src/inter-latin-ext.woff2` | Google Fonts `latin-ext` subset — the INPUT to the subsetter, never served | — |

Bodoni has no companion on purpose: `globals.css` resolves the rupee sign in
a hero amount from Inter so it matches every other amount on the screen.

Both families are published under the SIL Open Font License 1.1
(Inter © The Inter Project Authors; Bodoni Moda © Indestructible Type). The
files are byte-identical to what Google Fonts serves for the named subsets.

To add a glyph that Inter or Bodoni has but `latin` lacks (another currency
sign, say), add it to `GLYPHS` in `scripts/subset-symbol-fonts.mjs`, run the
script, and commit the regenerated `*-symbols.woff2` together with the change
that uses the glyph. `tests/unit/font-symbols.test.ts` holds the outputs to
the list.

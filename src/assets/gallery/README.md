# Workshop photos

Drop the course photos in here, then list them in the `gallery.items` array of
`src/data/de.json` and `src/data/en.json`:

```json
{ "file": "workshop-01.jpg", "caption": "Workshop vor Ort", "alt": "…" }
```

- The `file` value must match the filename exactly.
- Originals straight from camera or phone are fine — Astro resizes them to
  400/800/1200px WebP at build time.
- An entry whose file is missing is skipped; the whole section disappears if no
  photo resolves, so the build never breaks on a typo.
- `alt` describes the photo for screen readers and search engines; `caption` is
  the line printed under it.

Only use photos where recognisable participants have agreed to appear on the
website.

# parag08.github.io

Personal site for **Parag Rahangdale** — INSEAD MBA candidate in Singapore, targeting product manager
and program manager roles.

Live at **https://parag08.github.io** (GitHub Pages, built from the root of `main`).

Static HTML/CSS/JS. No build step, no bundler, no package manager — the files in this repo *are* the
site. The only runtime dependency is THREE.js, **vendored locally** under `mountain-demo/vendor/` and
loaded through an import map in `index.html`, so nothing is fetched from a CDN.

## Pages

| Path | What it is |
|---|---|
| `index.html` | Home — scroll-driven mountain journey through career history, experience and education, with a 3D workspace hero |
| `about.html` | Background and profile |
| `work.html` | Case-study index, styled as game save slots (gaming theme, Three.js cartridges) |
| `work/nutanix-files-migration/index.html` | Files migration at Nutanix — first case study in the gaming "results screen" layout |
| `work/nutanix-esxi-to-ahv/index.html` | In-place ESXi-to-AHV conversion at Nutanix (slot 02) |
| `work/nutanix/index.html` | Earlier Nutanix page, unlinked from the index until its stories are rewritten |
| `work/valeo-health/index.html` | Route optimisation at Valeo Health |
| `work/everhaus/index.html` | AI-enabled investment platform (Strymin, formerly EverHaus Group) |
| `projects.html` | Projects: case studies, working demos and project summaries |
| `old-site.html` | Previous homepage — 3D workspace, impact metrics, skills, project links (kept for the archive; no longer linked from any page) |
| `valeohealth.html` | Standalone Valeo Health case page |
| `contact.html` | Email, LinkedIn, résumé |

Two self-contained sub-apps:

- `setld/` — "Settld" mobile product demo (relocation concierge). Own `styles.css`, `app.js`,
  `assets/`. See [`setld/README.md`](setld/README.md).
- `mountain-demo/` — the THREE.js scene that powers the home-page journey: `landscape.mjs`,
  `avatar.mjs`, `descent.js`, `models/`, `assets/`, and a pinned `vendor/` (three.module.js,
  GLTFLoader, RoundedBoxGeometry, SkeletonUtils, BufferGeometryUtils — see `THREE-LICENSE.txt`).
  See [`mountain-demo/README.md`](mountain-demo/README.md).

## Styles and scripts

| File | Role |
|---|---|
| `style.css` | Base site styling and layout |
| `about-journey.css` | Scroll-driven career journey on `about.html` |
| `home-hero.css` | Landing hero and HUD-style motion layer |
| `projects-japan.css` | Recent-builds section with Japanese accents |
| `arcade.css` | Gaming accents for the case-study pages: save slots, boss bars, inventory, scoreboard |
| `arcade-scenes.js` | THREE.js scenes for the case-study pages (save-slot cartridges, data-flow) |
| `script.js` | Shared page behaviour (nav, reveals, motion) |
| `home-workspace.js` | THREE.js 3D workspace scene on the home hero |
| `journey-loader.js` | Journey loading state / readiness handshake |

## Machine-readable bits

- `llms.txt` — LLM-facing description of the site and its pages
- `sitemap.xml` — canonical page list
- `robots.txt`
- `favicon-32.png`, `apple-touch-icon.png`

## Local preview

Serve over HTTP — ES modules, the import map and the `.mjs` scene files will not load from `file://`:

```bash
python3 -m http.server 5177 -b 127.0.0.1
```

Then open <http://127.0.0.1:5177/>.

## Deploying

Push to `main`; GitHub Pages rebuilds from the repository root.

```bash
git add -A && git commit -m "…" && git push
```

Check <https://parag08.github.io> a minute later. When you add or rename a page, update `sitemap.xml`
and `llms.txt` to match.

## Editing notes

- Every page is standalone HTML: header, nav and footer markup are repeated per page, so a nav change
  means touching each page in scope (plus `old-site.html` if it should stay consistent).
- `assets/fonts` and `assets/projects` hold ~7 MB of static media; keep large video out of the repo
  where possible.
- `work/` pages and `projects.html` cards share a layout — copy an existing one as a starting point.

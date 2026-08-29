# Reference material

Source material for the build. Nothing here is imported by the application —
the working copies of the brand assets live in `apps/web/public/brand/`.

| File | What it is |
| --- | --- |
| `build-spec.md` | The original specification this store was built from |
| `design-reference.png` | Approved homepage design — the visual target |
| `logo-source.png` | Short Fuse logo, white on transparent → `public/brand/logo.png` |
| `hero-source.jpg` | Live promo shot used for the hero → `public/brand/hero.jpg` |
| `skull-source.png` | Flaming skull from the sidebar → `public/brand/skull.png` |

## Where the build departs from the spec

Three deliberate decisions, each made with the band:

**No separate Fastify API on Railway.** The spec proposed a standalone REST API.
Everything runs on Vercel instead: Next.js route handlers are the API and Server
Components read Postgres directly. The benefit the separate service was really
buying — testable business logic independent of the framework — is delivered by
`packages/core` instead, which holds every pricing rule and imports nothing from
Next. One deployment, no CORS, no HTTP hop on catalog pages.

**Categories keep their Big Cartel names.** The design mock's navigation reads
SHOP / T-SHIRTS / MUSIC / HATS / ACCESSORIES / PHOTOS. The imported data has
eight categories including Albums, Headwear, Drinking Buddies and Tote Bags. The
band chose to keep the source names, so the nav renders eight items from the
database rather than the mock's six. Renaming later is a row edit, not a code
change.

**Headings use Oswald, not the mock's brush face.** The display font in the
design is not freely licensed. The logo is a real image asset and carries the
extreme typography on its own, so headings use a heavy condensed grotesque with
CSS grain over the page. Swapping in a licensed face means editing
`apps/web/src/lib/fonts.ts` only.

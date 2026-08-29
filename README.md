# Short Fuse Store

Custom merch store for the band **Short Fuse**, replacing their Big Cartel shop.

Next.js storefront + admin, Postgres via Drizzle, Stripe Checkout for payment.
Deployed to Vercel with a Neon database.

---

## Quick start

```bash
pnpm install
docker compose up -d          # local Postgres on :5433
cp .env.example .env          # then fill in the blanks (see below)
pnpm db:migrate
pnpm db:seed                  # store settings + order counter
pnpm catalog:import           # 30 products from the Big Cartel export
pnpm dev                      # http://localhost:3000
```

Set an admin password before using `/admin`:

```bash
pnpm admin:password 'a-long-password-you-choose'
# copy both printed values into .env
```

---

## Layout

```
apps/web/          Next.js — storefront, /admin, and the API routes
packages/db/       Drizzle schema + committed migrations
packages/core/     Pricing, cart validation, shipping, offers — pure, no framework
packages/shared/   Zod contracts, enums, money helpers
scripts/           Big Cartel importer, admin password generator
data/products.json The Big Cartel export the importer reads
docs/              Design reference and the original build spec
```

**`packages/core` is the important boundary.** Every calculation that decides
what a customer is charged lives there, framework-free and unit-tested. The
route handlers are thin wrappers over it. If you need a standalone API service
later, `packages/core` lifts out unchanged.

---

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Storefront + admin at :3000 |
| `pnpm build` | Production build |
| `pnpm test` | Vitest — money logic, sanitization, auth, webhook idempotency |
| `pnpm typecheck` | TypeScript across all packages |
| `pnpm db:generate` | Generate a migration after editing the schema |
| `pnpm db:migrate` | Apply pending migrations |
| `pnpm db:seed` | Insert the singleton settings and order-counter rows |
| `pnpm db:studio` | Drizzle Studio |
| `pnpm db:reset` | Drop and recreate the schema (refuses to touch Neon) |
| `pnpm catalog:import` | Import the Big Cartel catalog (idempotent) |
| `pnpm admin:password '…'` | Generate `ADMIN_PASSWORD_HASH` |

---

## Environment

See `.env.example` for the full list. The ones that matter:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | Local Docker Postgres, or the **pooled** Neon string in production |
| `NEXT_PUBLIC_SITE_URL` | Absolute origin, no trailing slash |
| `ADMIN_PASSWORD_HASH` | From `pnpm admin:password` |
| `ADMIN_SESSION_SECRET` | 32+ random bytes — `openssl rand -base64 32` |
| `STRIPE_SECRET_KEY` | Test key locally, live key in production |
| `STRIPE_WEBHOOK_SECRET` | Differs between `stripe listen` and the deployed endpoint |
| `BLOB_READ_WRITE_TOKEN` | Optional; without it the importer mirrors to local disk |

Next only reads `.env` from the app directory, so `apps/web/next.config.ts`
explicitly loads the repo-root `.env`. That keeps `pnpm dev` and
`pnpm db:migrate` reading the same file.

---

## Stripe in development

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
# copy the printed whsec_… into STRIPE_WEBHOOK_SECRET, then restart pnpm dev
```

Test card `4242 4242 4242 4242`, any future expiry, any CVC.

**An order only becomes `PAID` from a signature-verified webhook.** Reaching the
success page proves nothing — the customer could navigate there directly, or
close the tab before Stripe redirects. If you check out without `stripe listen`
running, the order correctly stays `PENDING` and the confirmation page says
"confirming your payment". That is the system working.

---

## Architecture notes

**Server authority.** The browser sends product ids, size ids, quantities, an
offer id and a country. It never sends prices. `/api/cart` and `/api/checkout`
both reload every product from the database and recompute the total through the
same `priceCart()` function, and the Stripe line items are built from *that*
result. A tampered `localStorage` changes what the customer sees, never what
they are charged — there is a test for exactly this.

**Shipping before payment.** Stripe Checkout collects the address *after* the
session is created, so it cannot pick a destination-based rate for you. The
review step at `/checkout` asks for the country first, quotes the flat rate from
it, and locks the Stripe session to that one country — otherwise a customer
could be quoted the US rate and ship to Australia.

**Order snapshots.** `order_items` copies in the product name, slug, size and
price. Nothing renders a historical order by joining back to `products`, so a
later price change or a deleted product cannot rewrite a receipt.

**Webhook idempotency.** Every Stripe event id is inserted into `webhook_events`
under a unique index before the event is handled. A redelivery loses that insert
and returns 200 without touching the order. Verified with a concurrency test.

**Cart offers.** Four fixed trigger types, not a rules engine. Eligibility is
judged against the cart *excluding* the offer line, so accepting an offer can
never be what makes that offer qualify.

**Taxes.** Off for v1 — the band is not registered to collect anywhere. Orders
still carry `taxCents`, and the webhook records whatever Stripe reports, so
turning on Stripe Tax later is a config change rather than a migration.

---

## Deployment

### Neon

1. Create the project and copy the **pooled** connection string (the one
   containing `-pooler`).
2. `DATABASE_URL='<pooled string>' pnpm db:migrate && pnpm db:seed`
3. `DATABASE_URL='<pooled string>' pnpm catalog:import` for the initial catalog.

The database client picks its driver from the URL: Neon's serverless driver for
`*.neon.tech`, plain postgres.js otherwise. Nothing else in the app knows.

### Vercel

- Root directory: repository root (it is a pnpm workspace).
- Build command: `pnpm build` · Install: `pnpm install`
- Environment variables: everything from `.env.example` except `DATABASE_URL`,
  which should be the pooled Neon string. Set `NEXT_PUBLIC_SITE_URL` to the real
  domain.
- Vercel's Hobby plan prohibits commercial use in its terms; a shop taking money
  needs Pro.

### Stripe webhook in production

Add an endpoint at `https://<your-domain>/api/stripe/webhook` subscribed to:

```
checkout.session.completed
checkout.session.async_payment_succeeded
checkout.session.async_payment_failed
checkout.session.expired
charge.refunded
```

Copy that endpoint's signing secret into `STRIPE_WEBHOOK_SECRET` on Vercel — it
is **not** the same as the `stripe listen` one.

### Images

Product images currently live in `apps/web/public/media/` (gitignored, ~22 MB),
mirrored from Big Cartel at full resolution. For production set
`BLOB_READ_WRITE_TOKEN` and re-run `pnpm catalog:import` — it will upload to
Vercel Blob and rewrite the URLs. Already-mirrored images are skipped by source
URL, so re-running is cheap.

---

## Notes from the Big Cartel import

The export had four problems worth knowing about:

1. **`on_sale` is unrecoverable.** Six products are flagged on sale with
   `price === default_price`, so there is no original price to strike through.
   All are imported at face value with no sale price; set real ones in admin.
2. **Per-size stock does not exist.** Every option in the export has
   `sold_out: false`, including on products the store itself marks sold out. Size
   availability is therefore derived from the product's status.
3. **Six shirts only have Small and Medium** — Big Cartel appears to have dropped
   the sold-out size rows. Imported as-is, per the decision to stay faithful to
   the source.
4. **The trucker hats' `Style` options are junk** — all three carry an identical
   Gray/Green/Green Gray list. Non-size options are dropped, so they import as
   plain sizeless products.

`LOW_STOCK` cannot be inferred from Big Cartel at all and is set by hand.

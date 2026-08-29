# Short Fuse Merch Store --- Claude Seed Prompt

You are building a complete, production-minded but deliberately simple
ecommerce store for the band **Short Fuse**.

This is a small independent band merch shop, not a general-purpose
ecommerce platform. Keep the architecture clean, understandable,
maintainable by one experienced developer, and appropriately scoped. Do
not overengineer it.

The project should be a **TypeScript monorepo** containing the
storefront/admin frontend and backend API.

Before making major architectural assumptions that contradict this
specification, ask. Otherwise, proceed autonomously and build a strong
initial implementation.

------------------------------------------------------------------------

## 1. Core Goal

Replace the band's old Big Cartel shop with a custom Short Fuse
ecommerce store.

The store sells a small catalog of physical band merchandise:

-   CDs / albums
-   T-shirts
-   Hats / beanies
-   Pins
-   Flags
-   Tote bags
-   Photos
-   Drink coozies / bottle openers / miscellaneous merch

The catalog is intentionally simple.

Customers should be able to:

1.  Browse the shop.
2.  Browse a category.
3.  View an individual product.
4.  Select a size when a product has sizes.
5.  Add products to a cart.
6.  See manually curated related products.
7.  See simple cart upsell offers.
8.  Check out securely with Stripe.
9.  Pay a simple flat shipping rate based on destination.
10. Receive an order confirmation.

The band should be able to manage products, availability, categories,
recommendations, cart offers, shipping settings, and orders through a
lightweight admin interface.

------------------------------------------------------------------------

## 2. Guiding Principles

### Keep it simple

This is essentially a band's merch table with a database and Stripe
behind it.

Do **not** turn this into Shopify.

Do not add:

-   customer accounts
-   wishlists
-   reviews
-   loyalty programs
-   recommendation engines
-   numeric warehouse inventory
-   complex product option systems
-   role/permission systems
-   CMS infrastructure
-   print-on-demand integration
-   carrier-rate APIs
-   unnecessary microservices

Build the smallest good system that handles the requirements below.

### Own the store, not the card data

The application owns:

-   catalog
-   products
-   cart logic
-   prices
-   promotions
-   shipping rules
-   orders
-   fulfillment status

Stripe owns secure payment processing.

Never store raw credit card information.

### Server authority

Never trust prices, discounts, shipping amounts, product availability,
or promotional prices supplied by the browser.

The backend must recalculate and validate an order from authoritative
database data before creating the Stripe payment/checkout session.

------------------------------------------------------------------------

## 3. Proposed Technology

Use a monorepo with a structure along these lines:

``` text
short-fuse-store/
  apps/
    web/
    api/
  packages/
    db/
    shared/
  package.json
  ...
```

Recommended stack:

### Frontend

-   React
-   Next.js
-   TypeScript
-   Tailwind CSS
-   deployed to Vercel

Use Next.js for the storefront and admin UI. Favor
server-rendering/static rendering where it improves storefront
performance and SEO, while keeping interactive cart/admin functionality
client-side where appropriate.

### Backend

-   Node.js
-   TypeScript
-   Fastify preferred
-   REST API
-   deployed to Railway

Keep the API explicit and boring.

### Database

-   PostgreSQL
-   Drizzle ORM preferred
-   migrations committed to the repository

Railway can host the PostgreSQL database unless there is a compelling
reason not to.

### Validation/shared contracts

Use Zod where useful.

Shared types/schemas that genuinely belong to both applications should
live in `packages/shared`.

Do not create elaborate abstraction layers just because this is a
monorepo.

### Payments

Stripe.

Prefer Stripe Checkout for v1 unless the implementation strongly
benefits from Stripe Elements without significantly increasing
complexity.

Use Stripe webhooks to establish authoritative payment status.

### Images

Abstract product image storage behind a simple implementation so the
application is not tightly coupled to Big Cartel image URLs.

For the initial importer, existing Big Cartel image URLs may be imported
as remote image records. Design the admin so new images can later be
uploaded to a sensible object/image storage provider.

Do not make image-storage infrastructure block the first working
version.

------------------------------------------------------------------------

## 4. Product Model

Products are intentionally simple.

A product should support approximately:

``` text
id
name
slug
description
price
salePrice (nullable)
categoryId
availability
featured
active
sortPosition
createdAt
updatedAt
```

Use integer cents for monetary values.

Example:

``` text
priceCents = 2000
```

Never use floating-point currency calculations.

### Availability

There is no precise inventory count.

Use exactly these general availability states:

``` text
IN_STOCK
LOW_STOCK
SOLD_OUT
```

A product without sizes has product-level availability.

A product with sizes has availability per size.

The storefront should make LOW_STOCK noticeable without being obnoxious.

SOLD_OUT products may remain visible but cannot be purchased.

### Sizes

**Size is the only supported product variant.**

Examples:

-   Small
-   Medium
-   Large
-   X Large
-   XX Large
-   XXX Large
-   XXXX Large

Do not build generic option groups for Style, Color, Material, etc.

Different hat styles/colors should simply be separate products.

Model sizes cleanly enough that their display order can be controlled.

A product either:

-   has no sizes, or
-   has an ordered collection of sizes, each with its own availability.

### Product images

A product supports multiple ordered images.

One image should naturally act as the primary image based on its
position.

### Description

Product descriptions may contain structured formatting such as:

-   paragraphs
-   track listings
-   links to Spotify
-   Apple Music
-   Amazon Music
-   YouTube Music
-   etc.

Do not assume descriptions are only one plain-text sentence.

Sanitize any rendered rich/HTML content appropriately.

------------------------------------------------------------------------

## 5. Categories

Categories should support:

``` text
id
name
slug
sortPosition
active
```

Keep categories simple.

Initial categories can be derived from the imported catalog and cleaned
up later.

Examples include:

-   T-Shirts
-   Music / Albums
-   Headwear
-   Flags
-   Photos
-   Miscellaneous

The storefront needs category pages.

------------------------------------------------------------------------

## 6. Related Products

Related products are manually curated.

A product can have an **ordered list of related products**.

Implement this as a proper ordered relationship rather than dumping
product IDs into an opaque JSON field.

Example:

``` text
Grim Chronicles CD
  -> Our Darkest Future CD
  -> Annihilate the Masses CD
  -> related shirt
```

### Fallback behavior

When there are not enough manually assigned related products, the
storefront may fill remaining recommendation slots with active,
purchasable products from the same category.

Manual recommendations always come first.

Do not build a recommendation engine.

Suggested storefront heading:

**YOU MIGHT ALSO DIG**

------------------------------------------------------------------------

## 7. Cart

The cart should support:

-   product
-   optional selected size
-   quantity
-   authoritative price validation at checkout
-   removal
-   quantity changes
-   persistent browser storage

Keep the cart experience fast.

Do not require login.

The frontend may calculate/display estimated totals, but the backend is
authoritative at checkout.

------------------------------------------------------------------------

## 8. Cart Offers / Upsells

Support simple manually configured cart offers.

Example:

> ADD A STICKER FOR \$1

An offer should approximately support:

``` text
id
name
productId
offerPriceCents
active
triggerType
triggerProductId (nullable)
triggerCategoryId (nullable)
minimumSubtotalCents (nullable)
sortPosition
```

Keep trigger behavior intentionally limited.

Useful trigger types:

``` text
ALWAYS
CONTAINS_PRODUCT
CONTAINS_CATEGORY
MINIMUM_SUBTOTAL
```

Do not create a generic rules engine.

The backend must verify that the cart actually qualifies for the offer
before honoring the promotional price.

Cart offers are separate from product-page related products.

Suggested cart language:

**WHILE YOU'RE HERE...**

Example:

> Add a sticker pack for \$1

------------------------------------------------------------------------

## 9. Shipping

Use simple flat-rate shipping.

The shop should support:

-   United States
-   Canada
-   Other international destinations

The exact dollar amounts must be configurable through Store Settings
rather than hardcoded.

Conceptually:

``` text
US -> configurable flat rate
Canada -> configurable flat rate
International -> configurable flat rate
```

Also support:

``` text
internationalShippingEnabled
freeShippingThresholdCents (nullable)
```

Do not integrate live USPS/UPS/FedEx rate calculations for v1.

The checkout must clearly communicate international shipping cost before
payment.

Design the shipping logic so additional simple shipping zones could be
added later without rewriting checkout.

------------------------------------------------------------------------

## 10. Stripe / Checkout

Use Stripe for payment.

The expected flow is approximately:

1.  Customer builds cart.
2.  Frontend sends product IDs, selected sizes, quantities, and any
    selected cart offer to API.
3.  API reloads authoritative product data.
4.  API validates:
    -   products are active
    -   products/sizes are not sold out
    -   current prices
    -   sale prices
    -   cart-offer eligibility
    -   shipping rate
5.  API calculates authoritative totals.
6.  API creates pending order and Stripe checkout/payment session as
    appropriate.
7.  Customer completes Stripe payment.
8.  Stripe webhook confirms payment.
9.  Order becomes `PAID`.
10. Customer reaches an order-success page.

Webhook processing must be idempotent.

Never treat a browser redirect alone as proof of payment.

Store Stripe identifiers needed for reconciliation, refunds, and
debugging.

------------------------------------------------------------------------

## 11. Orders

An order should preserve a snapshot of what the customer purchased.

Do not depend on current product names/prices after an order has been
placed.

Order statuses:

``` text
PENDING
PAID
SHIPPED
CANCELED
REFUNDED
```

Order data should include:

-   customer name
-   email
-   shipping address
-   ordered items
-   product name snapshot
-   selected size snapshot
-   unit price snapshot
-   quantity
-   line totals
-   subtotal
-   promotional discounts where applicable
-   shipping
-   tax
-   total
-   Stripe references
-   order status
-   tracking number, nullable
-   internal notes, nullable
-   timestamps

Use cents for every currency amount.

Provide a human-friendly order number in addition to internal database
IDs.

------------------------------------------------------------------------

## 12. Taxes

Do not implement a homemade US tax rules engine.

Use Stripe's tax capabilities where appropriate.

Keep tax handling isolated enough that configuration can be changed
without rewriting the order model.

The order must store the final tax amount charged.

------------------------------------------------------------------------

## 13. Admin

Build a lightweight password-protected admin area.

This is initially for one administrator.

Do not implement roles or complex permissions.

Choose a simple secure authentication approach suitable for a
single-admin application.

The admin should feel functional and clean rather than carrying all of
the storefront's visual grime.

### Admin Dashboard

Show:

-   recent orders
-   paid but unshipped orders
-   low-stock products/sizes
-   quick links for Add Product and Orders

### Products

Product list:

-   name
-   category
-   price
-   active/sold-out status
-   featured
-   basic filters

Product editor:

-   name
-   slug
-   description
-   price
-   optional sale price
-   category
-   ordered images
-   availability
-   active/published state
-   featured
-   sort position
-   optional sizes
-   availability per size
-   manually ordered related products

Do not create a separate inventory-management application.

Availability is edited directly on the product/size.

### Categories

Support:

-   name
-   slug
-   sort position
-   active/inactive

### Orders

Show:

-   order number
-   date
-   customer
-   email
-   items
-   sizes
-   shipping address
-   subtotal
-   discount
-   shipping
-   tax
-   total
-   Stripe reference
-   status
-   tracking number
-   internal notes

Actions:

-   mark shipped
-   add/update tracking number
-   cancel where valid
-   refund through an appropriate server-side Stripe flow

Use confirmations for destructive/financial actions.

### Cart Offers

Admin should allow:

-   create/edit offer
-   select offered product
-   set promotional price
-   activate/deactivate
-   choose one simple trigger
-   configure trigger value
-   set sort position

### Store Settings

Support:

-   store name
-   contact email
-   US flat-rate shipping
-   Canada flat-rate shipping
-   international flat-rate shipping
-   international checkout enabled
-   optional free-shipping threshold

------------------------------------------------------------------------

## 14. Storefront Pages

Build these primary customer-facing routes:

### Home / Shop

The homepage is primarily the main shop landing page.

Include:

-   Short Fuse branding/logo
-   navigation
-   hero/banner
-   category navigation
-   featured merchandise
-   product grid
-   potentially additional category sections
-   cart access

### Category

Example:

``` text
/category/t-shirts
```

Include:

-   category title
-   product grid
-   clear sold-out/low-stock states
-   responsive layout

### Product

Example:

``` text
/product/atomic-mutation-t-shirt
```

Include:

-   large image gallery
-   product title
-   price / sale price
-   description
-   size selector when applicable
-   availability feedback
-   add to cart
-   manually curated/fallback related products

### Cart

Include:

-   line items
-   sizes
-   quantities
-   removal
-   subtotal
-   cart offer/upsell area
-   estimated shipping messaging
-   checkout CTA

### Checkout

Keep checkout visually quieter and extremely usable.

If Stripe Checkout is used, create an appropriate branded handoff/review
step before Stripe.

### Order Success

Show:

-   confirmation
-   order number
-   purchased items
-   amount
-   shipping destination summary
-   next-step messaging

Do not expose sensitive Stripe internals.

------------------------------------------------------------------------

## 15. Visual Direction

The approved visual direction is:

> **Old-school Hot Topic meets underground metal merch table, halfway
> between clean and grimy.**

The storefront should feel like a late-90s / early-2000s
alternative-metal shop updated with excellent modern ecommerce
usability.

### Core palette

Lean heavily toward:

-   black / near-black backgrounds
-   dirty white / off-white
-   **deep/blood red as the primary accent**

Red should be the dominant UI accent rather than green.

The merchandise itself may contain loud colors such as:

-   green
-   pink
-   orange
-   blue
-   purple
-   yellow

Do not force product photography into the red palette. Let merchandise
artwork provide its own color.

### Texture

Use restrained:

-   distressed borders
-   scratched/photocopied texture
-   screen-print imperfections
-   subtle grain
-   rough dividers
-   occasional stamped/torn-paper visual language

The design should feel intentionally worn, **not unreadable**.

Do not cover every surface with noise.

### Typography

Use a combination of:

-   a distressed/condensed display face for headings/navigation where
    readable
-   a clean condensed sans or highly legible sans for functional
    ecommerce UI

Do not use illegible death-metal typography for prices, buttons, forms,
size selectors, addresses, or checkout.

The Short Fuse logo itself supplies the extreme typography.

### Logo

The Short Fuse logo is a major visual anchor.

Give it generous presence, especially in the desktop header.

Do not attempt to typeset a fake version of the logo when the actual
logo asset is available.

### Homepage composition

The approved design concept includes:

-   large Short Fuse logo at upper left
-   horizontal navigation
-   cart indicator at upper right
-   left-side category navigation on wide desktop layouts
-   gritty black-and-white live-performance/mosh-pit hero imagery
-   red accent graphics/text
-   large FEATURED merchandise grid
-   loud product artwork against dark cards
-   restrained scratched borders
-   occasional red LOW STOCK / SALE treatments
-   strong bottom utility strip / reassurance elements

Possible hero language:

``` text
OFFICIAL MERCHANDISE
FROM THE DEPTHS
```

Copy may be refined later.

### Product cards

Product cards should prioritize the merchandise.

Use:

-   large product image
-   product name
-   price
-   optional size availability preview if useful
-   LOW STOCK or SALE treatment
-   hover image swap when a second product image exists

Avoid generic white ecommerce cards.

Avoid excessive metadata.

### Product page

On desktop, favor a large gallery with a substantial portion of the page
width and a clear purchasing panel.

The purchasing UI should be cleaner than the decorative outer shell.

Example hierarchy:

``` text
MAULED BY THE BEAST
T-SHIRT

$20

100% Cotton

S  M  L  XL  2XL  3XL  4XL

ADD TO CART
```

### Cart

The cart can retain the storefront personality, but purchasing
information must be immediately understandable.

Use a distinct cart-offer strip such as:

``` text
WHILE YOU'RE HERE...
ADD A STICKER PACK FOR $1
```

### Checkout

Turn the grime down substantially.

Use:

-   logo
-   black
-   off-white
-   red accent
-   clean fields
-   obvious validation
-   obvious totals
-   strong CTA

Checkout should feel secure and effortless.

### Responsive design

Mobile is first-class.

Do not merely collapse the desktop design.

On mobile:

-   compact header
-   menu/drawer for categories/navigation
-   large touch targets
-   product grid appropriate to viewport
-   sticky/obvious cart access
-   comfortable size selectors
-   clear add-to-cart controls
-   fast checkout path

Preserve the Short Fuse visual identity without allowing decorative
texture to consume limited screen space.

------------------------------------------------------------------------

## 16. Storefront Voice

The store can have some personality.

Avoid sterile boilerplate like:

``` text
Featured Products
Recommended For You
Shop By Category
```

Where appropriate, use Short Fuse-flavored language such as:

``` text
YOU MIGHT ALSO DIG
WHILE YOU'RE HERE...
WEAR SOME HATE
LISTEN TO SOME HATE
```

Do not let jokes obscure actions or checkout information.

Functional actions should remain obvious:

``` text
ADD TO CART
CHECKOUT
SOLD OUT
LOW STOCK
```

------------------------------------------------------------------------

## 17. Existing Big Cartel Import

The repository will be provided with a `products.json` export from the
old Big Cartel shop.

Build a one-time/importable seed script that transforms this data into
the new schema.

Preserve useful source data such as:

-   product names
-   slugs/permalinks
-   descriptions
-   prices
-   sale state/prices where inferable
-   active/sold-out state
-   categories
-   sort position
-   image URLs/order
-   sizes

### Important transformation rules

The Big Cartel data contains generic `option_groups`.

Do **not** reproduce that architecture.

Only import **Size** variants.

If an old product has a non-size option such as `Style`, do not create
generic style variants in the new system. These will be cleaned
up/manually represented as separate products.

Map old availability into:

``` text
IN_STOCK
LOW_STOCK
SOLD_OUT
```

Big Cartel cannot infer LOW_STOCK, so imported products should generally
map to either IN_STOCK or SOLD_OUT; LOW_STOCK can be assigned manually
later.

Preserve rich descriptions carefully and sanitize them at render time.

The importer should be idempotent or otherwise safe enough that
accidental reruns do not blindly duplicate the entire catalog.

------------------------------------------------------------------------

## 18. API Shape

Design a small REST API.

Likely public endpoints include concepts such as:

``` text
GET /products
GET /products/:slug
GET /categories
GET /categories/:slug/products
POST /checkout/session
GET /orders/:publicOrderReference
POST /stripe/webhook
```

Admin endpoints should cover CRUD operations for:

``` text
products
categories
related products
cart offers
orders
store settings
```

Do not mechanically follow this exact endpoint list if a cleaner REST
shape emerges, but keep the API small and obvious.

Validate request bodies.

Return consistent errors.

Do not leak stack traces or secrets.

------------------------------------------------------------------------

## 19. Security / Correctness

At minimum:

-   validate all API inputs
-   sanitize rich product descriptions
-   secure admin routes
-   hash passwords if password auth is used
-   rate-limit sensitive endpoints where appropriate
-   verify Stripe webhook signatures
-   make webhook handling idempotent
-   do not trust client totals
-   use environment variables for secrets
-   do not commit secrets
-   use secure production cookie settings if cookies are used
-   handle CORS explicitly between Vercel and Railway
-   protect refund/admin actions
-   log enough context to debug failed checkout/webhook flows without
    logging sensitive payment data

------------------------------------------------------------------------

## 20. SEO / Performance / Accessibility

This is a public band store, so basic SEO matters.

Implement:

-   semantic page titles
-   product/category metadata
-   Open Graph metadata
-   product image alt text
-   sensible canonical URLs
-   server-rendered product/category content where practical
-   sitemap
-   robots.txt

Performance:

-   optimize images
-   avoid shipping giant JS bundles
-   lazy-load noncritical product images
-   keep decorative effects CSS-oriented and lightweight where possible

Accessibility:

-   keyboard-accessible navigation
-   visible focus states
-   accessible dialogs/drawers
-   labels on forms
-   sufficient contrast
-   do not encode stock/sale state only through color
-   respect reduced-motion preferences

The gritty visual language must not compromise usability.

------------------------------------------------------------------------

## 21. Testing

Add focused tests around the things most likely to cost money or break
orders.

Prioritize:

-   authoritative cart price calculation
-   sale price handling
-   size availability
-   sold-out rejection
-   cart-offer eligibility
-   cart-offer promotional price
-   shipping-zone calculation
-   free-shipping threshold if configured
-   order-total calculation
-   Stripe webhook idempotency
-   payment status transitions

Do not chase arbitrary test-coverage percentages.

------------------------------------------------------------------------

## 22. Developer Experience

Provide:

-   clear README
-   local setup instructions
-   `.env.example`
-   database migration commands
-   seed/import command
-   dev command for the monorepo
-   production build commands
-   Vercel deployment notes
-   Railway deployment notes
-   Stripe webhook local-development instructions
-   concise architecture notes

Prefer a small number of predictable scripts.

Example desired experience:

``` bash
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Use the monorepo package manager/workspace approach consistently.

------------------------------------------------------------------------

## 23. Initial Build Order

Implement in coherent phases rather than generating disconnected
scaffolding.

Recommended order:

1.  Monorepo/workspace setup.
2.  Shared configuration/types.
3.  PostgreSQL schema + migrations.
4.  Big Cartel import/seed path.
5.  Public catalog API.
6.  Storefront shell and approved visual system.
7.  Home/category/product pages.
8.  Cart.
9.  Shipping calculation.
10. Cart offers.
11. Stripe checkout.
12. Orders + webhook.
13. Success flow.
14. Admin authentication.
15. Admin products/categories.
16. Related-product editor.
17. Cart-offer editor.
18. Orders admin.
19. Store settings.
20. Tests, security pass, accessibility pass, responsive polish.
21. Deployment documentation.

Keep the application runnable at meaningful checkpoints.

------------------------------------------------------------------------

## 24. Definition of Done for V1

V1 is done when:

-   the Big Cartel catalog can be imported
-   active products render correctly
-   sold-out products cannot be purchased
-   low-stock state can be manually assigned
-   shirts can have size variants
-   non-shirt/simple products require no variant
-   categories work
-   related products work
-   fallback same-category suggestions work
-   cart persists locally
-   cart offers work and are server-validated
-   US/Canada/international flat shipping works
-   Stripe payment works
-   Stripe webhook authoritatively marks an order paid
-   customer receives a usable confirmation flow
-   admin can manage products/categories
-   admin can change product/size availability
-   admin can curate related products
-   admin can configure cart offers
-   admin can manage shipping settings
-   admin can view orders and mark them shipped
-   refunds are handled safely through Stripe
-   storefront works well on desktop and mobile
-   storefront visually matches the approved Short Fuse direction
-   checkout remains clean and usable
-   project has documented local/deployment setup

------------------------------------------------------------------------

## 25. What NOT to Build

For clarity, do not add these unless explicitly requested later:

-   print on demand
-   customer accounts
-   social login
-   wishlists
-   product reviews
-   exact inventory counts
-   arbitrary product variants
-   discount-code system
-   gift cards
-   loyalty points
-   live carrier shipping rates
-   automated recommendation engine
-   abandoned-cart emails
-   newsletter platform
-   multi-vendor functionality
-   multi-store SaaS abstractions
-   localization framework
-   complicated analytics infrastructure

------------------------------------------------------------------------

## 26. First Task

Start by:

1.  Inspecting the existing repository and any provided `products.json`,
    logo, and reference assets.
2.  Summarizing the implementation plan and any important assumptions.
3.  Creating the monorepo foundation.
4.  Defining the initial PostgreSQL/Drizzle schema.
5.  Implementing the Big Cartel import path.
6.  Getting a minimal catalog API and storefront running against
    imported data.

Do not spend the first phase polishing every page.

Establish the real data path first:

**Big Cartel JSON → PostgreSQL → API → React storefront**

Then build outward from there.

The visual target is already established: **black/off-white/blood-red,
old-school Hot Topic, underground metal, moderately distressed, but with
modern ecommerce usability.**

Proceed.

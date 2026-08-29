import { listCategories, listOffers, listProductOptions } from "@/lib/admin-data";
import { PageHeading } from "@/components/admin/ui";
import { OfferManager } from "@/components/admin/OfferManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Cart offers" };

export default async function OffersPage() {
  const [offers, productOptions, categories] = await Promise.all([
    listOffers(),
    listProductOptions(),
    listCategories(),
  ]);

  return (
    <>
      <PageHeading>Cart offers</PageHeading>
      <p className="mb-6 max-w-prose text-sm text-bone-faint">
        These appear in the &ldquo;While you&rsquo;re here…&rdquo; strip on the cart.
        Eligibility is re-checked on the server before the promotional price is
        honoured, so an offer can never be claimed by editing the page. Offered
        products must not have sizes — the offer adds a single unit with no size
        to choose.
      </p>
      <OfferManager
        offers={offers.map((o) => ({
          id: o.id,
          name: o.name,
          productId: o.productId,
          productName: o.product?.name ?? `Product ${o.productId}`,
          offerPriceCents: o.offerPriceCents,
          active: o.active,
          triggerType: o.triggerType,
          triggerProductId: o.triggerProductId,
          triggerCategoryId: o.triggerCategoryId,
          minimumSubtotalCents: o.minimumSubtotalCents,
          sortPosition: o.sortPosition,
        }))}
        productOptions={productOptions}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </>
  );
}

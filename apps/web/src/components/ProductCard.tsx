import Image from "next/image";
import Link from "next/link";
import { SIZE_SHORT_LABEL, isPurchasable } from "@sf/shared";
import { isLowStock, isProductBuyable, type ProductCardView } from "@/lib/catalog";
import { Price } from "./Price";
import { StockBadge } from "./StockBadge";

/**
 * Dark card, loud artwork. The product photo is the point, so the card
 * chrome stays quiet: no white panels, minimal metadata, one badge at most.
 *
 * Hover swaps to the second image where one exists -- done with CSS opacity
 * on two stacked <Image>s so there is no JavaScript and no layout shift.
 */
export function ProductCard({
  product,
  priority = false,
}: {
  product: ProductCardView;
  priority?: boolean;
}) {
  const primary = product.images[0];
  const secondary = product.images[1];
  const buyable = isProductBuyable(product);
  const lowStock = isLowStock(product);
  const onSale =
    product.salePriceCents !== null && product.salePriceCents < product.priceCents;

  const badge = !buyable ? "SOLD_OUT" : onSale ? "SALE" : lowStock ? "LOW_STOCK" : null;

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group relative block focus-visible:outline-2 focus-visible:outline-blood-bright"
    >
      <article className="flex h-full flex-col">
        <div className="relative aspect-square overflow-hidden border border-ink-line bg-ink-card">
          {primary ? (
            <>
              <Image
                src={primary.url}
                alt={primary.alt ?? product.name}
                width={primary.width ?? 800}
                height={primary.height ?? 800}
                priority={priority}
                loading={priority ? undefined : "lazy"}
                sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                className={`h-full w-full object-cover transition-opacity duration-300 ${
                  secondary ? "group-hover:opacity-0" : ""
                } ${!buyable ? "opacity-45 grayscale" : ""}`}
              />
              {secondary && (
                <Image
                  src={secondary.url}
                  alt=""
                  aria-hidden="true"
                  width={secondary.width ?? 800}
                  height={secondary.height ?? 800}
                  loading="lazy"
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className={`absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover:opacity-100 ${
                    !buyable ? "grayscale" : ""
                  }`}
                />
              )}
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-bone-faint">
              <span className="stamp text-xs">No image</span>
            </div>
          )}

          {badge && (
            <div className="absolute left-2 top-2 z-10">
              <StockBadge state={badge} />
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 pt-3">
          <h3 className="stamp text-sm leading-tight text-bone transition-colors group-hover:text-blood-bright sm:text-base">
            {product.name}
          </h3>

          <Price
            priceCents={product.priceCents}
            salePriceCents={product.salePriceCents}
          />

          {/* Size availability preview, matching the approved design. Sold-out
              sizes stay visible but are struck through rather than hidden, so
              the row does not reflow between products. */}
          {product.sizes.length > 0 && (
            <ul className="mt-auto flex flex-wrap gap-1 pt-1">
              {product.sizes.map((s) => {
                const available = isPurchasable(s.availability);
                return (
                  <li
                    key={s.id}
                    className={`border px-1.5 py-0.5 text-[0.7rem] leading-none ${
                      available
                        ? "border-ink-line text-bone-dim"
                        : "border-ink-line/50 text-bone-faint line-through"
                    }`}
                  >
                    {SIZE_SHORT_LABEL[s.label] ?? s.label}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </article>
    </Link>
  );
}

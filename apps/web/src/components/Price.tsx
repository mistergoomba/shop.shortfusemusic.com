import { formatCents } from "@sf/shared";

/**
 * Prices are never colour-coded alone. A sale shows the old price struck
 * through with a visually-hidden "was/now" for screen readers, so the
 * discount is never communicated by red text by itself.
 */
export function Price({
  priceCents,
  salePriceCents,
  className = "",
  size = "md",
}: {
  priceCents: number;
  salePriceCents: number | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const onSale = salePriceCents !== null && salePriceCents < priceCents;
  const effective = onSale ? salePriceCents : priceCents;

  const sizeClass =
    size === "lg" ? "text-3xl" : size === "sm" ? "text-sm" : "text-lg";

  if (!onSale) {
    return (
      <span className={`${sizeClass} font-semibold text-blood-bright ${className}`}>
        {formatCents(effective)}
      </span>
    );
  }

  return (
    <span className={`flex items-baseline gap-2 ${className}`}>
      <span className="sr-only">Was</span>
      <s className="text-bone-faint text-sm">{formatCents(priceCents)}</s>
      <span className="sr-only">now</span>
      <span className={`${sizeClass} font-semibold text-blood-bright`}>
        {formatCents(effective)}
      </span>
    </span>
  );
}

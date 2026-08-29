/**
 * Stock state always carries a word, never only a colour -- an accessibility
 * requirement from the spec and simply clearer besides.
 */
export function StockBadge({
  state,
}: {
  state: "SOLD_OUT" | "LOW_STOCK" | "SALE";
}) {
  const label =
    state === "SOLD_OUT" ? "Sold Out" : state === "LOW_STOCK" ? "Low Stock" : "Sale";

  const tone =
    state === "SOLD_OUT"
      ? "bg-ink border border-bone-faint text-bone-dim"
      : "bg-blood text-bone";

  return (
    <span
      className={`stamp edge-torn inline-block px-2.5 py-1 text-[0.7rem] leading-none ${tone}`}
    >
      {label}
    </span>
  );
}

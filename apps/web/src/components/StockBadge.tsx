/**
 * Stock state always carries a word, never only a colour -- an accessibility
 * requirement from the spec and simply clearer besides.
 *
 * SOLD OUT and SALE are both red so they read at a glance against the dark
 * cards, but they are deliberately different reds: SALE is a solid bright
 * block (it wants the click), SOLD OUT is a darker filled block with a bright
 * outline (it wants attention, not action). The label does the real work.
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
      ? "bg-blood-deep border border-blood-bright text-bone"
      : "bg-blood text-bone";

  return (
    <span
      className={`stamp edge-torn inline-block px-2.5 py-1 text-[0.7rem] leading-none ${tone}`}
    >
      {label}
    </span>
  );
}

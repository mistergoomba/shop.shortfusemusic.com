import Image from "next/image";
import Link from "next/link";
import { formatCents, isPurchasable } from "@sf/shared";
import { listCategories, listProducts, type ProductFilter } from "@/lib/admin-data";
import {
  AvailabilityPill,
  ButtonLink,
  EmptyState,
  PageHeading,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Products" };

const STATUS_TABS = [
  { key: undefined, label: "All" },
  { key: "active", label: "Visible" },
  { key: "inactive", label: "Hidden" },
  { key: "sold_out", label: "Sold out" },
  { key: "featured", label: "Featured" },
] as const;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; category?: string }>;
}) {
  const sp = await searchParams;
  const filter: ProductFilter = {
    q: sp.q?.trim() || undefined,
    status: (sp.status as ProductFilter["status"]) || undefined,
    categoryId: sp.category ? Number(sp.category) : undefined,
  };

  const [items, categories] = await Promise.all([
    listProducts(filter),
    listCategories(),
  ]);

  function tabHref(status?: string) {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (filter.q) params.set("q", filter.q);
    if (filter.categoryId) params.set("category", String(filter.categoryId));
    const qs = params.toString();
    return `/admin/products${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageHeading action={<ButtonLink href="/admin/products/new">Add Product</ButtonLink>}>
        Products
      </PageHeading>

      <form method="get" className="mb-5 flex flex-wrap items-end gap-3">
        <div>
          <label htmlFor="q" className="mb-1.5 block text-xs text-bone-faint">
            Search
          </label>
          <input
            id="q"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="Name or slug"
            className="min-h-11 border border-ink-line bg-ink-card px-3 py-2 text-bone"
          />
        </div>
        <div>
          <label htmlFor="category" className="mb-1.5 block text-xs text-bone-faint">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={filter.categoryId ?? ""}
            className="min-h-11 border border-ink-line bg-ink-card px-3 py-2 text-bone"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        {filter.status && <input type="hidden" name="status" value={filter.status} />}
        <button
          type="submit"
          className="stamp min-h-11 border border-ink-line px-4 text-sm text-bone-dim hover:text-bone"
        >
          Filter
        </button>
      </form>

      <nav aria-label="Filter by status" className="mb-5 flex flex-wrap gap-2">
        {STATUS_TABS.map((tab) => {
          const active = filter.status === tab.key;
          return (
            <Link
              key={tab.label}
              href={tabHref(tab.key)}
              aria-current={active ? "page" : undefined}
              className={`border px-3 py-1.5 text-sm transition-colors ${
                active
                  ? "border-blood bg-blood/20 text-bone"
                  : "border-ink-line text-bone-dim hover:text-bone"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <EmptyState>No products match that filter.</EmptyState>
      ) : (
        <div className="overflow-x-auto border border-ink-line">
          <table className="w-full min-w-[52rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-line bg-ink-raised text-left">
                <th scope="col" className="p-3 font-normal text-bone-faint">
                  Product
                </th>
                <th scope="col" className="p-3 font-normal text-bone-faint">
                  Category
                </th>
                <th scope="col" className="p-3 font-normal text-bone-faint">
                  Price
                </th>
                <th scope="col" className="p-3 font-normal text-bone-faint">
                  Stock
                </th>
                <th scope="col" className="p-3 font-normal text-bone-faint">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const img = p.images[0];
                const anyInStock =
                  p.sizes.length > 0
                    ? p.sizes.some((s) => isPurchasable(s.availability))
                    : isPurchasable(p.availability);
                return (
                  <tr key={p.id} className="border-b border-ink-line last:border-0">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {img ? (
                          <Image
                            src={img.url}
                            alt=""
                            width={40}
                            height={40}
                            className="h-10 w-10 shrink-0 border border-ink-line object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 shrink-0 border border-ink-line bg-ink-card" />
                        )}
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="text-bone hover:text-blood-bright"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </td>
                    <td className="p-3 text-bone-dim">
                      {p.category?.name ?? "—"}
                    </td>
                    <td className="p-3 text-bone">
                      {p.salePriceCents !== null &&
                      p.salePriceCents < p.priceCents ? (
                        <>
                          <s className="text-bone-faint">
                            {formatCents(p.priceCents)}
                          </s>{" "}
                          <span className="text-blood-bright">
                            {formatCents(p.salePriceCents)}
                          </span>
                        </>
                      ) : (
                        formatCents(p.priceCents)
                      )}
                    </td>
                    <td className="p-3">
                      {p.sizes.length > 0 ? (
                        <span className="text-bone-dim">
                          {p.sizes.filter((s) => isPurchasable(s.availability)).length}
                          /{p.sizes.length} sizes
                          {!anyInStock && (
                            <span className="ml-2 text-blood-bright">sold out</span>
                          )}
                        </span>
                      ) : (
                        <AvailabilityPill value={p.availability} />
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-1.5">
                        {!p.active && (
                          <span className="border border-ink-line px-2 py-0.5 text-xs text-bone-faint">
                            Hidden
                          </span>
                        )}
                        {p.featured && (
                          <span className="border border-blood px-2 py-0.5 text-xs text-blood-bright">
                            Featured
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 text-sm text-bone-faint">
        {items.length} {items.length === 1 ? "product" : "products"}
      </p>
    </>
  );
}

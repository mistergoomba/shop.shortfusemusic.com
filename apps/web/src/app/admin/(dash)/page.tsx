import Link from "next/link";
import { formatCents } from "@sf/shared";
import { getDashboard } from "@/lib/admin-data";
import {
  ButtonLink,
  Card,
  EmptyState,
  PageHeading,
  StatusPill,
} from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export const metadata = { title: "Dashboard" };

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-ink-line bg-ink-raised p-4">
      <p className="text-xs text-bone-faint uppercase tracking-wide">{label}</p>
      <p className="stamp mt-1 text-2xl text-bone">{value}</p>
    </div>
  );
}

export default async function AdminDashboard() {
  const { recentOrders, unshipped, lowStockProducts, lowStockSizes, stats } =
    await getDashboard();

  return (
    <>
      <PageHeading
        action={
          <div className="flex gap-3">
            <ButtonLink href="/admin/products/new">Add Product</ButtonLink>
            <ButtonLink href="/admin/orders" tone="ghost">
              All Orders
            </ButtonLink>
          </div>
        }
      >
        Dashboard
      </PageHeading>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="To ship" value={stats.paid} />
        <Stat label="Shipped" value={stats.shipped} />
        <Stat label="Awaiting payment" value={stats.pending} />
        <Stat label="Revenue" value={formatCents(stats.revenueCents)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title={`Needs shipping (${unshipped.length})`}>
          {unshipped.length === 0 ? (
            <EmptyState>Nothing waiting to go out. Nice.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-line">
              {unshipped.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="stamp text-sm text-blood-bright hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <span className="min-w-0 flex-1 truncate text-sm text-bone-dim">
                    {o.email}
                  </span>
                  <span className="text-sm text-bone">
                    {formatCents(o.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Recent orders">
          {recentOrders.length === 0 ? (
            <EmptyState>No orders yet.</EmptyState>
          ) : (
            <ul className="divide-y divide-ink-line">
              {recentOrders.map((o) => (
                <li key={o.id} className="flex items-center gap-3 py-2.5">
                  <Link
                    href={`/admin/orders/${o.id}`}
                    className="stamp text-sm text-blood-bright hover:underline"
                  >
                    {o.orderNumber}
                  </Link>
                  <StatusPill value={o.status} />
                  <span className="ml-auto text-sm text-bone">
                    {formatCents(o.totalCents)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Low stock" className="lg:col-span-2">
          {lowStockProducts.length === 0 && lowStockSizes.length === 0 ? (
            <EmptyState>
              Nothing flagged low. Big Cartel couldn&rsquo;t tell us what was
              running out — set LOW STOCK by hand on a product or size.
            </EmptyState>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {lowStockProducts.map((p) => (
                <li key={`p-${p.id}`}>
                  <Link
                    href={`/admin/products/${p.id}`}
                    className="inline-block border border-blood px-3 py-1.5 text-sm text-bone hover:bg-blood-deep/30"
                  >
                    {p.name}
                  </Link>
                </li>
              ))}
              {lowStockSizes.map((s) => (
                <li key={`s-${s.productId}-${s.label}`}>
                  <Link
                    href={`/admin/products/${s.productId}`}
                    className="inline-block border border-blood px-3 py-1.5 text-sm text-bone hover:bg-blood-deep/30"
                  >
                    {s.productName}{" "}
                    <span className="text-blood-bright">{s.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}

import Link from "next/link";
import { ORDER_STATUS, formatCents, type OrderStatus } from "@sf/shared";
import { listOrders } from "@/lib/admin-data";
import { EmptyState, PageHeading, StatusPill } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders" };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = ORDER_STATUS.includes(status as OrderStatus)
    ? (status as OrderStatus)
    : undefined;

  const orders = await listOrders(filter);

  return (
    <>
      <PageHeading>Orders</PageHeading>

      <nav aria-label="Filter by status" className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/admin/orders"
          aria-current={!filter ? "page" : undefined}
          className={`border px-3 py-1.5 text-sm ${
            !filter
              ? "border-blood bg-blood/20 text-bone"
              : "border-ink-line text-bone-dim hover:text-bone"
          }`}
        >
          All
        </Link>
        {ORDER_STATUS.map((s) => (
          <Link
            key={s}
            href={`/admin/orders?status=${s}`}
            aria-current={filter === s ? "page" : undefined}
            className={`border px-3 py-1.5 text-sm ${
              filter === s
                ? "border-blood bg-blood/20 text-bone"
                : "border-ink-line text-bone-dim hover:text-bone"
            }`}
          >
            {s}
          </Link>
        ))}
      </nav>

      {orders.length === 0 ? (
        <EmptyState>
          {filter ? `No ${filter} orders.` : "No orders yet."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto border border-ink-line">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-ink-line bg-ink-raised text-left">
                <th scope="col" className="p-3 font-normal text-bone-faint">Order</th>
                <th scope="col" className="p-3 font-normal text-bone-faint">Date</th>
                <th scope="col" className="p-3 font-normal text-bone-faint">Customer</th>
                <th scope="col" className="p-3 font-normal text-bone-faint">Items</th>
                <th scope="col" className="p-3 font-normal text-bone-faint">Total</th>
                <th scope="col" className="p-3 font-normal text-bone-faint">Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} className="border-b border-ink-line last:border-0">
                  <td className="p-3">
                    <Link
                      href={`/admin/orders/${o.id}`}
                      className="stamp text-blood-bright hover:underline"
                    >
                      {o.orderNumber}
                    </Link>
                  </td>
                  <td className="p-3 whitespace-nowrap text-bone-dim">
                    {o.createdAt.toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="p-3">
                    <span className="block max-w-[16rem] truncate text-bone">
                      {o.customerName ?? o.email}
                    </span>
                    {o.customerName && (
                      <span className="block max-w-[16rem] truncate text-xs text-bone-faint">
                        {o.email}
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-bone-dim">
                    {o.items.reduce((n, i) => n + i.quantity, 0)}
                  </td>
                  <td className="p-3 text-bone">{formatCents(o.totalCents)}</td>
                  <td className="p-3">
                    <div className="flex flex-col gap-1">
                      <StatusPill value={o.status} />
                      {o.trackingNumber && (
                        <span className="text-xs text-bone-faint">tracked</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

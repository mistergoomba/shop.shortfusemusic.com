import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import { logout } from "../actions";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s | Short Fuse Admin" },
  robots: { index: false, follow: false, nocache: true },
};

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/categories", label: "Categories" },
  { href: "/admin/offers", label: "Cart Offers" },
  { href: "/admin/settings", label: "Settings" },
] as const;

/**
 * Auth gate for every admin page.
 *
 * This is a route-group layout, so /admin/login sits deliberately outside it
 * and a new page added anywhere under (dash) inherits the check automatically
 * -- there is no per-page guard to forget.
 *
 * The admin is plainer than the storefront on purpose: no grain, no torn
 * edges. It should be fast to read, not atmospheric.
 */
export default async function AdminDashLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (!(await isAuthenticated())) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-ink">
      <header className="border-b border-ink-line bg-ink-raised">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 lg:px-8">
          <Link href="/admin" className="stamp text-lg text-blood-bright">
            SF Admin
          </Link>

          <nav aria-label="Admin sections" className="flex flex-wrap gap-x-5 gap-y-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-bone-dim transition-colors hover:text-bone"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-bone-faint hover:text-bone"
              target="_blank"
              rel="noopener"
            >
              View shop ↗
            </Link>
            <form action={logout}>
              <button
                type="submit"
                className="text-sm text-bone-faint underline underline-offset-4 hover:text-blood-bright"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8 lg:px-8">{children}</div>
    </div>
  );
}

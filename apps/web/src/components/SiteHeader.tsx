import Image from "next/image";
import Link from "next/link";
import { getCategories } from "@/lib/catalog";
import { CartLink } from "./CartLink";
import { MobileNav } from "./MobileNav";
import { NavLink } from "./NavLink";

/**
 * Desktop: the logo gets genuine presence at upper left, horizontal nav
 * beside it, cart at upper right -- the approved composition.
 * Mobile: compact bar with a drawer, so decoration never eats the viewport.
 */
export async function SiteHeader() {
  const categories = await getCategories();

  return (
    <header className="relative z-40 border-b-2 border-blood-deep bg-ink">
      <div className="mx-auto flex max-w-[1600px] items-center gap-4 px-4 py-3 lg:px-8 lg:py-4">
        <MobileNav categories={categories} />

        <Link
          href="/"
          className="shrink-0"
          aria-label="Short Fuse — official merchandise, home"
        >
          <Image
            src="/brand/logo.png"
            alt="Short Fuse"
            width={900}
            height={649}
            priority
            className="h-11 w-auto sm:h-14 lg:h-24"
          />
        </Link>

        <nav
          aria-label="Shop categories"
          className="ml-6 hidden flex-1 items-center gap-6 lg:flex xl:gap-8"
        >
          <NavLink href="/">Shop</NavLink>
          {categories.map((c) => (
            <NavLink key={c.id} href={`/category/${c.slug}`}>
              {c.name}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-4 lg:gap-6">
          <CartLink />
        </div>
      </div>
    </header>
  );
}

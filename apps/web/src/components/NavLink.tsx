"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Nav item with the red underline the approved design uses to mark the
 * current section. aria-current carries the same information for anyone not
 * seeing the underline.
 */
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`stamp relative whitespace-nowrap py-1 text-sm transition-colors xl:text-base ${
        active ? "text-blood-bright" : "text-bone hover:text-blood-bright"
      }`}
    >
      {children}
      {active && (
        <span
          aria-hidden="true"
          className="absolute inset-x-0 -bottom-0.5 h-0.5 bg-blood"
        />
      )}
    </Link>
  );
}

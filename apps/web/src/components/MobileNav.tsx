"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { CategoryView } from "@/lib/catalog";

/**
 * Mobile category drawer.
 *
 * Accessible dialog behaviour done by hand rather than pulling in a library:
 * Escape closes, focus moves into the panel on open and back to the trigger
 * on close, focus is trapped while open, and the page behind cannot scroll.
 */
export function MobileNav({ categories }: { categories: CategoryView[] }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();

  // Close on navigation.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key !== "Tab") return;

      const focusables = panelRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled])',
      );
      if (!focusables || focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
      (previouslyFocused ?? triggerRef.current)?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="stamp flex items-center gap-2 p-2 text-sm text-bone lg:hidden"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 stroke-bone stroke-2">
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
        Menu
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-black/80"
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Shop navigation"
            className="grain absolute inset-y-0 left-0 flex w-[82%] max-w-xs flex-col overflow-y-auto border-r-2 border-blood bg-ink-raised"
          >
            <div className="flex items-center justify-between border-b border-ink-line px-5 py-4">
              <span className="stamp text-blood-bright">Categories</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-2 text-bone-dim hover:text-bone"
                aria-label="Close menu"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true" className="h-6 w-6 stroke-current stroke-2">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <nav className="flex flex-col px-5 py-4">
              <Link
                href="/"
                className="stamp border-b border-ink-line/60 py-3.5 text-lg text-bone hover:text-blood-bright"
              >
                All Items
              </Link>
              {categories.map((c) => (
                <Link
                  key={c.id}
                  href={`/category/${c.slug}`}
                  className="stamp border-b border-ink-line/60 py-3.5 text-lg text-bone hover:text-blood-bright"
                >
                  {c.name}
                </Link>
              ))}
              <Link
                href="/cart"
                className="stamp py-3.5 text-lg text-blood-bright hover:text-bone"
              >
                Cart
              </Link>
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

import Link from "next/link";
import type { CategoryView } from "@/lib/catalog";

/**
 * Left-hand category rail from the approved desktop composition. Hidden below
 * lg, where the drawer takes over -- the mobile layout is not a squeezed
 * desktop.
 */
export function CategorySidebar({
  categories,
  activeSlug,
}: {
  categories: CategoryView[];
  activeSlug?: string;
}) {
  return (
    <aside className="hidden w-56 shrink-0 lg:block xl:w-64">
      <nav
        aria-label="Categories"
        className="grain border border-ink-line bg-ink-raised p-5"
      >
        <h2 className="rule-blood mb-6 text-xl text-blood-bright">Categories</h2>

        <ul className="flex flex-col gap-3">
          <li>
            <Link
              href="/"
              aria-current={!activeSlug ? "page" : undefined}
              className={`stamp text-lg transition-colors ${
                !activeSlug ? "text-blood-bright" : "text-bone hover:text-blood-bright"
              }`}
            >
              All Items
            </Link>
          </li>
          {categories.map((c) => {
            const active = c.slug === activeSlug;
            return (
              <li key={c.id}>
                <Link
                  href={`/category/${c.slug}`}
                  aria-current={active ? "page" : undefined}
                  className={`stamp text-lg transition-colors ${
                    active ? "text-blood-bright" : "text-bone hover:text-blood-bright"
                  }`}
                >
                  {c.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}

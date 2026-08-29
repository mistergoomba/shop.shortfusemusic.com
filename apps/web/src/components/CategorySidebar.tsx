import Image from "next/image";
import Link from "next/link";
import type { CategoryView } from "@/lib/catalog";

/**
 * Left-hand category rail from the approved desktop composition, including
 * the flaming skull and the "WEAR SOME HATE" block. Hidden below lg, where
 * the drawer takes over -- the mobile layout is not a squeezed desktop.
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

        <div className="mt-8">
          <Image
            src="/brand/skull.png"
            alt=""
            aria-hidden="true"
            width={679}
            height={800}
            loading="lazy"
            sizes="16rem"
            className="mx-auto h-auto w-full max-w-[13rem]"
          />
        </div>

        <p className="stamp mt-6 space-y-1 text-center text-lg leading-relaxed text-bone">
          <span className="block">
            Wear Some <span className="text-blood-bright">Hate</span>
          </span>
          <span className="block">
            Listen To Some <span className="text-blood-bright">Hate</span>
          </span>
          <span className="block">
            Live Some <span className="text-blood-bright">Hate</span>
          </span>
        </p>
      </nav>
    </aside>
  );
}

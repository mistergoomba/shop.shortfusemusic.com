import { getStoreSettings } from "@/lib/catalog";

/** The reassurance strip along the bottom of the approved design. */
const REASSURANCE = [
  { title: "Official Merch", sub: "100% Real" },
  { title: "Shipping", sub: "Worldwide" },
  { title: "Secure", sub: "Checkout" },
  { title: "Support", sub: "The Band" },
] as const;

const SOCIALS = [
  { label: "Instagram", href: "https://instagram.com/shortfusemusic" },
  { label: "Facebook", href: "https://facebook.com/shortfusemusic" },
  { label: "YouTube", href: "https://youtube.com/@shortfusemusic" },
  { label: "Spotify", href: "https://open.spotify.com" },
] as const;

export async function SiteFooter() {
  const settings = await getStoreSettings();

  return (
    <footer className="mt-16 border-t-2 border-blood-deep bg-ink">
      <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
        <ul className="grid grid-cols-2 gap-6 border-b border-ink-line pb-8 sm:grid-cols-4">
          {REASSURANCE.map((r) => (
            <li key={r.title} className="text-center sm:text-left">
              <p className="stamp text-sm text-bone">{r.title}</p>
              <p className="stamp text-xs text-bone-faint">{r.sub}</p>
            </li>
          ))}
        </ul>

        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-bone-faint">
            © {new Date().getFullYear()} {settings.storeName}. All rights reserved.{" "}
            <a
              href={`mailto:${settings.contactEmail}`}
              className="text-bone-dim underline underline-offset-2 hover:text-blood-bright"
            >
              {settings.contactEmail}
            </a>
          </p>

          <ul className="flex flex-wrap gap-5">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="stamp text-xs text-bone-dim transition-colors hover:text-blood-bright"
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

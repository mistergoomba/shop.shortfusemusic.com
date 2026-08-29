import Link from "next/link";

export const metadata = {
  title: "Not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl flex-col items-center justify-center gap-5 px-4 text-center">
      <p className="stamp text-6xl text-blood">404</p>
      <h1 className="text-2xl text-bone">This one&rsquo;s gone</h1>
      <p className="text-bone-dim">
        Wrong turn, dead link, or something we stopped selling.
      </p>
      <Link
        href="/"
        className="stamp mt-2 bg-blood px-6 py-3 text-bone transition-colors hover:bg-blood-bright"
      >
        Back to the Shop
      </Link>
    </div>
  );
}

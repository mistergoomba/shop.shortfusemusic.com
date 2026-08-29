import Image from "next/image";

/**
 * Gritty black-and-white crowd shot with the red stamped headline, per the
 * approved design. The photo is desaturated in CSS so the band's own promo
 * image can be swapped without re-editing it.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border border-ink-line">
      <div className="relative aspect-[16/7] w-full sm:aspect-[21/7] lg:aspect-[24/7]">
        <Image
          src="/brand/hero.jpg"
          alt="Short Fuse playing live to a packed crowd"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover object-center grayscale contrast-125"
        />
        {/* Vignette keeps the headline legible over a busy photograph. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/65 to-ink/25"
        />
        <div aria-hidden="true" className="grain absolute inset-0 opacity-60" />

        <div className="absolute inset-0 flex flex-col justify-center gap-1 px-5 sm:px-8 lg:px-12">
          <h1 className="max-w-[16ch]">
            <span className="block bg-ink/70 px-2 py-1 text-2xl text-blood-bright sm:text-4xl lg:text-5xl">
              Official Merchandise
            </span>
            <span className="mt-1 block px-2 text-lg text-bone sm:text-2xl lg:text-3xl">
              From The Depths
            </span>
          </h1>
        </div>
      </div>
    </section>
  );
}

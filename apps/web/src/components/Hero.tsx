import Image from "next/image";

/**
 * Gritty black-and-white band shot with the red stamped headline. The photo is
 * desaturated in CSS so the band's own promo image can be swapped without
 * re-editing it.
 *
 * Two knobs control the crop:
 *
 *   aspect-*  -- how tall the band is. The source photo is 4:3, so the wider
 *                this gets, the more vertical crop there is.
 *   object-*  -- where that crop is taken from. Mobile keeps `object-top`,
 *                since the narrow ratio barely crops and the top is where the
 *                faces are. Desktop pulls the frame up by a fixed 140px, which
 *                sits the heads just below the top edge rather than flush
 *                against it.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden border border-ink-line">
      <div className="relative aspect-[4/3] w-full sm:aspect-[3/2] lg:aspect-[21/9]">
        <Image
          src="/brand/hero.jpg"
          alt="Short Fuse photographed together against a roller door"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 1200px"
          className="object-cover object-top grayscale contrast-125 lg:object-[0_-140px]"
        />
        {/* Vignette keeps the headline legible over a busy photograph. It is
            weighted left so the band's faces on the right stay visible. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent"
        />
        <div aria-hidden="true" className="grain absolute inset-0 opacity-60" />

        <div className="absolute inset-0 flex flex-col justify-center px-5 sm:px-8 lg:px-12">
          <h1 className="w-fit max-w-[92%] bg-ink/70 px-2 py-1 text-3xl leading-[1.05] text-blood-bright sm:text-5xl lg:text-6xl">
            Official Merchandise
          </h1>
        </div>
      </div>
    </section>
  );
}

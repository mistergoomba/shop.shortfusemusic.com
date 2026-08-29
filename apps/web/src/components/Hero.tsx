import Image from "next/image";

/**
 * Gritty black-and-white band shot with the red stamped headline, per the
 * approved design. The photo is desaturated in CSS so the band's own promo
 * image can be swapped without re-editing it.
 *
 * Two knobs control the crop, and they interact:
 *
 *   aspect-*  -- how tall the band is. The source photo is 4:3, so the wider
 *                this gets, the more vertical crop there is. At the original
 *                24/7 roughly 40% of the image height was discarded, which
 *                took the band's heads with it.
 *   object-*  -- where that crop is taken from. `object-top` keeps the top of
 *                the frame, so heads are never the thing that gets cut.
 *
 * To show more of the frame, make the aspect ratios narrower (e.g. lg:16/9).
 * To sit the crop lower, swap object-top for object-[center_20%].
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
          className="object-cover object-top grayscale contrast-125"
        />
        {/* Vignette keeps the headline legible over a busy photograph. It is
            weighted left so the band's faces on the right stay visible. */}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-r from-ink via-ink/60 to-transparent"
        />
        <div aria-hidden="true" className="grain absolute inset-0 opacity-60" />

        <div className="absolute inset-0 flex flex-col justify-center gap-1 px-5 sm:px-8 lg:px-12">
          <h1 className="max-w-[92%]">
            <span className="block w-fit bg-ink/70 px-2 py-1 text-3xl leading-[1.05] text-blood-bright sm:text-5xl lg:text-6xl">
              Official Merchandise
            </span>
            <span className="mt-1.5 block w-fit px-2 text-lg text-bone sm:text-2xl lg:text-3xl">
              From The Depths
            </span>
          </h1>
        </div>
      </div>
    </section>
  );
}

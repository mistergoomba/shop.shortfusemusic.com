import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { CheckoutView } from "@/components/CheckoutView";

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false, follow: false },
};

/**
 * Checkout deliberately drops the storefront chrome: no category rail, no
 * grain, no distressed edges. Logo, black, off-white, red accent, clean
 * fields. It should feel like the calmest page on the site.
 */
export default function CheckoutPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-8 lg:px-8 lg:py-12">
      <div className="mb-10 flex flex-col items-center gap-3 text-center">
        <Link href="/" aria-label="Short Fuse, back to the shop">
          <Image
            src="/brand/logo.png"
            alt="Short Fuse"
            width={900}
            height={649}
            className="h-16 w-auto sm:h-20"
          />
        </Link>
        <h1 className="text-2xl text-bone sm:text-3xl">Checkout</h1>
      </div>

      <CheckoutView />
    </div>
  );
}

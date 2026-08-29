import type { Metadata } from "next";
import { CartView } from "@/components/CartView";
import { SectionHeading } from "@/components/SectionHeading";

export const metadata: Metadata = {
  title: "Cart",
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return (
    <div className="mx-auto max-w-[1300px] px-4 py-6 lg:px-8 lg:py-10">
      <SectionHeading as="h1">Your Cart</SectionHeading>
      <CartView />
    </div>
  );
}

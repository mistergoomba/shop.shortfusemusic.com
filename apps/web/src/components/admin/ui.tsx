import Link from "next/link";
import type { Availability, OrderStatus } from "@sf/shared";

/** Small shared primitives so admin screens stay visually consistent. */

export function PageHeading({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
      <h1 className="text-2xl text-bone">{children}</h1>
      {action}
    </div>
  );
}

export function Card({
  title,
  children,
  className = "",
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`border border-ink-line bg-ink-raised p-5 ${className}`}>
      {title && <h2 className="mb-4 text-lg text-bone">{title}</h2>}
      {children}
    </section>
  );
}

export function ButtonLink({
  href,
  children,
  tone = "primary",
}: {
  href: string;
  children: React.ReactNode;
  tone?: "primary" | "ghost";
}) {
  const cls =
    tone === "primary"
      ? "bg-blood text-bone hover:bg-blood-bright"
      : "border border-ink-line text-bone-dim hover:text-bone";
  return (
    <Link
      href={href}
      className={`stamp inline-flex min-h-11 items-center px-4 py-2 text-sm transition-colors ${cls}`}
    >
      {children}
    </Link>
  );
}

const AVAILABILITY_TONE: Record<Availability, string> = {
  IN_STOCK: "border-bone-faint text-bone-dim",
  LOW_STOCK: "border-blood text-blood-bright",
  SOLD_OUT: "border-blood-deep bg-blood-deep/30 text-bone-dim",
};

const AVAILABILITY_LABEL: Record<Availability, string> = {
  IN_STOCK: "In stock",
  LOW_STOCK: "Low stock",
  SOLD_OUT: "Sold out",
};

export function AvailabilityPill({ value }: { value: Availability }) {
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 text-xs ${AVAILABILITY_TONE[value]}`}
    >
      {AVAILABILITY_LABEL[value]}
    </span>
  );
}

const STATUS_TONE: Record<OrderStatus, string> = {
  PENDING: "border-bone-faint text-bone-dim",
  PAID: "border-blood bg-blood/20 text-bone",
  SHIPPED: "border-bone-dim text-bone",
  CANCELED: "border-ink-line text-bone-faint",
  REFUNDED: "border-blood-deep text-blood-bright",
};

export function StatusPill({ value }: { value: OrderStatus }) {
  return (
    <span
      className={`inline-block whitespace-nowrap border px-2 py-0.5 text-xs ${STATUS_TONE[value]}`}
    >
      {value}
    </span>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="border border-ink-line bg-ink-raised px-4 py-10 text-center text-bone-dim">
      {children}
    </p>
  );
}

/** Consistent styling for the many text inputs across the admin forms. */
export const inputClass =
  "min-h-11 w-full border border-ink-line bg-ink-card px-3 py-2 text-bone placeholder:text-bone-faint";
export const labelClass = "mb-1.5 block text-sm text-bone-dim";

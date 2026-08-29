import Link from "next/link";

export function SectionHeading({
  children,
  href,
  linkLabel = "View All",
  as: Tag = "h2",
}: {
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
  as?: "h1" | "h2";
}) {
  return (
    <div className="mb-7 flex items-baseline gap-4">
      <Tag className="rule-blood text-2xl text-bone sm:text-3xl">{children}</Tag>
      {href && (
        <Link
          href={href}
          className="stamp text-xs text-blood-bright underline-offset-4 hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

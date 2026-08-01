import Link from "next/link";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/guide", label: "User guide" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function SiteFooter({
  className = "mt-10 flex flex-wrap gap-4 text-xs font-bold text-[var(--muted)]",
  linkClassName = "min-h-11 content-center hover:text-[var(--accent)]",
}: {
  className?: string;
  linkClassName?: string;
}) {
  return (
    <footer className={className}>
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className={linkClassName}>
          {link.label}
        </Link>
      ))}
    </footer>
  );
}

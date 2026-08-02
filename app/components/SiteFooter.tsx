import Link from "next/link";
import { APP_VERSION_LABEL } from "@/lib/app-version";

const LINKS = [
  { href: "/about", label: "About" },
  { href: "/guide", label: "User guide" },
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
] as const;

export default function SiteFooter({
  className = "mt-10 flex flex-col gap-3",
  linkClassName = "min-h-11 content-center hover:text-[var(--accent)]",
  linksClassName = "flex flex-wrap gap-4 text-xs font-bold text-[var(--muted)]",
  versionClassName = "text-xs font-medium text-[var(--muted)]",
}: {
  className?: string;
  linkClassName?: string;
  linksClassName?: string;
  versionClassName?: string;
}) {
  return (
    <footer className={className}>
      <div className={linksClassName}>
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={linkClassName}>
            {link.label}
          </Link>
        ))}
      </div>
      <p className={versionClassName}>{APP_VERSION_LABEL}</p>
    </footer>
  );
}

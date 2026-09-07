"use client";

import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: LucideIcon;
}) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`flex w-full items-center gap-[11px] border-l-[3px] px-[14px] py-3 font-body text-[13.5px] transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white lg:w-[208px] lg:py-[10px] ${
        active
          ? "border-accent bg-sidebar-2 font-semibold text-white"
          : "border-transparent font-medium text-sidebar-ink hover:bg-sidebar-2"
      }`}
    >
      <Icon size={17} />
      {label}
    </Link>
  );
}

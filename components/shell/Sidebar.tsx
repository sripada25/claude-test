"use client";

import { Bell, Briefcase, FileText, LayoutDashboard, Settings } from "lucide-react";
import { useEffect } from "react";
import { NavItem } from "@/components/shell/NavItem";
import { SidebarBrand } from "@/components/shell/SidebarBrand";
import { SidebarUser } from "@/components/shell/SidebarUser";
import { RemindersBadge } from "@/components/reminders/RemindersBadge";

const NAV_ITEMS = [
  { href: "/app/board", label: "Board", icon: LayoutDashboard },
  { href: "/app/applications", label: "Applications", icon: Briefcase },
  { href: "/app/documents", label: "Documents", icon: FileText },
  { href: "/app/reminders", label: "Reminders", icon: Bell },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <aside
        aria-label="Main navigation"
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[232px] shrink-0 flex-col justify-between bg-sidebar transition-transform duration-200 lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div>
          <SidebarBrand onClose={onClose} />
          <nav className="flex flex-col gap-[2px] py-1 lg:px-3">
            {NAV_ITEMS.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                icon={item.icon}
                badge={item.href === "/app/reminders" ? <RemindersBadge /> : undefined}
              />
            ))}
          </nav>
        </div>
        <SidebarUser />
      </aside>
    </>
  );
}

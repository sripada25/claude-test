import { X } from "lucide-react";
import Link from "next/link";
import { BrandMark } from "@/components/ui/BrandMark";

export function SidebarBrand({ onClose }: { onClose: () => void }) {
  return (
    <div className="flex items-center justify-between px-5 pb-[26px] pt-[22px]">
      <Link href="/app/board" aria-label="Trackr — go to board">
        <BrandMark size="sidebar" />
      </Link>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close navigation"
        className="-mr-2 grid size-11 place-items-center text-sidebar-ink lg:hidden"
      >
        <X size={18} />
      </button>
    </div>
  );
}

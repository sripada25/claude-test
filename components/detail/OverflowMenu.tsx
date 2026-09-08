"use client";

import { Ellipsis } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ErrorToast } from "@/components/board/ErrorToast";
import type { ApplicationDetail } from "@/components/detail/DetailScreen";
import { CSRF_HEADER_NAME, getCsrfToken } from "@/lib/security/csrf-client";

export function OverflowMenu({ application }: { application: ApplicationDetail }) {
  const [open, setOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      const items = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);

      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
      }
    }

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  async function handleDuplicate() {
    close();
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", [CSRF_HEADER_NAME]: getCsrfToken() },
        body: JSON.stringify({
          company: application.company,
          role: application.role,
          status: application.status,
          dateApplied: application.dateApplied,
          source: application.source,
          sourceUrl: application.sourceUrl,
          jobDescription: application.jobDescription,
        }),
      });
      if (!response.ok) {
        throw new Error("duplicate_failed");
      }
      const created = await response.json();
      router.push(`/app/applications/${created.id}`);
    } catch {
      setErrorMessage("Could not duplicate — please try again");
    }
  }

  async function handleDelete() {
    close();
    if (!window.confirm("Delete this application? It will move to trash.")) {
      return;
    }
    try {
      const response = await fetch(`/api/applications/${application.id}`, {
        method: "DELETE",
        headers: { [CSRF_HEADER_NAME]: getCsrfToken() },
      });
      if (!response.ok) {
        throw new Error("delete_failed");
      }
      router.push("/app/board");
    } catch {
      setErrorMessage("Could not delete — please try again");
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label="More actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex size-11 items-center justify-center text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent"
      >
        <Ellipsis size={19} />
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full z-10 mt-1 min-w-[160px] border border-border bg-surface py-1 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={close}
            className="flex w-full items-center px-3 py-2 text-left font-body text-[13px] text-ink hover:bg-surface-2"
          >
            Edit
          </button>
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={handleDuplicate}
            className="flex w-full items-center px-3 py-2 text-left font-body text-[13px] text-ink hover:bg-surface-2"
          >
            Duplicate
          </button>
          {application.status === "rejected" && (
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              onClick={handleDelete}
              className="flex w-full items-center px-3 py-2 text-left font-body text-[13px] text-danger hover:bg-surface-2"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {errorMessage && (
        <ErrorToast message={errorMessage} onDismiss={() => setErrorMessage(null)} />
      )}
    </div>
  );
}

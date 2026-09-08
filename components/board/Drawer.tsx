"use client";

import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Drawer({
  open,
  onClose,
  isDirty,
  children,
}: {
  open: boolean;
  onClose: () => void;
  isDirty: boolean;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const isDirtyRef = useRef(isDirty);
  isDirtyRef.current = isDirty;

  function requestClose() {
    if (isDirtyRef.current && !window.confirm("Discard this application? Your changes won't be saved.")) {
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!open) {
      return;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    const firstFocusable = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
    (firstFocusable ?? panel)?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        requestClose();
        return;
      }
      if (event.key !== "Tab" || !panel) {
        return;
      }
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) {
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-40" onClick={requestClose} aria-hidden="true" />
      )}
      <aside
        ref={panelRef}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-labelledby="drawer-title"
        tabIndex={-1}
        inert={!open}
        className={`fixed inset-0 z-50 flex flex-col justify-between border-l border-border bg-surface shadow-[-6px_0px_28px_0px_rgba(21,24,28,0.15)] transition-transform duration-200 md:inset-x-auto md:inset-y-0 md:right-0 md:w-[410px] ${
          open ? "translate-y-0 md:translate-x-0" : "translate-y-full md:translate-x-full"
        }`}
      >
        {children}
      </aside>
    </>
  );
}

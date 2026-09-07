"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";

const DEBOUNCE_MS = 300;

export function SearchInput({ onQueryChange }: { onQueryChange: (query: string) => void }) {
  const [value, setValue] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => onQueryChange(value), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [value, onQueryChange]);

  return (
    <div
      role="search"
      className="flex flex-1 items-center gap-2 border border-border bg-bg px-3 py-[9px] focus-within:border-primary md:w-[230px] md:flex-none"
    >
      <Search size={15} className="text-muted" />
      <label htmlFor="board-search" className="sr-only">
        Search company or role
      </label>
      <input
        id="board-search"
        type="text"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="Search company or role"
        className="w-full bg-transparent font-body text-[13px] outline-none placeholder:text-muted"
      />
    </div>
  );
}
